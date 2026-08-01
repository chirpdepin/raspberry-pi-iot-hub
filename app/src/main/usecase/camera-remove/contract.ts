import type { Result } from '../../domain/errors';

export interface TwinRemovalPort {
  /** Stops and deletes the container. */
  remove(id: string): Promise<Result<void>>;
  /** Deletes the Twin's config and recordings. */
  purgeData(id: string): Promise<Result<void>>;
}

/** Deletes the stored record, so the list cannot outlive the container. */
export interface CameraRecordPort {
  remove(id: string): Promise<void>;
}

export interface CameraRemovePorts {
  containers: TwinRemovalPort;
  records: CameraRecordPort;
}
