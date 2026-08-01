import type { DiscoveredCamera } from '../../domain/camera';
import type { CameraDiscoveryPort } from '../camera-add/contract';

export interface CameraDiscoverPorts {
  discovery: Pick<CameraDiscoveryPort, 'discover'>;
}

export interface DiscoverResult {
  cameras: DiscoveredCamera[];
}
