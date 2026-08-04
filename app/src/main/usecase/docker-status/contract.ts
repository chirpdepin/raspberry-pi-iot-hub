import type { Result } from '../../domain/errors';

/**
 * Ports for reporting the container runtime's state.
 *
 * Contract 1 (L): nothing here says "docker" beyond the installer the user is
 * offered, so a Podman implementation could satisfy it unchanged.
 */

/**
 * What the runtime can do for us *right now*.
 *
 * `ready` means **this process can run a container command**, not that a daemon
 * exists somewhere. The distinction is the whole point: a socket can answer
 * while our own process still cannot find the CLI, because Electron inherited
 * its PATH before Docker was installed.
 */
export type RuntimeState =
  | 'missing'
  /** Installed, but the daemon is not answering. Docker Desktop not launched, or the service is stopped. */
  | 'stopped'
  /** Installed and running, but this user cannot use it — the Linux docker-group case. */
  | 'needs-permission'
  | 'ready'
  /**
   * The probe failed for a reason we do not recognise.
   *
   * A distinct state on purpose. Reporting an unknown failure as `missing`
   * would send a user to reinstall software they already have, which is the
   * single most annoying thing this screen could do.
   */
  | 'unknown';

export interface RuntimeStatus {
  state: RuntimeState;
  version: string | null;
  /** The raw failure, for [Technical details]. Never shown on the primary path. */
  detail?: string;
}

export interface ContainerRuntimeStatusPort {
  status(): Promise<RuntimeStatus>;
  /** Starts an installed-but-stopped runtime, or opens the app that owns it. */
  start(): Promise<Result<void>>;
}

export interface DockerStatusPorts {
  runtime: ContainerRuntimeStatusPort;
}

export interface DockerStatusResult {
  status: RuntimeStatus;
  /** English text used as an i18n key, absent when ready. */
  message?: string;
  /** English text used as an i18n key for the one primary button. */
  action?: string;
}
