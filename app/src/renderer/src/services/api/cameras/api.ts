import type {
  PendingCameraPayload,
  CameraPayload,
  CameraScanPayload,
  CapacityPayload,
  DiscoveredCameraPayload,
  IpcResult,
} from '@shared/ipc';

/** Transport layer — plain functions, no React (Contract 5). */
export const camerasApi = {
  pending: (): Promise<PendingCameraPayload | null> => window.chirpHub.getPendingCamera(),
  cancelPending: (): Promise<void> => window.chirpHub.cancelPendingCamera(),
  acknowledgePending: (): Promise<void> => window.chirpHub.acknowledgePendingCamera(),
  discover: (): Promise<IpcResult<CameraScanPayload>> => window.chirpHub.discoverCameras(),
  add: (camera?: DiscoveredCameraPayload): Promise<IpcResult<{ camera: CameraPayload }>> =>
    window.chirpHub.addCamera(camera),
  list: (): Promise<CameraPayload[]> => window.chirpHub.listCameras(),
  remove: (input: { id: string; keepRecordings: boolean }): Promise<IpcResult<void>> =>
    window.chirpHub.removeCamera(input),
  capacity: (): Promise<CapacityPayload> => window.chirpHub.getCameraCapacity(),
  open: (id: string): Promise<IpcResult<void>> => window.chirpHub.openCamera(id),
};
