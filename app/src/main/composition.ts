import { shell } from 'electron';

import { createDockerRuntime } from './adapters/container/docker-runtime';
import { createHostInfo } from './adapters/discovery/host-info';
import { createRadioDiscovery } from './adapters/discovery/radio-discovery';
import { createPaths } from './adapters/paths/paths';
import type { IpcDependencies } from './ipc/register';

/**
 * Builds the real dependency graph, with **no side effects**.
 *
 * Separated from index.ts so tests can wire the genuine adapters and use cases
 * without index.ts's app.whenReady() also opening a window. Importing the
 * composition should never start the application.
 *
 * Contract 1 (D): this and index.ts are the only files naming concrete types.
 */
export const buildDependencies = (): IpcDependencies => {
  const paths = createPaths(process.platform);

  const containerRuntime = createDockerRuntime({
    platform: process.platform,
    openExternal: async (url) => shell.openExternal(url),
  });

  return {
    hostCapabilities: {
      hostInfo: createHostInfo(),
      radios: createRadioDiscovery(paths),
      // host-capabilities wants a boolean pair; docker-ensure wants the
      // three-state view. Adapted at the seam rather than widening either port
      // to satisfy both (Contract 1 I).
      containerRuntime: {
        async status() {
          const status = await containerRuntime.status();
          return {
            installed: status.state !== 'missing',
            running: status.state === 'ready',
            version: status.version,
          };
        },
      },
    },
    docker: { runtime: containerRuntime },
  };
};
