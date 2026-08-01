import { err, ok, type Result } from '../../domain/errors';
import { rtspUrl, type CameraConfig } from '../../domain/camera';
import { TWIN_CONTAINER_PREFIX } from '../../config/images';

import type { CameraAddPorts, CameraAddResult } from './contract';

/**
 * Creates a camera Twin.
 *
 * The order matters and is not arbitrary:
 *
 *   1. ensure the image (once, not per camera)
 *   2. generate the Twin Key
 *   3. register with Lens -> bootstrap token, returned EXACTLY ONCE
 *   4. pre-seed config.json with the camera details AND that token
 *   5. start the container
 *
 * The token goes straight from step 3 into step 4 and is never displayed,
 * because it cannot be retrieved again. Showing it to the user would invite
 * them to write it down, and losing it means re-pairing the camera.
 */
export const handleCameraAdd = async (
  ports: CameraAddPorts,
  config: CameraConfig,
  onProgress?: (step: string) => void
): Promise<Result<CameraAddResult>> => {
  onProgress?.('Downloading camera software…');

  const image = await ports.images.ensure();
  if (!image.ok) return err(image.error);

  onProgress?.('Setting up…');

  const twinKey = ports.lens.newTwinKey();
  const registered = await ports.lens.registerTwin({ twinKey, name: config.displayName });
  if (!registered.ok) return err(registered.error);

  // Before the container is created, not after: a Twin that cannot be given a
  // port must fail here with an explanation rather than half-exist.
  const port = await ports.ports.allocate();
  if (!port.ok) return err(port.error);

  const hostPort = port.value;
  const id = `${TWIN_CONTAINER_PREFIX}${twinKey.slice(0, 8)}`;

  onProgress?.('Connecting to your camera…');

  const created = await ports.containers.createTwin({
    id,
    imageTag: image.value,
    hostPort,
    // Matches the Twin's config.json schema.
    config: {
      type: 'ipcamera',
      twin_key: twinKey,
      name: config.displayName,
      bootstrap_token: registered.value.bootstrapToken,
      lens_uri: registered.value.lensUri,
      capture: {
        ipcamera: {
          main_source: rtspUrl(config),
          sub_source: rtspUrl(config),
          onvif: true,
          onvif_xaddr: `http://${config.address}:${config.onvifPort}/onvif/device_service`,
          onvif_username: config.credentials.username,
          onvif_password: config.credentials.password,
        },
      },
      // Motion is the default because continuous recording fills a card fast
      // and most people want events, not eight hours of an empty hallway.
      continuous: config.recording === 'continuous',
      recording: true,
      motion: config.recording === 'motion',
      max_recording_age_days: config.retentionDays,
      retention_age_enabled: true,
    },
  });

  if (!created.ok) return err(created.error);

  onProgress?.('Linking to Chirp…');

  const camera = {
    id,
    displayName: config.displayName,
    address: config.address,
    hostPort,
    recording: config.recording,
    online: true,
  };

  // Saved only after the container exists. Recording a camera that failed to
  // start would leave a permanent entry the user cannot fix or remove.
  await ports.records.save(camera);

  return ok({ camera });
};
