import { createSocket } from 'node:dgram';
import { networkInterfaces } from 'node:os';
import { randomUUID } from 'node:crypto';

import { domainError, err, ok, type Result } from '../../domain/errors';
import type { CameraScan, DiscoveredCamera, ScannedNetwork } from '../../domain/camera';
import type { CameraDiscoveryPort } from '../../usecase/camera-discover/contract';
import { ONVIF } from '../../config/defaults';

/**
 * ONVIF WS-Discovery, run in this process.
 *
 * **Why not only multicast.** Multicast is the textbook method and it finds
 * nothing on plenty of real networks — measured on the network this was written
 * on: zero responders, from the host, both with an ephemeral source port and
 * bound to 3702 with the group joined. A *unicast* probe to the same camera
 * answers instantly. Many APs and switches simply do not forward this group.
 *
 * So both are sent: multicast because it is free and correct where it works,
 * and a unicast sweep of the local subnet because that is what actually finds
 * cameras. Replies are collected on one socket in one window, so the sweep
 * costs a few hundred datagrams and one timeout rather than N timeouts.
 */

/** The Probe body. `uuid:` prefix is required; some cameras reject a bare UUID. */
const probeMessage = (): Buffer =>
  Buffer.from(
    `<?xml version="1.0" encoding="UTF-8"?>
<e:Envelope xmlns:e="http://www.w3.org/2003/05/soap-envelope"
 xmlns:w="http://schemas.xmlsoap.org/ws/2004/08/addressing"
 xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery"
 xmlns:dn="http://www.onvif.org/ver10/network/wsdl">
 <e:Header>
  <w:MessageID>uuid:${randomUUID()}</w:MessageID>
  <w:To e:mustUnderstand="true">urn:schemas-xmlsoap-org:ws:2005:04:discovery</w:To>
  <w:Action e:mustUnderstand="true">http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</w:Action>
 </e:Header>
 <e:Body><d:Probe><d:Types>dn:NetworkVideoTransmitter</d:Types></d:Probe></e:Body>
</e:Envelope>`,
    'utf8'
  );

const firstTag = (xml: string, tag: string): string | null =>
  new RegExp(`<[^>]*${tag}[^>]*>([^<]+)<`, 'i').exec(xml)?.[1]?.trim() ?? null;

/** Scopes carry `onvif://www.onvif.org/name/TC71` style values. */
const scopeValue = (scopes: string, key: string): string | null =>
  new RegExp(`${key}/([^\\s]+)`, 'i').exec(scopes)?.[1]?.replace(/%20/g, ' ') ?? null;

/**
 * Turns one ProbeMatch into a camera.
 *
 * Exported so it can be tested against a real reply — the one captured from the
 * TC71 at 192.168.2.205 — without a socket.
 */
export const parseProbeMatch = (xml: string, fromAddress: string): DiscoveredCamera | null => {
  const xaddrs = firstTag(xml, 'XAddrs');
  if (!xaddrs) return null;

  // A camera may advertise several transports; the first HTTP one is the
  // device service.
  const xaddr = xaddrs.split(/\s+/).find((value) => value.startsWith('http')) ?? xaddrs.split(/\s+/)[0];
  if (!xaddr) return null;

  const scopes = firstTag(xml, 'Scopes') ?? '';

  let address = fromAddress;
  try {
    address = new URL(xaddr).hostname;
  } catch {
    // Keep the datagram's source address: it is where the camera actually is,
    // even when it advertises a malformed URL.
  }

  return {
    xaddr,
    address,
    manufacturer: scopeValue(scopes, 'manufacturer') ?? scopeValue(scopes, 'name'),
    model: scopeValue(scopes, 'hardware') ?? scopeValue(scopes, 'model'),
  };
};

const toInt = (ip: string): number => ip.split('.').reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;

const toDotted = (value: number): string =>
  [value >>> 24, (value >>> 16) & 255, (value >>> 8) & 255, value & 255].join('.');

/** Mask length from a dotted netmask: 255.255.255.0 → 24. */
const prefixLength = (netmask: string): number => (toInt(netmask).toString(2).match(/1/g) ?? []).length;

export interface ScanPlan {
  network: ScannedNetwork;
  /** Empty when the network was skipped. */
  addresses: string[];
}

/**
 * What this machine's IPv4 interfaces mean for a scan: which networks, how many
 * addresses each, and which were too large to sweep.
 *
 * **The skipped ones are returned, not dropped.** They used to be silently
 * `continue`d, so a machine on a flat /16 produced an empty address list, and
 * the caller then reported "this device isn't on a network we can scan" — which
 * reads as "you have no network" to someone who plainly does, on exactly the
 * large networks most likely to hold twenty cameras.
 *
 * Capped because a /16 is 65k probes, which is a denial of service against our
 * own machine rather than a scan.
 *
 * Exported for testing from a plain interface object, with no sockets involved.
 */
