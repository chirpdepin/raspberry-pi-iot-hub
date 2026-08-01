import type { Camera } from '../../domain/camera';

import type { CameraListPorts } from './contract';

/**
 * The configured cameras, each marked with whether it is actually recording.
 *
 * The persisted record is the source of truth for *which* cameras exist; the
 * container runtime is the source of truth for *whether* each is running. A
 * camera whose container has stopped still appears here, marked offline —
 * dropping it would make a failure look like a deletion, and the user would
 * have no way to tell that a camera they set up has quietly stopped.
 */
export const handleCameraList = async (ports: CameraListPorts): Promise<Camera[]> => {
  const [records, running] = await Promise.all([ports.records.all(), ports.state.running()]);
  const live = new Set(running);

  return records.map((camera) => ({ ...camera, online: live.has(camera.id) }));
};
