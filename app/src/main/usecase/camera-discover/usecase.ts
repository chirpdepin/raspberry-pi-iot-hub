import { ok, type Result } from '../../domain/errors';
import { cameraLabel, type DiscoveredCamera, type ScannedNetwork } from '../../domain/camera';

import type { CameraDiscoverPorts } from './contract';

export interface DiscoveredCameraView extends DiscoveredCamera {
  /** A friendly name, so the list is readable before anything is set up. */
  label: string;
  /**
   * True when this camera already has a Twin. The row then opens it instead of
   * offering to set it up again — the same camera set up twice is two
   * containers fighting over one stream.
   */
  alreadyAdded: boolean;
}

export interface CameraScanView {
  cameras: DiscoveredCameraView[];
  /** What was searched, so the screen can justify the number it is showing. */
  networks: ScannedNetwork[];
}

/**
 * Finds cameras on the local network, marks the ones already set up, and passes
 * on what was actually searched.
 *
 * **No longer gated on the Twin image.** Scanning used to call `images.ensure()`
 * first, on the reasoning that discovery ran inside a Twin container — so with
 * the image unpublished, every scan failed before a single packet was sent, and
 * the screen blamed the network. Discovery runs in this process now and needs
 * nothing installed, so a scan works on a machine that has never run a
 * container. Finding your cameras is useful on its own: it proves they are
 * powered on and reachable.
 *
 * **No vendor RTSP registry either.** This used to attach a guessed stream path
 * and ONVIF port from a table of manufacturers. The Twin resolves both itself
 * from the camera, and a guess of ours that disagreed would be a bug the user
 * would have to discover by watching recording fail.
 *
 * **The networks come back untouched.** Discovery reports facts; whether "1 of
 * 254 addresses on 192.168.2.0/24" is reassuring or alarming is a sentence for
 * the view to write, not a judgement for this layer to make.
 */
export const handleCameraDiscover = async (ports: CameraDiscoverPorts): Promise<Result<CameraScanView>> => {
  const found = await ports.discovery.discover();
  if (!found.ok) return found;

  const configured = new Set(await ports.configured.addresses());

  return ok({
    networks: found.value.networks,
    cameras: found.value.cameras.map((camera) => ({
      ...camera,
      label: cameraLabel(camera),
      // A camera added without a scan has an empty address, so it can never
      // match here — which is honest: we do not know which camera it is until
      // the user configures it in the Twin.
      alreadyAdded: camera.address !== '' && configured.has(camera.address),
    })),
  });
};
