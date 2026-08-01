import { err, ok, type Result } from '../../domain/errors';
import { cameraLabel, twinIdFor, type DiscoveredCamera } from '../../domain/camera';
import { TWIN_CONTAINER_PREFIX, TWIN_SEED_USERNAME } from '../../config/images';

import type { CameraAddPorts, CameraAddResult } from './contract';

/**
 * Sets a camera up: gets the camera software, gives it a port, starts it.
 *
 * **This is the whole job, and it used to be much more.** The old version asked
 * for credentials, pulled a frame to prove them, asked for a recording mode and
 * a retention period, registered the Twin with Lens, and wrote all of it into a
 * config.json before first boot. Every one of those is a screen the Twin already
 * has, so the user answered the same questions twice and the app owned a copy of
 * settings it did not own. What the user actually needs from us is the part they
 * cannot do themselves — installing and running the thing.
 *
 * The Twin boots on its defaults with recording off, and the user turns it on
 * when they have chosen what they want recorded.
 */
export const handleCameraAdd = async (
  ports: CameraAddPorts,
  camera: DiscoveredCamera,
  onProgress?: (step: string) => void
): Promise<Result<CameraAddResult>> => {
  onProgress?.('Downloading camera software…');

  const image = await ports.images.ensure();
  if (!image.ok) return err(image.error);

  // Before the container is created, not after: a Twin that cannot be given a
  // port must fail here with an explanation rather than half-exist.
  const port = await ports.ports.allocate();
  if (!port.ok) return err(port.error);

  onProgress?.('Setting up…');

  const hostPort = port.value;
  const id = twinIdFor(TWIN_CONTAINER_PREFIX, camera.address);
  const seedPassword = ports.secrets.newPassword();

  const created = await ports.containers.createTwin({
    id,
    imageTag: image.value,
    hostPort,
    seedUsername: TWIN_SEED_USERNAME,
    seedPassword,
  });

  if (!created.ok) return err(created.error);

  const record = {
    id,
    displayName: cameraLabel(camera),
    address: camera.address,
    hostPort,
    firstLoginUsername: TWIN_SEED_USERNAME,
    firstLoginPassword: seedPassword,
    online: true,
  };

  // Saved only after the container exists. Recording a camera that failed to
  // start would leave a permanent entry the user cannot fix or remove.
  await ports.records.save(record);

  return ok({ camera: record });
};
