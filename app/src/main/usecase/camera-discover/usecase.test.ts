import { describe, expect, it, vi } from 'vitest';

import { domainError, err, ok } from '../../domain/errors';
import type { DiscoveredCamera } from '../../domain/camera';

import type { CameraDiscoverPorts } from './contract';
import { handleCameraDiscover } from './usecase';

const camera = (address: string, model: string | null = null): DiscoveredCamera => ({
  xaddr: `http://${address}/onvif/device_service`,
  address,
  manufacturer: null,
  model,
});

const ports = (found: DiscoveredCamera[], configured: string[] = []): CameraDiscoverPorts => ({
  discovery: { discover: async () => ok(found) },
  configured: { addresses: async () => configured },
});

describe('camera-discover', () => {
  it('returns what the scan found', async () => {
    const result = await handleCameraDiscover(ports([camera('192.168.2.205', 'TC71')]));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
    expect(result.value[0]?.address).toBe('192.168.2.205');
  });

  it('labels a camera by its model, so the list reads before anything is set up', async () => {
    const result = await handleCameraDiscover(ports([camera('192.168.2.205', 'TC71')]));

    expect(result.ok && result.value[0]?.label).toBe('TC71');
  });

  it('falls back to the address when the camera reports no model', async () => {
    const result = await handleCameraDiscover(ports([camera('192.168.2.205')]));

    expect(result.ok && result.value[0]?.label).toBe('192.168.2.205');
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
    expect(result.value[0]?.alreadyAdded).toBe(true);
    expect(result.value[1]?.alreadyAdded).toBe(false);
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
    const discover = vi.fn(async () => ok([camera('192.168.2.205')]));

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
    expect(result.ok && result.value).toEqual([]);
  });
});
