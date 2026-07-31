import { exec } from 'node:child_process';
import { promisify } from 'node:util';

import { domainError, err, ok, type Result } from '../../domain/errors';
import type { ContainerRuntimeControlPort, RuntimeStatus } from '../../usecase/docker-ensure/contract';

const run = promisify(exec);

/**
 * Docker adapter.
 *
 * Implements the port declared by `docker-ensure`. Nothing here is imported by a
 * use case — the composition root wires it — which is what allows a future
 * `PodmanRuntime` to replace it without touching business logic (Contract 1 L).
 *
 * `docker version` is used rather than the dockerode socket probe because it
 * distinguishes the two states the UI must tell apart: a missing binary
 * (ENOENT) versus an installed binary whose daemon is not answering (non-zero
 * exit). A socket probe reports both as "cannot connect".
 */

const DOCKER_PROBE_TIMEOUT_MS = 5_000;

/** Where the official installer lives, per platform. */
const INSTALLER_URL: Record<string, string> = {
  win32: 'https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe',
  darwin: 'https://desktop.docker.com/mac/main/arm64/Docker.dmg',
  linux: 'https://docs.docker.com/engine/install/',
};

export interface DockerRuntimeDeps {
  platform: NodeJS.Platform;
  /** Injected so the use case tests never open a browser. */
  openExternal(url: string): Promise<void>;
}

export const createDockerRuntime = ({ platform, openExternal }: DockerRuntimeDeps): ContainerRuntimeControlPort => ({
  async status(): Promise<RuntimeStatus> {
    try {
      const { stdout } = await run('docker version --format "{{.Server.Version}}"', {
        timeout: DOCKER_PROBE_TIMEOUT_MS,
      });
      const version = stdout.trim();

      // An empty server version means the client answered but the daemon did not.
      return version ? { state: 'ready', version } : { state: 'stopped', version: null };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      // ENOENT/"not found" means no binary at all; anything else means the
      // binary exists but the daemon is unreachable.
      const notInstalled = /ENOENT|not found|not recognized/i.test(message);

      if (notInstalled) {
        return { state: 'missing', version: null };
      }

      // The client is present, so report the version we can still read.
      try {
        const { stdout } = await run('docker --version', { timeout: DOCKER_PROBE_TIMEOUT_MS });
        return { state: 'stopped', version: stdout.trim() || null };
      } catch {
        return { state: 'missing', version: null };
      }
    }
  },

  async openInstaller(): Promise<Result<void>> {
    const url = INSTALLER_URL[platform] ?? INSTALLER_URL['linux'];

    if (!url) {
      return err(domainError('not-supported-on-platform', 'Automatic installation is not available on this system.'));
    }

    try {
      await openExternal(url);
      return ok(undefined);
    } catch (error) {
      return err(
        domainError(
          'unknown',
          "Couldn't open the Docker installer.",
          error instanceof Error ? error.message : String(error)
        )
      );
    }
  },
});
