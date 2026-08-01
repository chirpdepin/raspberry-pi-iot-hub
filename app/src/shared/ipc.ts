/**
 * The IPC contract — the single source of truth for every main↔renderer channel.
 *
 * Contract 4: channel names exist exactly once. A magic string typed at both ends
 * drifts the first time someone renames one of them, and the failure is silent.
 * Both `preload` and `main/ipc` import from here, so a rename is a compile error
 * rather than a runtime no-op.
 *
 * This file carries TYPES AND CONSTANTS ONLY. It is imported by the renderer, so
 * anything runtime-heavy added here would end up in the renderer bundle.
 */

export const IPC = {
  /** Everything the app can detect about the machine it is running on. */
  hostCapabilities: 'host:capabilities',
  /** Docker presence, version and daemon state. */
  dockerStatus: 'docker:status',
  /** App metadata for the Settings screen. */
  appInfo: 'app:info',
  /** Launch the platform's official Docker installer. Never called implicitly. */
  dockerInstall: 'docker:install',
  /** Host facts plus per-capability availability and reasons. */
  hostDetails: 'host:details',
  /** Live load and memory use. Polled far more often than hostDetails. */
  systemLoad: 'system:load',

  /** The fitted LoRaWAN concentrator, or null. */
  gatewayDetect: 'gateway:detect',
  /** Register with Chirp and fetch credentials. */
  gatewayRegister: 'gateway:register',
  /** Write credentials and start the gateway service. */
  gatewayProvision: 'gateway:provision',

  /** The attached Zigbee coordinator, or null. */
  zigbeeCoordinator: 'zigbee:coordinator',
  /** Render config and start Mosquitto plus Zigbee2MQTT. */
  zigbeeStart: 'zigbee:start',
  /** Open a bounded join window. */
  zigbeePermitJoin: 'zigbee:permitJoin',
  /** Close the join window early. */
  zigbeeStopJoin: 'zigbee:stopJoin',
  /** Paired devices with independent hub and Chirp status. */
  zigbeeDevices: 'zigbee:devices',
  /** Provision one device into Chirp. */
  zigbeeLinkChirp: 'zigbee:linkChirp',

  /**
   * Per-subsystem health, gathered so one failing subsystem cannot blank the
   * others. Feeds the dashboard's Needs-attention strip.
   */
  subsystemStatus: 'subsystem:status',

  /** ONVIF discovery — which cameras are on the network. */
  cameraDiscover: 'camera:discover',
  /** Start a Twin, for a discovered camera or on its own. */
  cameraAdd: 'camera:add',
  /** Configured cameras and whether each is running. */
  cameraList: 'camera:list',
  /** Remove a Twin, optionally with its recordings. */
  cameraRemove: 'camera:remove',
  /** How many cameras this hardware should run. */
  cameraCapacity: 'camera:capacity',
  /** Open a camera's own web interface in the user's browser. */
  cameraOpen: 'camera:open',
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];

// ---------------------------------------------------------------------------
// Payloads
//
// Phase 3 replaces these hand-written types with zod schemas and `z.infer`, so
// validation and typing come from one definition. They are declared here now so
// the shell has something real to render against.
// ---------------------------------------------------------------------------

export interface AppInfo {
  name: string;
  version: string;
  /**
   * Plain strings, not `NodeJS.Platform`. This module is imported by the
   * renderer, which is compiled with `types: []` and has no Node typings — and
   * should not, since referencing them here would be the type-level version of
   * the very dependency the boundary checker forbids.
   */
  platform: string;
  arch: string;
}

/**
 * One subsystem's health. Mirrors `main/domain/subsystem.ts`, restated here
 * because the renderer cannot import from `main/`.
 */
export interface SubsystemStatusPayload {
  id: 'lorawan' | 'zigbee' | 'cameras';
  state: 'running' | 'not-configured' | 'unavailable' | 'failed';
  summary: string;
  nextAction?: { label: string; route: string };
  technicalDetail?: string;
}

export interface DiscoveredCameraPayload {
  xaddr: string;
  address: string;
  manufacturer: string | null;
  model: string | null;
  label: string;
  /** Already has a Twin — the row opens it rather than offering setup again. */
  alreadyAdded: boolean;
}

export interface CameraPayload {
  id: string;
  displayName: string;
  address: string;
  hostPort: number;
  /**
   * Shown until the user replaces them. The Twin consumes them on first boot
   * and forces a change at first login, so there is no other way back in.
   */
  firstLoginUsername: string;
  firstLoginPassword: string;
  online: boolean;
}

/**
 * One network the scan considered. Mirrors `main/domain/camera.ts`, restated
 * because the renderer cannot import from `main/`.
 */
export interface ScannedNetworkPayload {
  cidr: string;
  hosts: number;
  skipped?: 'too-large';
}

export interface CameraScanPayload {
  cameras: DiscoveredCameraPayload[];
  /** What was searched, so the screen can justify the number it shows. */
  networks: ScannedNetworkPayload[];
}

