import { execFile } from 'node:child_process';
import { access, constants } from 'node:fs/promises';
import { arch, platform } from 'node:os';
import { promisify } from 'node:util';

import { DOCKER_BINARY_PATHS, DOCKER_TIMEOUTS } from '../../config/docker';

const run = promisify(execFile);

/** Enough for `docker load` to report on a large image tarball. */
const DEFAULT_MAX_BUFFER = 32 * 1024 * 1024;

/**
 * The one way this app runs Docker.
 *
 * **Why this exists at all.** Six adapters used to invoke a bare `docker`,
 * relying on the PATH the Electron process inherited *when it launched*. That
 * breaks the exact flow this app is for: install Docker while the app is
 * running, and every one of those adapters keeps failing with "not found" even
 * though Docker is installed and working. On Windows the installer edits the
 * system PATH, which a running process never re-reads.
 *
 * So resolution is done here, once, and re-checked when it fails:
 *
 * 1. `docker` on the inherited PATH — the normal case.
 * 2. Known absolute install locations for the platform (`config/docker.ts`) —
 *    covers the just-installed case without an app restart.
 * 3. `sg docker -c …` on Linux — covers the *other* half of that flow. Adding a
 *    user to the `docker` group does not affect sessions that already exist, so
 *    a freshly added user gets EACCES on the socket until they log out. Wrapping
 *    in `sg` runs the command with the group applied, so it works immediately.
 *
 * `DOCKER_HOST` is honoured implicitly: it is inherited by the child process, so
 * a remote or rootless daemon works without special handling here.
 *
 * Contract 1 (L): every Docker-backed adapter goes through this, which is what
 * would let a Podman implementation replace it in one place.
 */

export interface DockerRunResult {
  stdout: string;
  stderr: string;
}

export interface DockerCommandPort {
  /** Runs a docker subcommand. Rejects exactly as execFile would. */
  run(args: string[], options?: { timeoutMs?: number; maxBufferBytes?: number }): Promise<DockerRunResult>;
  /**
   * Forgets the resolved executable, so the next call searches again.
   *
   * Called after an install: the strategy that failed a minute ago is very
   * likely the one that works now, and caching the failure is what would make
   * the app say "no Docker" immediately after installing Docker.
   */
  reset(): void;
}

/** How the CLI is reached, once we have worked it out. */
type Strategy = { kind: 'path'; command: string } | { kind: 'group'; command: string };

const isExecutable = async (candidate: string): Promise<boolean> => {
  try {
    await access(candidate, constants.X_OK);
    return true;
  } catch {
    return false;
  }
};

/** True when the failure is the Linux docker-group problem rather than a missing binary. */
export const isPermissionFailure = (message: string): boolean =>
  /permission denied|EACCES|dial unix.*permission/i.test(message);

/** True when the CLI itself could not be found. */
export const isMissingBinary = (message: string): boolean => /ENOENT|not found|not recognized/i.test(message);

export const createDockerCommand = (
  deps: { platform?: string; arch?: string } = {}
): DockerCommandPort => {
  const currentPlatform = deps.platform ?? platform();
  let strategy: Strategy | null = null;

  const candidates = async (): Promise<Strategy[]> => {
    const found: Strategy[] = [{ kind: 'path', command: 'docker' }];

    for (const absolute of DOCKER_BINARY_PATHS[currentPlatform] ?? []) {
      if (await isExecutable(absolute)) found.push({ kind: 'path', command: absolute });
    }

    // Only Linux has the group problem, and `sg` only exists there.
    if (currentPlatform === 'linux') found.push({ kind: 'group', command: 'docker' });

    return found;
  };

  const invoke = async (
    chosen: Strategy,
    args: string[],
    timeoutMs: number,
    maxBuffer: number
  ): Promise<DockerRunResult> => {
    if (chosen.kind === 'group') {
      // sg takes the whole command as one string, so arguments are quoted here
      // rather than passed through execFile's array.
      const quoted = [chosen.command, ...args].map((part) => `'${part.replace(/'/g, `'\\''`)}'`).join(' ');
      return run('sg', ['docker', '-c', quoted], { timeout: timeoutMs, maxBuffer });
    }

    return run(chosen.command, args, { timeout: timeoutMs, maxBuffer });
  };

  return {
    async run(args, options): Promise<DockerRunResult> {
      const timeoutMs = options?.timeoutMs ?? DOCKER_TIMEOUTS.probeMs;
      const maxBuffer = options?.maxBufferBytes ?? DEFAULT_MAX_BUFFER;

      if (strategy) {
        try {
          return await invoke(strategy, args, timeoutMs, maxBuffer);
        } catch (error) {
          // A cached strategy can go stale — Docker restarted, PATH changed,
          // the group finally applied. Fall through and resolve again rather
          // than reporting a failure the next attempt would not have.
          strategy = null;
          if (!isMissingBinary(String(error)) && !isPermissionFailure(String(error))) throw error;
        }
      }

      let lastError: unknown = new Error('docker: no usable command found');

      for (const candidate of await candidates()) {
        try {
          const result = await invoke(candidate, args, timeoutMs, maxBuffer);
          strategy = candidate;
          return result;
        } catch (error) {
          lastError = error;
        }
      }

      throw lastError;
    },

    reset(): void {
      strategy = null;
    },
  };
};

/** The architecture key used to pick an installer, normalised to what the tables use. */
export const currentArch = (): string => arch();
