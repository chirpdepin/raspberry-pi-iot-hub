import { app, ipcMain } from 'electron';

import {
  IPC,
  type AppInfo,
  type DockerStatus,
  type GatewayRegisterInput,
  type HostCapabilities,
  type LnsCredentialsPayload,
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

  ipcMain.handle(IPC.hostDetails, async () => {
    const { host, capabilities } = await handleHostCapabilities(deps.hostCapabilities);
    return { host, capabilities };
  });
};
