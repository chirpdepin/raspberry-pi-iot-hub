import { describe, expect, it } from 'vitest';

import { domainError, err, ok } from '../../domain/errors';

import type { CameraDiscoverPorts } from './contract';
import { handleCameraDiscover } from './usecase';

const ports = (manufacturer: string | null, model: string | null): CameraDiscoverPorts => ({
  discovery: {
    discover: async () => [
      { xaddr: 'http://192.168.2.40/onvif/device_service', address: '192.168.2.40', manufacturer, model },
    ],
  },
  runtime: { ensure: async () => ok('lens-twin:1.0.0') },
});

/** Unwraps a successful scan, failing loudly if it was not one. */
const camerasFrom = async (input: CameraDiscoverPorts) => {
  const result = await handleCameraDiscover(input);
  if (!result.ok) throw new Error(`expected a successful scan: ${result.error.message}`);
  return result.value;
};

describe('camera-discover', () => {
  it('pre-fills the RTSP path from the vendor registry', async () => {
    const [camera] = await camerasFrom(ports('HiLook', 'IPC-B180Ha'));

    // The user must never have to type an RTSP path; it belongs under Advanced.
    expect(camera?.suggestedRtspPath).toBe('/Streaming/Channels/102');
  });

  it('falls back to a generic ONVIF path for an unknown vendor', async () => {
    const [camera] = await camerasFrom(ports('Acme', 'Unknown-1'));

    expect(camera?.suggestedRtspPath).toBeTruthy();
  });

  it('defaults to the sub-stream', async () => {
    const [camera] = await camerasFrom(ports('Reolink', 'RLC-810A'));

    // The sub-stream is lower resolution, far cheaper to decode for motion
    // detection, and much more likely to be H.264 rather than H.265 which the
    // Twin cannot record.
    expect(camera?.suggestedRtspPath).toBe('/h264Preview_01_sub');
  });

  it('uses the vendor non-standard ONVIF port where one applies', async () => {
    const [camera] = await camerasFrom(ports('TP-Link', 'Tapo C200'));

    expect(camera?.suggestedOnvifPort).toBe(2020);
  });

  /**
   * The defect this Result exists for. The camera software is not installed, so
   * no scan can run — reporting that as "no cameras found" sends the user to
   * look at their cameras, which are fine.
   */
  it('reports that the camera software is missing rather than an empty network', async () => {
    const result = await handleCameraDiscover({
      ...ports('HiLook', 'IPC-B180Ha'),
      runtime: { ensure: async () => err<string>(domainError('unknown', 'Camera software is not installed yet.')) },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('not installed');
  });

  it('does not scan at all when the camera software is missing', async () => {
    let scanned = false;

    await handleCameraDiscover({
      discovery: {
        discover: async () => {
          scanned = true;
          return [];
        },
      },
      runtime: { ensure: async () => err<string>(domainError('unknown', 'nope')) },
    });

    expect(scanned).toBe(false);
  });

  it('an empty list means an empty network, and is a success', async () => {
    const result = await handleCameraDiscover({
      discovery: { discover: async () => [] },
      runtime: { ensure: async () => ok('lens-twin:1.0.0') },
    });

    expect(result).toEqual({ ok: true, value: [] });
  });
});