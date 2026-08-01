import { app, ipcMain } from 'electron';

import {
  IPC,
  type AppInfo,
  type DockerStatus,
  type GatewayRegisterInput,
  type HostCapabilities,
  type CameraAvailabilityPayload,
  type DiscoveredCameraPayload,
  type CapacityPayload,
  type LnsCredentialsPayload,
  type SubsystemStatusPayload,
  type ZigbeeLinkInput,
} from '../../shared/ipc';
import type { LorawanRegion } from '../domain/gateway';
import { handleDockerEnsure, handleDockerInstall } from '../usecase/docker-ensure/usecase';
import type { DockerEnsurePorts } from '../usecase/docker-ensure/contract';
import type { GatewayDetectPorts } from '../usecase/gateway-detect/contract';
import { handleGatewayDetect } from '../usecase/gateway-detect/usecase';
import type { GatewayProvisionPorts } from '../usecase/gateway-provision/contract';
import { handleGatewayProvision } from '../usecase/gateway-provision/usecase';
import type { GatewayRegisterPorts } from '../usecase/gateway-register/contract';
import { handleGatewayRegister } from '../usecase/gateway-register/usecase';
import type { HostCapabilitiesPorts } from '../usecase/host-capabilities/contract';
import type { ZigbeeDeviceListPorts } from '../usecase/zigbee-device-list/contract';
import { handleZigbeeDeviceList } from '../usecase/zigbee-device-list/usecase';
import type { ZigbeeLinkChirpPorts } from '../usecase/zigbee-device-link-chirp/contract';
import { handleZigbeeLinkChirp } from '../usecase/zigbee-device-link-chirp/usecase';
import type { ZigbeePermitJoinPorts } from '../usecase/zigbee-permit-join/contract';
import { handleZigbeePermitJoin, handleZigbeeStopJoin } from '../usecase/zigbee-permit-join/usecase';
import type { ZigbeeStartPorts } from '../usecase/zigbee-start/contract';
import { handleZigbeeStart } from '../usecase/zigbee-start/usecase';
import { handleHostCapabilities } from '../usecase/host-capabilities/usecase';
import type { CameraAddPorts } from '../usecase/camera-add/contract';
import type { CameraAvailabilityPorts } from '../usecase/camera-availability/contract';
import { handleCameraAvailability } from '../usecase/camera-availability/usecase';
import { handleCameraAdd } from '../usecase/camera-add/usecase';
import type { CameraDiscoverPorts } from '../usecase/camera-discover/contract';
import { handleCameraDiscover } from '../usecase/camera-discover/usecase';
import type { CameraListPorts } from '../usecase/camera-list/contract';
import { handleCameraList } from '../usecase/camera-list/usecase';
import type { CameraRemovePorts } from '../usecase/camera-remove/contract';
import { handleCameraRemove } from '../usecase/camera-remove/usecase';
import type { CameraOpenPorts } from '../usecase/camera-open/contract';
import { handleCameraOpen } from '../usecase/camera-open/usecase';
import type { CapacityAdvisePorts } from '../usecase/capacity-advise/contract';
import { handleCapacityAdvise } from '../usecase/capacity-advise/usecase';
import type { SubsystemStatusPorts } from '../usecase/subsystem-status/contract';
import { handleSubsystemStatus } from '../usecase/subsystem-status/usecase';

/**
 * One handler per use case — the only main↔renderer surface.
 *
 * Contract 1 (S): a handler translates between the IPC payload and a use case
 * and does nothing else. No business logic lives here, which is why the use
 * cases can be tested without Electron.
 */

export interface IpcDependencies {
  hostCapabilities: HostCapabilitiesPorts;
  docker: DockerEnsurePorts;
  gatewayDetect: GatewayDetectPorts;
  gatewayRegister: GatewayRegisterPorts;
  gatewayProvision: GatewayProvisionPorts;
  zigbeeStart: ZigbeeStartPorts;
  zigbeePermitJoin: ZigbeePermitJoinPorts;
  zigbeeDeviceList: ZigbeeDeviceListPorts;
  zigbeeLinkChirp: ZigbeeLinkChirpPorts;
  subsystemStatus: SubsystemStatusPorts;
  cameraDiscover: CameraDiscoverPorts;
  cameraAdd: CameraAddPorts;
  cameraAvailability: CameraAvailabilityPorts;
  cameraList: CameraListPorts;
  cameraRemove: CameraRemovePorts;
  cameraOpen: CameraOpenPorts;
  capacity: CapacityAdvisePorts;
}

