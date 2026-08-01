import { randomUUID } from 'node:crypto';

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
import { createPortClaims, createPortProbe } from './adapters/network/port-allocator';
import { createServiceState } from './adapters/system/service-state';
import { createCameraProbe, createLorawanProbe, createZigbeeProbe } from './adapters/status/subsystem-probes';
import { createContainerState, createCredentialsCheck, createTwinInventory } from './adapters/status/inventory';
import { createCameraStore } from './adapters/store/cameras';
import { createTwinRuntime } from './adapters/camera/twin-runtime';
import { createImageStore } from './adapters/images/image-store';
import { IMAGES } from './config/images';
import { handleTwinImageEnsure } from './usecase/twin-image-ensure/usecase';
import { handlePortAllocate } from './usecase/port-allocate/usecase';
import type { IpcDependencies } from './ipc/register';

/**
 * One allocator, shared by every subsystem that needs a host port. Module scope
 * because it depends on nothing built per-composition — and because there must
 * be exactly one, or the reserved-port table is honoured inconsistently
 * (Phase 11 SOLID gate).
 */
const allocatePort = () => handlePortAllocate({ probe: createPortProbe(), claims: createPortClaims() });

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
  const services = createServiceState(process.platform);

  const zigbeeService = createZigbeeService({
    paths,
    startService: (name) => privileged.startService(name),
    // Reading unit state is unprivileged, so it does not go through the
    // privileged runner — a dashboard refresh must never raise a password
    // prompt.
    isServiceActive: (name) => services.isActive(name),
  });

  const zigbee2mqtt = createZigbee2MqttClient();

  const containerRuntime = createDockerRuntime({
    platform: process.platform,
    openExternal: async (url) => shell.openExternal(url),
  });

  const concentrator = createConcentratorDiscovery(paths);

  const images = createImageStore({ paths });

  /**
   * The image tag the runtime should use for discovery and for new Twins.
   *
   * Resolved from the same use case that downloads it, so discovery can never
   * run against a tag that was never loaded.
   */
  let resolvedImageTag = `${IMAGES.twin}:latest`;
  const twinRuntime = createTwinRuntime({ paths, imageTag: () => resolvedImageTag });

  const ensureTwinImage = async (onProgress?: (received: number, total: number) => void) => {
    const result = await handleTwinImageEnsure({ images, arch: () => process.arch }, onProgress);
    if (result.ok) resolvedImageTag = result.value;
    return result;
  };

  const cameraStore = createCameraStore();
  const twinInventory = createTwinInventory();
  const containerState = createContainerState();

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
    gatewayDetect: { concentrator },
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
    cameraDiscover: {
      discovery: twinRuntime.discovery,
      // Same ensure the wizard uses, so the image downloads once rather than
      // once per entry point.
      runtime: { ensure: () => ensureTwinImage() },
    },
    cameraAdd: {
      discovery: twinRuntime.discovery,
      images: { ensure: ensureTwinImage },
      lens: {
        // A v4 UUID: the Twin Key is immutable and must be unique across every
        // hub, so it is generated locally rather than handed out by a server
        // the hub may not be able to reach.
        newTwinKey: () => randomUUID(),
        // The Lens registration API is not wired up yet — see the blocked list
        // in app/electron.md. An honest failure here is better than a Twin that
        // starts and silently never reaches Chirp.
        registerTwin: async () =>
          err(
            domainError(
              'unknown',
              'Connecting cameras to Chirp needs the Lens registration API, which is not wired up yet.'
            )
          ),
      },
      containers: twinRuntime.containers,
      ports: { allocate: allocatePort },
      records: cameraStore,
    },
    cameraList: {
      records: cameraStore,
      state: {
        running: async () => (await twinInventory()).filter((twin) => twin.running).map((twin) => twin.id),
      },
    },
    cameraRemove: { containers: twinRuntime.removal, records: cameraStore },
    capacity: {
      capacity: {
        host: () => createHostInfo().read(),
        cameraCount: async () => (await cameraStore.all()).length,
      },
    },
    subsystemStatus: {
      /**
       * Built from each subsystem's own adapters and nothing else. The probes
       * share no state, so a fault in one cannot propagate — the guarantee the
       * use case's `allSettled` then makes good on even if a probe throws.
       */
      probes: [
        createLorawanProbe({
          concentratorPresent: async () => (await concentrator.read()) !== null,
          credentialsPresent: createCredentialsCheck(paths.lorawanCredentialsDir()),
          serviceState: (unit) => services.state(unit),
          containerState,
        }),
        createZigbeeProbe({
          coordinatorPresent: async () => (await zigbeeService.coordinator()) !== null,
          serviceState: (unit) => services.state(unit),
          containerState,
          pairedCount: async () => (await zigbee2mqtt.zigbee.devices()).length,
        }),
        createCameraProbe({
          runtimeReady: async () => (await containerRuntime.status()).state === 'ready',
          twins: twinInventory,
        }),
      ],
    },
  };
};