export interface CapacityPayload {
  current: number;
  recommended: number;
  /** False when this machine's capacity has not been measured; the UI shows nothing. */
  applies: boolean;
}

export interface SystemLoadPayload {
  /** 1-minute load average, unclamped, so the raw figure can be shown. */
  load1: number;
  cpuCount: number;
  /** Percentage of the machine's capacity, clamped to 100 for display. */
  loadPercent: number;
  usedMemoryBytes: number;
  totalMemoryBytes: number;
  memoryPercent: number;
  /** Decided in main from the unclamped load; the view only colors by it. */
  strain: 'normal' | 'high';
}

export interface HostCapabilities {
  /** True when this machine has a LoRaWAN concentrator fitted. */
  lorawan: boolean;
  /** True when a supported Zigbee coordinator is attached. */
  zigbee: boolean;
  /** True when a second radio is present for Thread. */
  thread: boolean;
  /** True when cameras can run here — i.e. a working container runtime. */
  cameras: boolean;
}

export interface DockerStatus {
  installed: boolean;
  running: boolean;
  version: string | null;
}

export interface HostDetails {
  host: {
    hostname: string;
    platform: string;
    arch: string;
    isRaspberryPi: boolean;
    totalMemoryBytes: number;
    cpuCount: number;
  };
  capabilities: Record<
    'cameras' | 'lorawan' | 'zigbee' | 'thread',
    {
      name: 'cameras' | 'lorawan' | 'zigbee' | 'thread';
      available: boolean;
      /** English text used directly as an i18n key. Undefined when available. */
      reason?: string;
    }
  >;
}

/** Mirrors domain/errors.ts, redeclared here because shared/ may not import main/. */
export type IpcResult<T> =
  { ok: true; value: T } | { ok: false; error: { code: string; message: string; technicalDetail?: string } };

export interface ConcentratorInfo {
  eui: string;
  model: string;
  interface: string;
  devicePath: string;
}

export interface GatewayRegisterInput {
  eui: string;
  name: string;
  region: string;
}

export interface LnsCredentialsPayload {
  uri: string;
  trust: string;
  cert: string;
  key: string;
}

export interface ZigbeeCoordinatorInfo {
  model: string;
  port: string;
  adapter: string | null;
  serial: string;
}

export interface ZigbeeDeviceInfo {
  ieeeAddress: string;
  displayName: string;
  type: string;
  manufacturer: string | null;
  model: string | null;
  linkQuality: number | null;
  batteryPercent: number | null;
  lastSeen: string | null;
  /** Messages are reaching the local broker. */
  connectedToHub: boolean;
  /** The device has been provisioned into Chirp. */
  connectedToChirp: boolean;
}

export interface ZigbeeLinkInput {
  ieeeAddress: string;
  displayName: string;
  gatewayEui: string;
  hubName: string;
}

/** The surface `preload` exposes on `window.chirpHub`. */
export interface ChirpHubApi {
  getAppInfo(): Promise<AppInfo>;
  getHostCapabilities(): Promise<HostCapabilities>;
  getHostDetails(): Promise<HostDetails>;
  getSystemLoad(): Promise<SystemLoadPayload>;
  getDockerStatus(): Promise<DockerStatus>;
  installDocker(): Promise<IpcResult<void>>;

  detectGateway(): Promise<ConcentratorInfo | null>;
  registerGateway(input: GatewayRegisterInput): Promise<IpcResult<LnsCredentialsPayload>>;
  provisionGateway(credentials: LnsCredentialsPayload): Promise<IpcResult<void>>;

  getZigbeeCoordinator(): Promise<ZigbeeCoordinatorInfo | null>;
  startZigbee(channel?: number): Promise<IpcResult<void>>;
  permitZigbeeJoin(seconds?: number): Promise<IpcResult<void>>;
  stopZigbeeJoin(): Promise<IpcResult<void>>;
  getZigbeeDevices(): Promise<ZigbeeDeviceInfo[]>;
  linkZigbeeDevice(input: ZigbeeLinkInput): Promise<IpcResult<void>>;

  /** Per-subsystem health for the dashboard's Needs-attention strip. */
  getSubsystemStatus(): Promise<SubsystemStatusPayload[]>;

  /**
   * A Result, not a bare list: "the scan could not run" and "your network has no
   * cameras" are different answers and need different advice.
   */
  discoverCameras(): Promise<IpcResult<CameraScanPayload>>;
  /** Omit the camera to start a Twin that has not been matched to one yet. */
  addCamera(camera?: DiscoveredCameraPayload): Promise<IpcResult<{ camera: CameraPayload }>>;
  listCameras(): Promise<CameraPayload[]>;
  removeCamera(input: { id: string; keepRecordings: boolean }): Promise<IpcResult<void>>;
  getCameraCapacity(): Promise<CapacityPayload>;
  openCamera(id: string): Promise<IpcResult<void>>;
}
