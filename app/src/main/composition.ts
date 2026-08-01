import { shell } from 'electron';

import { domainError, err } from './domain/errors';

import { createChirpGatewayClient } from './adapters/chirp/gateway-client';
import { readZipEntries } from './adapters/chirp/zip';
import { createDockerRuntime } from './adapters/container/docker-runtime';
import { createConcentratorDiscovery } from './adapters/discovery/concentrator';
import { createHostInfo } from './adapters/discovery/host-info';
import { createRadioDiscovery } from './adapters/discovery/radio-discovery';
import { createPaths } from './adapters/paths/paths';
import { createZigbee2MqttClient } from './adapters/mqtt/zigbee2mqtt-client';
import { createZigbeeService } from './adapters/mqtt/zigbee-service';
import { createPrivilegedRunner } from './adapters/privileged/privileged-runner';
import { createSessionStore } from './adapters/store/session';
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
  const privileged = createPrivilegedRunner();

  const zigbeeService = createZigbeeService({
    paths,
    startService: (name) => privileged.startService(name),
    // Service state is read via the same systemd the units use; a stub here
    // would report "running" for a stack that is not.
    isServiceActive: async () => false,
  });

  const zigbee2mqtt = createZigbee2MqttClient();

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
    gatewayDetect: { concentrator: createConcentratorDiscovery(paths) },
    gatewayRegister: {
      chirp: createChirpGatewayClient({ auth: createSessionStore(), unzip: readZipEntries }),
    },
    gatewayProvision: {
      privileged,
      paths: { credentialsDir: () => paths.lorawanCredentialsDir() },
    },
    zigbeeStart: { service: zigbeeService },
    zigbeePermitJoin: { zigbee: zigbee2mqtt.permitJoin },
    zigbeeDeviceList: {
      zigbee: {
        // The coordinator is known from the radio inventory before Zigbee2MQTT
        // is running, so it comes from the service adapter rather than MQTT.
        coordinator: () => zigbeeService.coordinator(),
        devices: () => zigbee2mqtt.zigbee.devices(),
        isRunning: () => zigbee2mqtt.zigbee.isRunning(),
      },
      chirp: {
        // Provisioned ids come from Chirp; until the device API client exists
        // this reports none, which renders as "paired locally, not yet in
        // Chirp" — the honest state, not a false positive.
        provisionedIds: async () => [],
      },
    },
    zigbeeLinkChirp: {
      chirp: {
        ensureConnection: async () =>
          err(
            domainError(
              'unknown',
              'Connecting Zigbee devices to Chirp needs the Chirp device API, which is not wired up yet.'
            )
          ),
        provisionDevice: async () => err(domainError('unknown', 'Not available yet.')),
      },
      payloads: zigbee2mqtt.payloads,
    },
  };
};
