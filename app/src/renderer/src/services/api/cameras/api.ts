import type {
  CameraAvailabilityPayload,
  CameraPayload,
  CapacityPayload,
  DiscoveredCameraPayload,
  IpcResult,
} from '@shared/ipc';

/** Transport layer — plain functions, no React (Contract 5). */
export const camerasApi = {
  discover: (): Promise<IpcResult<DiscoveredCameraPayload[]>> => window.chirpHub.discoverCameras(),
  availability: (): Promise<CameraAvailabilityPayload> => window.chirpHub.getCameraAvailability(),
  add: (camera: DiscoveredCameraPayload): Promise<IpcResult<{ camera: CameraPayload }>> =>
    window.chirpHub.addCamera(camera),
  list: (): Promise<CameraPayload[]> => window.chirpHub.listCameras(),
  remove: (input: { id: string; keepRecordings: boolean }): Promise<IpcResult<void>> =>
    window.chirpHub.removeCamera(input),
  capacity: (): Promise<CapacityPayload> => window.chirpHub.getCameraCapacity(),
  open: (id: string): Promise<IpcResult<void>> => window.chirpHub.openCamera(id),
};
