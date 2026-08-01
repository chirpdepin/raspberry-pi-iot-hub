import { describe, expect, it, vi } from 'vitest';

import { domainError, err, ok } from '../../domain/errors';
import type { DiscoveredCamera, ScannedNetwork } from '../../domain/camera';

import type { CameraDiscoverPorts } from './contract';
import { handleCameraDiscover } from './usecase';

const camera = (address: string, model: string | null = null): DiscoveredCamera => ({
  xaddr: `http://${address}/onvif/device_service`,
  address,
  manufacturer: null,
  model,
});

const LAN: ScannedNetwork = { cidr: '192.168.2.0/24', hosts: 254 };

const ports = (
  found: DiscoveredCamera[],
  configured: string[] = [],
  networks: ScannedNetwork[] = [LAN]
): CameraDiscoverPorts => ({
  discovery: { discover: async () => ok({ cameras: found, networks }) },
  configured: { addresses: async () => configured },
});

describe('camera-discover', () => {
  it('returns what the scan found', async () => {
    const result = await handleCameraDiscover(ports([camera('192.168.2.205', 'TC71')]));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.cameras).toHaveLength(1);
    expect(result.value.cameras[0]?.address).toBe('192.168.2.205');
  });

  it('labels a camera by its model, so the list reads before anything is set up', async () => {
    const result = await handleCameraDiscover(ports([camera('192.168.2.205', 'TC71')]));

    expect(result.ok && result.value.cameras[0]?.label).toBe('TC71');
  });

  it('falls back to the address when the camera reports no model', async () => {
    const result = await handleCameraDiscover(ports([camera('192.168.2.205')]));

    expect(result.ok && result.value.cameras[0]?.label).toBe('192.168.2.205');
  });

  /**
   * Setting the same camera up twice is two containers fighting over one
   * stream, so the row has to know it already has a Twin.
   */
  it('marks cameras that already have a Twin', async () => {
    const result = await handleCameraDiscover(
      ports([camera('192.168.2.205'), camera('192.168.2.206')], ['192.168.2.205'])
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.cameras[0]?.alreadyAdded).toBe(true);
    expect(result.value.cameras[1]?.alreadyAdded).toBe(false);
  });

  it('passes a scan failure through, so it is never shown as an empty network', async () => {
    const result = await handleCameraDiscover({
      discovery: { discover: async () => err(domainError('unknown', 'No network to scan.')) },
      configured: { addresses: async () => [] },
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.message).toBe('No network to scan.');
  });

  /**
   * The old version called `images.ensure()` before scanning, on the reasoning
   * that discovery ran inside a Twin container. With the image unpublished every
   * scan failed before a packet was sent, and the screen blamed the network.
   */
  it('scans without needing the camera software installed', async () => {
    const discover = vi.fn(async () => ok({ cameras: [camera('192.168.2.205')], networks: [LAN] }));

    const result = await handleCameraDiscover({
      discovery: { discover },
      configured: { addresses: async () => [] },
    });

    expect(discover).toHaveBeenCalledOnce();
    expect(result.ok).toBe(true);
  });

  it('reports an empty network as an empty list rather than a failure', async () => {
    const result = await handleCameraDiscover(ports([]));

    expect(result.ok).toBe(true);
    expect(result.ok && result.value.cameras).toEqual([]);
  });

  /**
   * The whole point of carrying the scope through: "found 1" is indefensible to
   * someone with twenty cameras unless the screen can also say what was looked
   * at.
   */
  it('passes on what was searched, even when nothing answered', async () => {
    const result = await handleCameraDiscover(ports([]));

    expect(result.ok && result.value.networks).toEqual([LAN]);
  });

  it('passes on a network that was too large to search', async () => {
    const tooLarge: ScannedNetwork = { cidr: '10.0.0.0/16', hosts: 65_534, skipped: 'too-large' };
    const result = await handleCameraDiscover(ports([], [], [tooLarge]));

    // A successful scan that searched nothing — not an error. Reporting it as
    // one tells a user with a big flat network that they have no network.
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.networks[0]?.skipped).toBe('too-large');
  });

  /**
   * A camera added without a scan has no address, so it can never be matched
   * against a discovered one. Matching on empty would mark every discovered
   * camera as already set up.
   */
  it('never matches a discovered camera against a record with no address', async () => {
    const result = await handleCameraDiscover(ports([camera('192.168.2.205')], ['']));

    expect(result.ok && result.value.cameras[0]?.alreadyAdded).toBe(false);
  });
});
