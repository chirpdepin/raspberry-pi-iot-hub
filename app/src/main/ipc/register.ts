import { app, ipcMain } from 'electron';

import { IPC, type AppInfo, type DockerStatus, type HostCapabilities } from '../../shared/ipc';
import { handleDockerEnsure, handleDockerInstall } from '../usecase/docker-ensure/usecase';
import type { DockerEnsurePorts } from '../usecase/docker-ensure/contract';
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

  ipcMain.handle(IPC.hostDetails, async () => {
    const { host, capabilities } = await handleHostCapabilities(deps.hostCapabilities);
    return { host, capabilities };
  });
};
