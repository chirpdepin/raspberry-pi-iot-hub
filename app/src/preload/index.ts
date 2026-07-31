import { contextBridge, ipcRenderer } from 'electron';

import { IPC, type ChirpHubApi } from '../shared/ipc';

/**
 * The only bridge between main and the renderer.
 *
 * Contract 1 (S, D): the renderer gets a small typed API, never raw
 * `ipcRenderer`. Exposing `ipcRenderer` would let any renderer code invoke any
 * channel, which is both a security hole and a layering violation — the
 * renderer would then depend on main's internals rather than on a contract.
 *
 * Channel names come from shared/ipc.ts (Contract 4) so a rename is a compile
 * error at both ends rather than a silent runtime no-op.
 */
const api: ChirpHubApi = {
  getAppInfo: () => ipcRenderer.invoke(IPC.appInfo),
  getHostCapabilities: () => ipcRenderer.invoke(IPC.hostCapabilities),
  getHostDetails: () => ipcRenderer.invoke(IPC.hostDetails),
  getDockerStatus: () => ipcRenderer.invoke(IPC.dockerStatus),
  installDocker: () => ipcRenderer.invoke(IPC.dockerInstall),
};

contextBridge.exposeInMainWorld('chirpHub', api);
