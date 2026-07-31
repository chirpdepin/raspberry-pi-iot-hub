import type { Result } from '../../domain/errors';

/**
 * Ports for getting a container runtime in place.
 *
 * Contract 1 (L): `ContainerRuntimePort` is written so a future `PodmanRuntime`
 * could implement it unchanged — nothing here says "docker" beyond the name of
 * the installer the user is offered.
 */

export type RuntimeState = 'missing' | 'stopped' | 'ready';

export interface RuntimeStatus {
  state: RuntimeState;
  version: string | null;
}

export interface ContainerRuntimeControlPort {
  status(): Promise<RuntimeStatus>;
  /**
   * Opens the official installer for the current platform. Deliberately NOT a
   * silent install: Docker Desktop requires a paid subscription above 250 staff
   * or $10M revenue, so installing it unattended could put a business user in
   * breach without their knowledge.
   */
  openInstaller(): Promise<Result<void>>;
}

export interface DockerEnsurePorts {
  runtime: ContainerRuntimeControlPort;
}

export interface DockerEnsureResult {
  status: RuntimeStatus;
  /** English text used as an i18n key, or undefined when ready. */
  message?: string;
  /** English text used as an i18n key for the primary button. */
  action?: string;
}
