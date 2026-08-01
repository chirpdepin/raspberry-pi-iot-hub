import type {
  CameraConfigPayload,
  CameraPayload,
  CameraProbePayload,
  CapacityPayload,
  DiscoveredCameraPayload,
  IpcResult,
} from '@shared/ipc';

/** Transport layer — plain functions, no React (Contract 5). */
export const camerasApi = {
  discover: (): Promise<IpcResult<DiscoveredCameraPayload[]>> => window.chirpHub.discoverCameras(),
  probe: (config: CameraConfigPayload): Promise<IpcResult<CameraProbePayload>> => window.chirpHub.probeCamera(config),
  add: (config: CameraConfigPayload): Promise<IpcResult<{ camera: CameraPayload }>> =>
    window.chirpHub.addCamera(config),
  list: (): Promise<CameraPayload[]> => window.chirpHub.listCameras(),
  remove: (input: { id: string; keepRecordings: boolean }): Promise<IpcResult<void>> =>
    window.chirpHub.removeCamera(input),
  capacity: (): Promise<CapacityPayload> => window.chirpHub.getCameraCapacity(),
  open: (id: string): Promise<IpcResult<void>> => window.chirpHub.openCamera(id),
};
