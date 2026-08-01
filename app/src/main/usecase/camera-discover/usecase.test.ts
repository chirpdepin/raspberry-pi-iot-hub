import { describe, expect, it } from 'vitest';

import type { CameraDiscoverPorts } from './contract';
import { handleCameraDiscover } from './usecase';

const ports = (manufacturer: string | null, model: string | null): CameraDiscoverPorts => ({
  discovery: {
    discover: async () => [
      { xaddr: 'http://192.168.2.40/onvif/device_service', address: '192.168.2.40', manufacturer, model },
    ],
  },
});

describe('camera-discover', () => {
  it('pre-fills the RTSP path from the vendor registry', async () => {
    const [camera] = await handleCameraDiscover(ports('HiLook', 'IPC-B180Ha'));

    // The user must never have to type an RTSP path; it belongs under Advanced.
    expect(camera?.suggestedRtspPath).toBe('/Streaming/Channels/102');
  });

  it('falls back to a generic ONVIF path for an unknown vendor', async () => {
    const [camera] = await handleCameraDiscover(ports('Acme', 'Unknown-1'));

    expect(camera?.suggestedRtspPath).toBeTruthy();
  });

  it('defaults to the sub-stream', async () => {
    const [camera] = await handleCameraDiscover(ports('Reolink', 'RLC-810A'));

    // The sub-stream is lower resolution, far cheaper to decode for motion
    // detection, and much more likely to be H.264 rather than H.265 which the
    // Twin cannot record.
    expect(camera?.suggestedRtspPath).toBe('/h264Preview_01_sub');
  });

  it('uses the vendor non-standard ONVIF port where one applies', async () => {
    const [camera] = await handleCameraDiscover(ports('TP-Link', 'Tapo C200'));

    expect(camera?.suggestedOnvifPort).toBe(2020);
  });
});
