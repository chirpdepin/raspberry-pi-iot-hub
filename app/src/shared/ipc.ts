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

/** The surface `preload` exposes on `window.chirpHub`. */
export interface ChirpHubApi {
  getAppInfo(): Promise<AppInfo>;
  getHostCapabilities(): Promise<HostCapabilities>;
  getHostDetails(): Promise<HostDetails>;
  getDockerStatus(): Promise<DockerStatus>;
  installDocker(): Promise<IpcResult<void>>;
}
