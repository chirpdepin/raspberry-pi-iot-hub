import { DOCKER_TIMEOUTS } from '../../config/docker';
import { domainError, err, ok, type Result } from '../../domain/errors';
import type { ContainerRuntimeStatusPort, RuntimeStatus } from '../../usecase/docker-status/contract';

import { isMissingBinary, isPermissionFailure, type DockerCommandPort } from './docker-command';

/**
 * Docker status and start.
 *
 * **Readiness is "can this process run a Docker command", not "does a socket
 * exist".** Those are different questions, and the app needs the second one
 * answered by asking the first: after an install the daemon can be up and
 * answering while our own process still cannot find the CLI, because Electron
 * inherited its PATH before Docker existed. Probing a socket alone would report
 * ready, and then every container operation would fail.
 *
 * Everything here therefore goes through `DockerCommandPort` — the same
 * mechanism the Twin, image and inventory adapters use. If this reports ready,
 * those work.
 *
 * `docker version` separates the states the UI must tell apart: a missing binary
 * (ENOENT), a present binary whose daemon is silent (non-zero exit), and a
 * running daemon this user may not talk to (EACCES on the socket).
 */

export interface DockerRuntimeDeps {
  docker: DockerCommandPort;
  platform: NodeJS.Platform;
  /** Injected so tests never launch an application. */
  openApp(): Promise<Result<void>>;
}

export const createDockerRuntime = ({ docker, platform, openApp }: DockerRuntimeDeps): ContainerRuntimeStatusPort => ({
  async status(): Promise<RuntimeStatus> {
    try {
      const { stdout } = await docker.run(['version', '--format', '{{.Server.Version}}'], {
        timeoutMs: DOCKER_TIMEOUTS.probeMs,
      });
      const version = stdout.trim();

      // The client answered but printed no server version: the daemon is down.
      return version ? { state: 'ready', version } : { state: 'stopped', version: null };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);

      // Checked before "missing": a permission failure means Docker is both
      // installed and running, and calling that "missing" would tell the user
      // to reinstall software they already have.
      if (isPermissionFailure(detail)) {
        return { state: 'needs-permission', version: null, detail };
      }

      if (isMissingBinary(detail)) {
        return { state: 'missing', version: null, detail };
      }

      // The CLI exists and the failure is not permissions. Reading the client
      // version proves "installed but stopped" rather than leaving it unexplained.
      try {
        const { stdout } = await docker.run(['--version'], { timeoutMs: DOCKER_TIMEOUTS.probeMs });
        return { state: 'stopped', version: stdout.trim() || null, detail };
      } catch {
        // Genuinely could not tell. Never silently "missing".
        return { state: 'unknown', version: null, detail };
      }
    }
  },

  /**
   * Starts the runtime, or opens the application that owns it.
   *
   * This exists because the dashboard's "Start Docker" button called the
   * *installer* — offering to reinstall Docker to somebody whose Docker is
   * merely not running.
   */
  async start(): Promise<Result<void>> {
    try {
      const result = await openApp();
      if (!result.ok) return result;

      // Whatever was just started needs a moment before it answers, and the
      // caller polls. Clearing the cached strategy means the next probe
      // re-resolves rather than repeating the failure that led here.
      docker.reset();
      return ok(undefined);
    } catch (error) {
      return err(
        domainError(
          'unknown',
          platform === 'linux' ? "Couldn't start Docker." : "Couldn't open Docker Desktop.",
          error instanceof Error ? error.message : String(error)
        )
      );
    }
  },
});
