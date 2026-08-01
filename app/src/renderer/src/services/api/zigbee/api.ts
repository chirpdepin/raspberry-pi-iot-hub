import type { IpcResult, ZigbeeCoordinatorInfo, ZigbeeDeviceInfo, ZigbeeLinkInput } from '@shared/ipc';

/** Transport layer — plain functions, no React (Contract 5). */
export const zigbeeApi = {
  coordinator: (): Promise<ZigbeeCoordinatorInfo | null> => window.chirpHub.getZigbeeCoordinator(),
  start: (channel?: number): Promise<IpcResult<void>> => window.chirpHub.startZigbee(channel),
  permitJoin: (seconds?: number): Promise<IpcResult<void>> => window.chirpHub.permitZigbeeJoin(seconds),
  stopJoin: (): Promise<IpcResult<void>> => window.chirpHub.stopZigbeeJoin(),
  devices: (): Promise<ZigbeeDeviceInfo[]> => window.chirpHub.getZigbeeDevices(),
  link: (input: ZigbeeLinkInput): Promise<IpcResult<void>> => window.chirpHub.linkZigbeeDevice(input),
};
