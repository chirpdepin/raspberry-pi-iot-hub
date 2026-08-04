import { randomBytes } from 'node:crypto';

import { existsSync } from 'node:fs';

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { shell } from 'electron';

/** The single template both the installer and this app render. */
const TEMPLATE_NAME = 'zigbee-configuration.yaml.template';

import { domainError, err, ok } from './domain/errors';

import { createChirpGatewayClient } from './adapters/chirp/gateway-client';
import { readZipEntries } from './adapters/chirp/zip';
import { createDockerRuntime } from './adapters/container/docker-runtime';
import { createConcentratorDiscovery } from './adapters/discovery/concentrator';
import { createHostInfo } from './adapters/discovery/host-info';
import { createRadioDiscovery } from './adapters/discovery/radio-discovery';
import { createSystemLoad } from './adapters/discovery/system-load';
import { createSerialRadioScanner } from './adapters/discovery/serial';
import { createRadioRoleStore } from './adapters/store/radio-roles';
import { handleRadioRoles } from './usecase/radio-roles/usecase';
import { createPaths, HUB_IMAGE_MARKER } from './adapters/paths/paths';
import { createZigbee2MqttClient } from './adapters/mqtt/zigbee2mqtt-client';
import { createZigbeeService } from './adapters/mqtt/zigbee-service';
import { createZigbeeDockerService, readZigbeeTemplate } from './adapters/mqtt/zigbee-docker-service';
import { createPrivilegedRunner } from './adapters/privileged/privileged-runner';
import { createSessionStore } from './adapters/store/session';
import { createPortClaims, createPortProbe } from './adapters/network/port-allocator';
import { createServiceState } from './adapters/system/service-state';
import { createCameraProbe, createLorawanProbe, createZigbeeProbe } from './adapters/status/subsystem-probes';
import { createContainerState, createCredentialsCheck, createTwinInventory } from './adapters/status/inventory';
import { createCameraStore } from './adapters/store/cameras';
import { createTwinRuntime } from './adapters/camera/twin-runtime';
import { createOnvifDiscovery } from './adapters/camera/onvif-discovery';
import { createImageStore } from './adapters/images/image-store';
import { handleTwinImageEnsure } from './usecase/twin-image-ensure/usecase';
import { handlePortAllocate } from './usecase/port-allocate/usecase';
import type { IpcDependencies } from './ipc/register';
import { createDockerCommand } from './adapters/container/docker-command';
import { createDockerInstaller } from './adapters/container/docker-installer';
import { createUserAttention } from './adapters/attention/user-attention';
import { createPendingJobStore } from './adapters/store/pending-job';
import { createElevatedCommand } from './adapters/privileged/elevated-command';
import { createCameraJobCoordinator } from './ipc/camera-job';

/**
 * One allocator, shared by every subsystem that needs a host port. Module scope
 * because it depends on nothing built per-composition — and because there must
 * be exactly one, or the reserved-port table is honoured inconsistently
 * (Phase 11 SOLID gate).
 */
/**
 * The one Docker executor for this process.
 *
 * Module scope for the same reason as the allocator: there must be exactly one,
 * so the strategy it resolves (PATH, an absolute path, or `sg docker`) is shared
 * by every adapter. Two of these would mean the status probe could succeed while
 * the Twin runtime still failed.
 */
const dockerCommand = createDockerCommand();

