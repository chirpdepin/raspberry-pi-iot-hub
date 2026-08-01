import { describe, expect, it } from 'vitest';

import { parseProbeMatch, planScan } from './onvif-discovery';

/**
 * The reply the TC71 at 192.168.2.205 actually sent, trimmed to the elements
 * the parser reads. Using a real capture rather than a hand-written fixture is
 * the point: a fixture written from the spec would have agreed with a parser
 * written from the same spec, and neither would have told us whether this
 * camera works.
 */
const TC71_PROBE_MATCH = `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://www.w3.org/2003/05/soap-envelope"
 xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery">
 <SOAP-ENV:Body>
  <d:ProbeMatches>
   <d:ProbeMatch>
    <d:Types>dn:NetworkVideoTransmitter</d:Types>
    <d:Scopes>onvif://www.onvif.org/type/video_encoder onvif://www.onvif.org/name/TC71 onvif://www.onvif.org/hardware/TC71 onvif://www.onvif.org/location/country/china</d:Scopes>
    <d:XAddrs>http://192.168.2.205:2020/onvif/device_service</d:XAddrs>
    <d:MetadataVersion>1</d:MetadataVersion>
   </d:ProbeMatch>
  </d:ProbeMatches>
 </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;

const iface = (address: string, netmask: string, internal = false) => ({
  address,
  netmask,
  family: 'IPv4' as const,
  mac: '00:00:00:00:00:00',
  internal,
  cidr: null,
});

describe('parseProbeMatch', () => {
  it('reads the service address from a real camera reply', () => {
    const camera = parseProbeMatch(TC71_PROBE_MATCH, '192.168.2.205');

    expect(camera?.xaddr).toBe('http://192.168.2.205:2020/onvif/device_service');
  });

  /**
   * The address comes from the advertised URL, not the datagram, because a
   * camera behind a non-standard port advertises the port too — 2020 here, not
   * the 80 a guess would have used.
   */
  it('takes the address from the advertised URL', () => {
    expect(parseProbeMatch(TC71_PROBE_MATCH, '10.0.0.1')?.address).toBe('192.168.2.205');
  });

  it('reads the name out of the ONVIF scopes', () => {
    const camera = parseProbeMatch(TC71_PROBE_MATCH, '192.168.2.205');

    expect(camera?.manufacturer).toBe('TC71');
    expect(camera?.model).toBe('TC71');
  });

  it('falls back to the datagram source when the advertised URL is malformed', () => {
    const broken = TC71_PROBE_MATCH.replace('http://192.168.2.205:2020/onvif/device_service', 'not a url');

    expect(parseProbeMatch(broken, '192.168.2.205')?.address).toBe('192.168.2.205');
  });

  it('ignores a reply with no service address, rather than inventing one', () => {
    const noXaddrs = TC71_PROBE_MATCH.replace(/<d:XAddrs>.*<\/d:XAddrs>/, '');

    expect(parseProbeMatch(noXaddrs, '192.168.2.205')).toBeNull();
  });
});

describe('planScan', () => {
  it('enumerates every host on a /24, minus network and broadcast', () => {
    const [plan] = planScan({ eth0: [iface('192.168.2.36', '255.255.255.0')] });

    expect(plan?.network).toEqual({ cidr: '192.168.2.0/24', hosts: 254 });
    expect(plan?.addresses).toHaveLength(254);
    expect(plan?.addresses[0]).toBe('192.168.2.1');
    expect(plan?.addresses.at(-1)).toBe('192.168.2.254');
  });

  it('includes the address a real camera was found on', () => {
    const [plan] = planScan({ eth0: [iface('192.168.2.36', '255.255.255.0')] });

    // The bug this guards: a truncated sweep that stopped at 194 of 255 missed
    // .205 entirely and reported a network with no cameras.
    expect(plan?.addresses).toContain('192.168.2.205');
  });

  /**
   * Reported, not dropped. Silently skipping it made the caller say "this device
   * isn't on a network we can scan" — which reads as "you have no network" to
   * someone on exactly the kind of large flat network that holds twenty cameras.
   */
  it('marks a network too large to sweep instead of discarding it', () => {
    const [plan] = planScan({ eth0: [iface('10.0.5.7', '255.255.0.0')] });

    expect(plan?.network).toEqual({ cidr: '10.0.0.0/16', hosts: 65_534, skipped: 'too-large' });
    expect(plan?.addresses).toEqual([]);
  });

  it('skips loopback, which has no cameras on it', () => {
    expect(planScan({ lo: [iface('127.0.0.1', '255.0.0.0', true)] })).toEqual([]);
  });

  it('reports nothing at all when there is no IPv4 interface', () => {
    expect(planScan({})).toEqual([]);
  });

  /**
   * Measured on the machine this was written on: Docker alone contributed seven
   * networks, six of them /16s. Reporting those would have warned the user seven
   * times about networks they have never heard of, burying the one line about
   * their actual network.
   */
  it('ignores container and VM bridges, which cannot hold a camera', () => {
    const plans = planScan({
      eth0: [iface('192.168.2.36', '255.255.255.0')],
      docker0: [iface('172.17.0.1', '255.255.0.0')],
      'br-9f2c1a': [iface('172.20.0.1', '255.255.0.0')],
      virbr0: [iface('192.168.122.1', '255.255.255.0')],
    });

    expect(plans.map((plan) => plan.network.cidr)).toEqual(['192.168.2.0/24']);
  });

  it('counts a network once when two interfaces sit on it', () => {
    const plans = planScan({
      eth0: [iface('192.168.2.36', '255.255.255.0')],
      wlan0: [iface('192.168.2.44', '255.255.255.0')],
    });

    expect(plans).toHaveLength(1);
  });

  it('handles a /25, so the mask is read rather than assumed', () => {
    const [plan] = planScan({ eth0: [iface('192.168.2.200', '255.255.255.128')] });

    expect(plan?.network).toEqual({ cidr: '192.168.2.128/25', hosts: 126 });
    expect(plan?.addresses).toHaveLength(126);
  });
});
