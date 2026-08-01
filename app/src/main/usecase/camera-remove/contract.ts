import type { Result } from '../../domain/errors';

export interface TwinRemovalPort {
  /** Stops and deletes the container. */
  remove(id: string): Promise<Result<void>>;
  /** Deletes the Twin's config and recordings. */
  purgeData(id: string): Promise<Result<void>>;
}

export interface CameraRemovePorts {
  containers: TwinRemovalPort;
}