const allocatePort = () =>
  handlePortAllocate({ probe: createPortProbe(), claims: createPortClaims(dockerCommand) });

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
  // The image marker, not the platform: a Linux desktop is not the hub image
  // and must not be handed its root-owned paths.
  const isHubImage = existsSync(HUB_IMAGE_MARKER);
  const paths = createPaths(isHubImage);
  const privileged = createPrivilegedRunner();
  // Its own narrow capability: gateway-provision's runner offers only
  // writeFile and startService, and widening it to "run anything as root"
  // would hand that reach to every existing consumer.
  const elevated = createElevatedCommand();
  const services = createServiceState(process.platform);

  /**
   * Live radio inventory with roles applied. Shared by every reader so the
   * dashboard, the Zigbee page and the Thread page can never disagree about
   * what is plugged in.
   */
  const scanRoles = () =>
    handleRadioRoles({
      scan: { scan: createSerialRadioScanner(process.platform) },
      roles: createRadioRoleStore(),
    });

  /**
   * Two implementations of one port (Contract 1 L). The hub image starts the
   * stack through systemd, because its units already encode dependency order
   * and restart policy; anywhere else there are no units, so Docker is driven
   * directly. No use case knows which it has.
   */
  const zigbeeService = isHubImage
    ? createZigbeeService({
        paths,
        startService: (name) => privileged.startService(name),
        scanRoles,
        // Reading unit state is unprivileged, so it does not go through the
        // privileged runner — a dashboard refresh must never raise a password
        // prompt.
        isServiceActive: (name) => services.isActive(name),
      })
    : createZigbeeDockerService({
        paths,
        platform: process.platform,
        scanRoles,
        isPortFree: (port) => createPortProbe().isFree(port),
        docker: dockerCommand,
        configTemplate: readZigbeeTemplate([
          // Packaged: shipped alongside the app by electron-builder.
          join(process.resourcesPath ?? '', TEMPLATE_NAME),
          // Development: the repo copy the installer also reads. Resolved from
          // this module rather than app.getAppPath(), which varies with how the
          // process was launched.
          join(dirname(fileURLToPath(import.meta.url)), '../../..', 'config', TEMPLATE_NAME),
        ]),
      });

  const zigbee2mqtt = createZigbee2MqttClient();

  const containerRuntime = createDockerRuntime({
    docker: dockerCommand,
    platform: process.platform,
    // Starting an installed-but-stopped Docker. On Linux the daemon is a
    // service; elsewhere it belongs to Docker Desktop, so the honest action is
    // to open that application and let it start its own engine.
    openApp: async () => {
      if (process.platform === 'linux') return elevated.run('systemctl', ['start', 'docker']);
      await shell.openExternal(process.platform === 'darwin' ? 'docker://' : 'docker-desktop://');
      return ok(undefined);
    },
  });

  const dockerInstaller = createDockerInstaller({
    platform: process.platform,
    arch: process.arch,
    osReleasePath: paths.osRelease(),
    openExternal: async (url) => shell.openExternal(url),
    runPrivileged: (command, args) => elevated.run(command, args),
  });

  const concentrator = createConcentratorDiscovery(paths);

  const images = createImageStore({ paths, docker: dockerCommand });

  const twinRuntime = createTwinRuntime(dockerCommand);
  const onvifDiscovery = createOnvifDiscovery();

  const ensureTwinImage = async (onProgress?: (received: number, total: number) => void) =>
    handleTwinImageEnsure({ images, arch: () => process.arch }, onProgress);

  const cameraStore = createCameraStore();
  const twinInventory = createTwinInventory(dockerCommand);
  const containerState = createContainerState(dockerCommand);

  return {
    hostCapabilities: {
      hostInfo: createHostInfo(),
      radios: createRadioDiscovery({ paths, scanRoles }),
      // host-capabilities wants a boolean pair; docker-status reports five
      // states. Adapted at the seam rather than widening either port to satisfy
      // both (Contract 1 I).
      containerRuntime: {
        async status() {
          const status = await containerRuntime.status();
          return {
            // 'needs-permission' and 'stopped' both mean Docker is present:
            // reporting either as "not installed" would tell the user to
            // reinstall software they already have.
            installed: status.state !== 'missing' && status.state !== 'unknown',
            running: status.state === 'ready',
            version: status.version,
          };
        },
      },
    },
    dockerStatus: { runtime: containerRuntime },
    dockerInstall: { installer: dockerInstaller },
    cameraJob: createCameraJobCoordinator({
      jobs: createPendingJobStore(),
      attention: createUserAttention(),
      // A container without a record is a half-finished attempt; it must go
      // before the retry, or recreating it fails on the name.
      // Recordings are kept: this discards a container the user never got to
      // use, not their footage.
      cleanup: { discard: async (id) => void (await twinRuntime.removal.remove(id)) },
      existing: async (id) => (await cameraStore.all()).find((entry) => entry.id === id) ?? null,
      addPorts: (seed) => ({
        images: { ensure: ensureTwinImage },
        containers: twinRuntime.containers,
        ports: { allocate: allocatePort },
        // Deterministic: the same job always derives the same Twin id, which is
        // what stops a resume creating a second camera.
        secrets: { newPassword: () => randomBytes(18).toString('base64url'), newId: () => seed },
        records: cameraStore,
      }),
      runtime: containerRuntime,
      wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      now: () => Date.now(),
    }),
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
      discovery: onvifDiscovery,
      configured: { addresses: async () => (await cameraStore.all()).map((camera) => camera.address) },
    },
    cameraAdd: {
      images: { ensure: ensureTwinImage },
      containers: twinRuntime.containers,
      ports: { allocate: allocatePort },
      secrets: {
        // The Twin's first-login password. Base64url of 18 random bytes: long
        // enough that guessing it is not a strategy, and typable from the
        // dialog that shows it once.
        newPassword: () => randomBytes(18).toString('base64url'),
        // Only ever a container-name seed, so it is short and need not be a
        // full UUID — it just has to not collide with an existing Twin.
        newId: () => randomBytes(6).toString('hex'),
      },
      records: cameraStore,
    },
    cameraList: {
      records: cameraStore,
      state: {
        running: async () => (await twinInventory()).filter((twin) => twin.running).map((twin) => twin.id),
      },
    },
    cameraRemove: { containers: twinRuntime.removal, records: cameraStore },
    cameraOpen: {
      external: {
        async open(url: string) {
          try {
            await shell.openExternal(url);
            return ok(undefined);
          } catch (error) {
            return err(
              domainError(
                'unknown',
                "Couldn't open your browser.",
                error instanceof Error ? error.message : String(error)
              )
            );
          }
        },
      },
      // Read from the stored record rather than asked of Docker: the port is
      // ours, allocated when the camera was added.
      location: {
        hostPort: async (id) => (await cameraStore.all()).find((camera) => camera.id === id)?.hostPort ?? null,
      },
    },
    capacity: {
      capacity: {
        host: () => createHostInfo().read(),
        cameraCount: async () => (await cameraStore.all()).length,
      },
    },
    systemLoad: { load: createSystemLoad() },
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
