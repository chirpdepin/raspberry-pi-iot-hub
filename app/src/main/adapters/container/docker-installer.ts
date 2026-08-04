import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';

import {
  AUTOMATED_INSTALL_DISTROS,
  DOCKER_INSTALLER_URL,
  DOCKER_INSTALL_SCRIPT_URL,
  DOCKER_TIMEOUTS,
} from '../../config/docker';
import { domainError, err, ok, type Result } from '../../domain/errors';
import type { DockerInstallPort } from '../../usecase/docker-install/contract';

const run = promisify(execFile);

/**
 * Installing Docker.
 *
 * Two routes, and which one applies is a property of the machine rather than of
 * the platform string:
 *
 * - **Automated** on a distribution we have actually tested. The hub is a
 *   Raspberry Pi whose "installer URL" is a documentation page — a dead end for
 *   someone who has never opened a terminal, which is precisely the user this
 *   product exists for. Docker Engine there is Apache-2.0, so there is no
 *   subscription question.
 * - **Guided** everywhere else. Docker Desktop needs a paid subscription above
 *   250 employees or $10M revenue, so the user has to see Docker's own terms.
 *   Installing it silently could put someone in breach without their knowledge.
 *
 * `linux` is deliberately **not** treated as one thing: it spans dozens of
 * package managers, and guessing wrong means running a privileged command that
 * does something unintended on a stranger's machine.
 */

export interface DockerInstallerDeps {
  platform: NodeJS.Platform;
  /** Where this OS states its distribution. Through PathsPort like every system path. */
  osReleasePath: string;
  arch: string;
  openExternal(url: string): Promise<void>;
  /**
   * Runs one privileged command.
   *
   * Injected as a narrow capability rather than reusing gateway-provision's
   * runner, which exists to write credential files and start a systemd unit.
   */
  runPrivileged(command: string, args: string[]): Promise<Result<void>>;
}

/** The distribution ids this machine reports, from /etc/os-release. */
const readDistroIds = async (osReleasePath: string): Promise<string[]> => {
  try {
    const content = await readFile(osReleasePath, 'utf8');
    const ids: string[] = [];

    for (const line of content.split('\n')) {
      const match = /^(ID|ID_LIKE)=(.*)$/.exec(line.trim());
      if (!match?.[2]) continue;
      // Values may be quoted, and ID_LIKE is a space-separated list.
      ids.push(...match[2].replace(/["']/g, '').split(/\s+/).filter(Boolean));
    }

    return ids.map((id) => id.toLowerCase());
  } catch {
    return [];
  }
};

export const createDockerInstaller = ({
  platform,
  arch,
  osReleasePath,
  openExternal,
  runPrivileged,
}: DockerInstallerDeps): DockerInstallPort => ({
  async canInstallAutomatically(): Promise<boolean> {
    if (platform !== 'linux') return false;

    const ids = await readDistroIds(osReleasePath);
    return ids.some((id) => AUTOMATED_INSTALL_DISTROS.includes(id));
  },

  async openInstaller(): Promise<Result<void>> {
    // Architecture matters: handing an Intel Mac an arm64 disk image gives the
    // user a file their machine refuses to open, with no explanation.
    const url = DOCKER_INSTALLER_URL[platform]?.[arch];

    if (!url) {
      return err(
        domainError(
          'not-supported-on-platform',
          "Chirp Hub can't install Docker on this system automatically. Install Docker, then come back and try again."
        )
      );
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

  async installEngine(): Promise<Result<void>> {
    try {
      // The official convenience script, fetched and run as root. Piping a
      // remote script into a shell is what Docker themselves document; doing it
      // through the privileged runner keeps it to one auditable call.
      const script = await run('curl', ['-fsSL', DOCKER_INSTALL_SCRIPT_URL], {
        timeout: DOCKER_TIMEOUTS.probeMs * 4,
        maxBuffer: 1024 * 1024,
      });

      const installed = await runPrivileged('sh', ['-c', script.stdout]);
      if (!installed.ok) return installed;

      // Without this the daemon is installed and running, and the user still
      // cannot talk to it: the socket is root:docker 0660.
      //
      // NOTE: the docker group is root-equivalent on the host — a member can
      // mount the filesystem into a container as root. It is the standard way to
      // use Docker without sudo, and it is a real privilege grant, which is why
      // the consent copy says so rather than leaving it implied.
      const user = process.env['SUDO_USER'] ?? process.env['USER'];
      if (user) await runPrivileged('usermod', ['-aG', 'docker', user]);

      return ok(undefined);
    } catch (error) {
      return err(
        domainError(
          'unknown',
          "Couldn't install Docker automatically.",
          error instanceof Error ? error.message : String(error)
        )
      );
    }
  },
});