export const planScan = (interfaces: ReturnType<typeof networkInterfaces>): ScanPlan[] => {
  const plans = new Map<string, ScanPlan>();

  for (const [name, entries] of Object.entries(interfaces)) {
    // Container and VM bridges are skipped silently, not reported: a camera
    // cannot be on one, so naming them would be noise in the very sentence that
    // exists to make the result legible.
    const virtual = ONVIF.virtualInterfacePrefixes.some((prefix) => name.toLowerCase().startsWith(prefix));
    if (virtual) continue;

    for (const entry of entries ?? []) {
      if (entry.family !== 'IPv4' || entry.internal) continue;

      const mask = toInt(entry.netmask);
      const base = toInt(entry.address) & mask;
      const size = (~mask >>> 0) + 1;

      if (size < 2) continue;

      const cidr = `${toDotted(base)}/${prefixLength(entry.netmask)}`;
      if (plans.has(cidr)) continue;

      // Usable hosts: the network and broadcast addresses are not probed.
      const hosts = size - 2;

      if (size > ONVIF.maxSweepHosts) {
        plans.set(cidr, { network: { cidr, hosts, skipped: 'too-large' }, addresses: [] });
        continue;
      }

      const addresses: string[] = [];
      for (let offset = 1; offset < size - 1; offset++) addresses.push(toDotted((base + offset) >>> 0));

      plans.set(cidr, { network: { cidr, hosts }, addresses });
    }
  }

  return [...plans.values()];
};

/**
 * Sends one probe to the multicast group and one to every host on the local
 * subnet, then collects replies.
 *
 * **The reply window starts when the last probe has left the socket**, not when
 * the first one does. This is the bug that made the whole feature look broken:
 * Node serializes sends on a single UDP socket and each probe to an address with
 * no ARP entry waits on neighbour resolution, so a /24 sweep runs past a
 * four-second window. Closing the socket on a timer started at the beginning
 * cancelled the remaining probes — 194 of 255 sent — and the one camera on this
 * network answers at .205, whose probe was among the cancelled 61. A longer
 * fixed timer would not fix it; it would move the race.
 */
const discoverOnvifCameras = async (
  targets: string[],
  replyWindowMs: number = ONVIF.replyWindowMs
): Promise<DiscoveredCamera[]> =>
  new Promise((resolve) => {
    const socket = createSocket({ type: 'udp4', reuseAddr: true });
    const found = new Map<string, DiscoveredCamera>();
    let settled = false;

    // Bounds the whole scan, sends included, so slow neighbour resolution ends
    // the scan instead of hanging the screen waiting on it.
    const ceiling = setTimeout(() => finish(), ONVIF.maxScanMs);

    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(ceiling);
      try {
        socket.close();
      } catch {
        // Already closed.
      }
      resolve([...found.values()]);
    };

    socket.on('message', (data, remote) => {
      const xml = data.toString('utf8');
      if (!xml.includes('ProbeMatch')) return;

      const camera = parseProbeMatch(xml, remote.address);
      // Keyed by address: a camera answering both the multicast and its own
      // unicast probe must appear once.
      if (camera) found.set(camera.address, camera);
    });

    /**
     * Socket errors are **not** fatal, and treating them as fatal was a real
     * bug: sweeping a subnet always touches addresses with nothing on them, one
     * ICMP unreachable raises `error` here, and aborting on the first one
     * returned an empty scan on a network that had a camera on it. The scan
     * runs to its window and reports whatever answered.
     */
    socket.on('error', () => undefined);

    socket.bind(() => {
      try {
        socket.setBroadcast(true);
        socket.setMulticastTTL(ONVIF.multicastTtl);
      } catch {
        // Multicast may be unavailable; the unicast sweep is the part that
        // usually finds anything anyway.
      }

      const message = probeMessage();
      // Per-send failures are expected for unused addresses and are ignored for
      // the same reason as socket errors. Resolving rather than rejecting keeps
      // one dead address from cutting the sweep short.
      const send = (address: string) =>
        new Promise<void>((sent) => socket.send(message, ONVIF.port, address, () => sent()));

      void Promise.all([ONVIF.multicastAddress, ...targets].map(send)).then(() => {
        if (settled) return;
        setTimeout(finish, replyWindowMs);
      });
    });
  });

/**
 * The `CameraDiscoveryPort` implementation.
 *
 * Reports the networks alongside the cameras, because "found 1" means nothing
 * without "out of 254 addresses on 192.168.2.0/24" — that is the difference
 * between a user believing the scan worked and believing the app is broken.
 *
 * The one failure worth reporting as a failure is having no network at all. A
 * network too large to sweep is a **successful** scan that searched nothing, and
 * says so through `skipped` — reporting it as an error would tell someone with a
 * large flat network that they have no network (Contract 2 rule 2).
 */
export const createOnvifDiscovery = (): CameraDiscoveryPort => ({
  async discover(): Promise<Result<CameraScan>> {
    const plans = planScan(networkInterfaces());

    if (plans.length === 0) {
      return err(
        domainError(
          'unknown',
          "This device isn't on a network we can scan. Connect it to the same network as your cameras.",
          'no usable IPv4 interface'
        )
      );
    }

    const networks: ScannedNetwork[] = plans.map((plan) => plan.network);
    const targets = plans.flatMap((plan) => plan.addresses);

    // Multicast still goes out even when every network was skipped: it costs one
    // datagram and is the only thing that can find a camera on a network we
    // refused to sweep.
    return ok({ cameras: await discoverOnvifCameras(targets), networks });
  },
});
