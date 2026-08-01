import { err, ok, type Result } from '../../domain/errors';

import type { CameraRemovePorts } from './contract';

/**
 * Removes a camera.
 *
 * `keepRecordings` defaults to true. Deleting a container is reversible — the
 * camera can be added again in a minute — but deleting recordings is not, and a
 * user removing a camera is usually reorganising rather than discarding
 * evidence. The confirmation dialog names exactly what will go.
 */
export const handleCameraRemove = async (
  ports: CameraRemovePorts,
  id: string,
  options: { keepRecordings?: boolean } = {}
): Promise<Result<void>> => {
  const removed = await ports.containers.remove(id);
  if (!removed.ok) return err(removed.error);

  if (options.keepRecordings ?? true) {
    return ok(undefined);
  }

  return ports.containers.purgeData(id);
};
