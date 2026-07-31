import type { AppInfo, DockerStatus, HostDetails, IpcResult } from '@shared/ipc';

/**
 * Transport layer — plain functions, no React.
 *
 * Contract 5 layering: API → Cache → Business → View. This is the API layer; it
 * knows only how to reach main. Everything above it is unaware that IPC exists,
 * which is what would let this be swapped for HTTP if the app ever managed a
 * remote hub.
 */

export const hostApi = {
  getAppInfo: (): Promise<AppInfo> => window.chirpHub.getAppInfo(),
  getHostDetails: (): Promise<HostDetails> => window.chirpHub.getHostDetails(),
  getDockerStatus: (): Promise<DockerStatus> => window.chirpHub.getDockerStatus(),
  installDocker: (): Promise<IpcResult<void>> => window.chirpHub.installDocker(),
};
