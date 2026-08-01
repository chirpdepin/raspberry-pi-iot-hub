import { profileFor, type DiscoveredCamera } from '../../domain/camera';

import type { CameraDiscoverPorts } from './contract';

/** ONVIF WS-Discovery is multicast; anything not answering in this window is not going to. */
const DISCOVERY_TIMEOUT_MS = 5_000;

export interface DiscoveredCameraWithDefaults extends DiscoveredCamera {
  /** Pre-filled from the vendor registry so the user never types an RTSP path. */
  suggestedRtspPath: string;
  suggestedOnvifPort: number;
}

/**
 * Finds cameras on the local network and pre-fills what can be inferred.
 *
 * Contract 2 rule 3: the RTSP path and ONVIF port come from the vendor profile
 * registry, so they sit under Advanced rather than being asked for.
 */
export const handleCameraDiscover = async (
  ports: CameraDiscoverPorts,
  timeoutMs: number = DISCOVERY_TIMEOUT_MS
): Promise<DiscoveredCameraWithDefaults[]> => {
  const found = await ports.discovery.discover(timeoutMs);

  return found.map((camera) => {
    const profile = profileFor(camera.manufacturer, camera.model);

    return {
      ...camera,
      // The sub-stream is the default: it is lower resolution, far cheaper to
      // decode for motion detection, and much more likely to be H.264 rather
      // than H.265 which the Twin cannot record.
      suggestedRtspPath: profile.subPath,
      suggestedOnvifPort: profile.onvifPort,
    };
  });
};
