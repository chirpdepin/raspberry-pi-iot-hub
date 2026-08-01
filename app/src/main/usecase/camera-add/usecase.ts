import { err, ok, type Result } from '../../domain/errors';
import { cameraLabel, numberedCameraLabel, twinIdFor, type DiscoveredCamera } from '../../domain/camera';
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
 * **The camera is optional, and that is the main route.** Discovery can only
 * ever find some cameras: many have ONVIF switched off, and one on another
 * network is unreachable by any sweep. So `[Add camera]` starts a Twin with no
 * camera attached at all, and the user gives it an address in the Twin's own
 * Camera tab — the same place they would have had to confirm one anyway. A
 * discovered camera is a shortcut that pre-fills the name and lets us recognise
 * it in a later scan, not a precondition.
 *
 * The Twin boots on its defaults with recording off, and the user turns it on
 * when they have chosen what they want recorded.
 */
export const handleCameraAdd = async (
  ports: CameraAddPorts,
  camera?: DiscoveredCamera,
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
  // Seeded by address when we have one, so the same discovered camera cannot
  // quietly get two Twins; by a generated token when we do not.
  const id = twinIdFor(TWIN_CONTAINER_PREFIX, camera?.address ?? ports.secrets.newId());
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
    displayName: camera ? cameraLabel(camera) : numberedCameraLabel(await ports.records.count()),
    // Left empty rather than guessed when there was no scan: the user gives the
    // Twin its address, and a placeholder here would show in the list as fact.
    address: camera?.address ?? '',
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
