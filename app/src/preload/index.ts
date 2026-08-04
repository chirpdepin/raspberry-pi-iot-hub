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
  getSystemLoad: () => ipcRenderer.invoke(IPC.systemLoad),
  getDockerStatus: () => ipcRenderer.invoke(IPC.dockerStatus),
  installDocker: (camera) => ipcRenderer.invoke(IPC.dockerInstall, camera ?? null),
  startDocker: () => ipcRenderer.invoke(IPC.dockerStart),
  getPendingCamera: () => ipcRenderer.invoke(IPC.pendingCamera),
  cancelPendingCamera: () => ipcRenderer.invoke(IPC.pendingCameraCancel),
  acknowledgePendingCamera: () => ipcRenderer.invoke(IPC.pendingCameraAck),

  detectGateway: () => ipcRenderer.invoke(IPC.gatewayDetect),
  registerGateway: (input) => ipcRenderer.invoke(IPC.gatewayRegister, input),
  provisionGateway: (credentials) => ipcRenderer.invoke(IPC.gatewayProvision, credentials),

  getZigbeeCoordinator: () => ipcRenderer.invoke(IPC.zigbeeCoordinator),
  startZigbee: (channel) => ipcRenderer.invoke(IPC.zigbeeStart, channel),
  permitZigbeeJoin: (seconds) => ipcRenderer.invoke(IPC.zigbeePermitJoin, seconds),
  stopZigbeeJoin: () => ipcRenderer.invoke(IPC.zigbeeStopJoin),
  getZigbeeDevices: () => ipcRenderer.invoke(IPC.zigbeeDevices),
  linkZigbeeDevice: (input) => ipcRenderer.invoke(IPC.zigbeeLinkChirp, input),

  getSubsystemStatus: () => ipcRenderer.invoke(IPC.subsystemStatus),

  discoverCameras: () => ipcRenderer.invoke(IPC.cameraDiscover),
  addCamera: (camera) => ipcRenderer.invoke(IPC.cameraAdd, camera ?? null),
  listCameras: () => ipcRenderer.invoke(IPC.cameraList),
  removeCamera: (input) => ipcRenderer.invoke(IPC.cameraRemove, input),
  getCameraCapacity: () => ipcRenderer.invoke(IPC.cameraCapacity),
  openCamera: (id) => ipcRenderer.invoke(IPC.cameraOpen, id),
};

contextBridge.exposeInMainWorld('chirpHub', api);