export const registerIpcHandlers = (deps: IpcDependencies): void => {
  ipcMain.handle(IPC.appInfo, (): AppInfo => ({
    name: app.getName(),
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
  }));

  ipcMain.handle(IPC.hostCapabilities, async (): Promise<HostCapabilities> => {
    const { capabilities } = await handleHostCapabilities(deps.hostCapabilities);

    return {
      lorawan: capabilities.lorawan.available,
      zigbee: capabilities.zigbee.available,
      thread: capabilities.thread.available,
      cameras: capabilities.cameras.available,
    };
  });

  ipcMain.handle(IPC.dockerStatus, async (): Promise<DockerStatus> => {
    const { status } = await handleDockerEnsure(deps.docker);

    return {
      installed: status.state !== 'missing',
      running: status.state === 'ready',
      version: status.version,
    };
  });

  ipcMain.handle(IPC.dockerInstall, async () => handleDockerInstall(deps.docker));

  ipcMain.handle(IPC.gatewayDetect, async () => handleGatewayDetect(deps.gatewayDetect));

  ipcMain.handle(IPC.gatewayRegister, async (_event, input: GatewayRegisterInput) =>
    handleGatewayRegister(deps.gatewayRegister, {
      eui: input.eui,
      name: input.name,
      region: input.region as LorawanRegion,
    })
  );

  ipcMain.handle(IPC.gatewayProvision, async (_event, credentials: LnsCredentialsPayload) =>
    handleGatewayProvision(deps.gatewayProvision, credentials)
  );

  ipcMain.handle(IPC.zigbeeCoordinator, async () => deps.zigbeeStart.service.coordinator());

  ipcMain.handle(IPC.zigbeeStart, async (_event, channel?: number) => handleZigbeeStart(deps.zigbeeStart, channel));

  ipcMain.handle(IPC.zigbeePermitJoin, async (_event, seconds?: number) =>
    handleZigbeePermitJoin(deps.zigbeePermitJoin, seconds)
  );

  ipcMain.handle(IPC.zigbeeStopJoin, async () => handleZigbeeStopJoin(deps.zigbeePermitJoin));

  ipcMain.handle(IPC.zigbeeDevices, async () => handleZigbeeDeviceList(deps.zigbeeDeviceList));

  ipcMain.handle(IPC.zigbeeLinkChirp, async (_event, input: ZigbeeLinkInput) =>
    handleZigbeeLinkChirp(deps.zigbeeLinkChirp, input)
  );

  ipcMain.handle(
    IPC.subsystemStatus,
    async (): Promise<SubsystemStatusPayload[]> => handleSubsystemStatus(deps.subsystemStatus)
  );

  ipcMain.handle(IPC.cameraDiscover, async () => handleCameraDiscover(deps.cameraDiscover));

  ipcMain.handle(
    IPC.cameraAvailability,
    async (): Promise<CameraAvailabilityPayload> => handleCameraAvailability(deps.cameraAvailability)
  );

  ipcMain.handle(IPC.cameraAdd, async (_event, camera: DiscoveredCameraPayload) =>
    handleCameraAdd(deps.cameraAdd, camera)
  );

  ipcMain.handle(IPC.cameraList, async () => handleCameraList(deps.cameraList));

  ipcMain.handle(IPC.cameraRemove, async (_event, input: { id: string; keepRecordings: boolean }) =>
    handleCameraRemove(deps.cameraRemove, input.id, { keepRecordings: input.keepRecordings })
  );

  ipcMain.handle(IPC.cameraCapacity, async (): Promise<CapacityPayload> => handleCapacityAdvise(deps.capacity));

  ipcMain.handle(IPC.cameraOpen, async (_event, id: string) => handleCameraOpen(deps.cameraOpen, id));

  ipcMain.handle(IPC.hostDetails, async () => {
    const { host, capabilities } = await handleHostCapabilities(deps.hostCapabilities);
    return { host, capabilities };
  });
};
