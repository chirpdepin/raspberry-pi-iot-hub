import type { Result } from '../../domain/errors';
import type { CameraDiscoveryPort } from '../camera-add/contract';

/**
 * Ensures the camera software is present before a scan can run.
 *
 * Discovery is performed by the Twin, so there is nothing to ask until its
 * image exists. Keeping this as its own port means the use case can tell "the
 * software is not installed" apart from "your network has no cameras" — two
 * situations that look identical from an empty list and need completely
 * different advice.
 */
export interface DiscoveryRuntimePort {
  /** Resolves the Twin image, downloading it once if needed. */
  ensure(): Promise<Result<string>>;
}

export interface CameraDiscoverPorts {
  discovery: Pick<CameraDiscoveryPort, 'discover'>;
  runtime: DiscoveryRuntimePort;
}
