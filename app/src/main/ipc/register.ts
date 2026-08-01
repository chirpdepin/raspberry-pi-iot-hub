import { app, ipcMain } from 'electron';

import {
  IPC,
  type AppInfo,
  type DockerStatus,
  type GatewayRegisterInput,
  type HostCapabilities,
  type LnsCredentialsPayload,
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

  ipcMain.handle(IPC.hostDetails, async () => {
    const { host, capabilities } = await handleHostCapabilities(deps.hostCapabilities);
    return { host, capabilities };
  });
};
