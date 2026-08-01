import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { domainError, err, ok, type Result } from '../../domain/errors';
import type { ContainerRuntimePort } from '../../usecase/camera-add/contract';
import type { TwinRemovalPort } from '../../usecase/camera-remove/contract';
import type { PathsPort } from '../paths/paths';

const run = promisify(execFile);

/**
 * Twin lifecycle: start one, remove one, delete its recordings.
 *
 * **Discovery is not here.** It used to be, shelling out to a short-lived
 * host-network Twin to call its ONVIF API — which cannot work before the first
 * Twin exists. It lives in `onvif-discovery.ts` now, which is its own adapter
 * for its own port: scanning a network and running containers have nothing in
 * common beyond having once shared a file.
 *
 * Twins run on bridge networking with a mapped port, because every Twin listens
 * on port 80 internally and twenty of them on host networking would collide.
 */

export interface TwinRuntimeDeps {
  paths: PathsPort;
}

export const createTwinRuntime = ({ paths }: TwinRuntimeDeps) => {
  /**
   * Where Twin data lives. Derived once so creation and deletion cannot build
   * the path differently — the version of this bug that deletes the wrong
   * directory is not one worth risking.
   */
  const camerasDir = (): string => paths.serviceDir('lorawan').replace(/lorawan$/, 'cameras');

  const containers: ContainerRuntimePort = {
    async createTwin({ id, imageTag, hostPort, seedUsername, seedPassword }): Promise<Result<void>> {
      try {
        // The Twin's own data directory, mounted so its configuration and
        // credentials survive a restart. Nothing is written into it here: the
        // Twin writes its own defaults on first boot and the user configures it
        // from its UI.
        const dataDir = `${camerasDir()}/${id}`;
        await run('mkdir', ['-p', dataDir]);

        await run('docker', [
          'run',
          '-d',
          '--name',
          id,
          '--restart',
          'unless-stopped',
          // Loopback only. A Twin published on 0.0.0.0 would put a camera's live
          // view and its settings on the LAN for anyone who guessed the port,
          // during the window before the user has set their own password.
          '-p',
          `127.0.0.1:${hostPort}:80`,
          '-v',
          `${dataDir}:/home/twin/data`,
          // Consumed once, on first boot. The Twin marks the account as
          // must-change, so these stop working as soon as the user logs in.
          '-e',
          `TWIN_USERNAME=${seedUsername}`,
          '-e',
          `TWIN_PASSWORD=${seedPassword}`,
          // The Twin builds its own links from this; without it they point at
          // the container's own hostname, which resolves nowhere in a browser.
          '-e',
          `TWIN_PUBLIC_URL=http://127.0.0.1:${hostPort}`,
          imageTag,
        ]);

        return ok(undefined);
      } catch (error) {
        return err(
          domainError(
            'unknown',
            "Couldn't set up this camera on the device.",
            error instanceof Error ? error.message : String(error)
          )
        );
      }
    },
  };

  const removal: TwinRemovalPort = {
    async remove(id: string): Promise<Result<void>> {
      try {
        // -f because a recording Twin will not stop on its own signal quickly,
        // and the user has already confirmed they want it gone.
        await run('docker', ['rm', '-f', id]);
        return ok(undefined);
      } catch (error) {
        return err(
          domainError(
            'unknown',
            "Couldn't remove this camera. It may already be gone — refresh and check.",
            error instanceof Error ? error.message : String(error)
          )
        );
      }
    },

    async purgeData(id: string): Promise<Result<void>> {
      try {
        // Only ever the one Twin's own directory. `camerasDir` is built the
        // same way it is at creation, so this cannot reach outside it.
        await run('rm', ['-rf', `${camerasDir()}/${id}`]);
        return ok(undefined);
      } catch (error) {
        return err(
          domainError(
            'unknown',
            "The camera was removed, but its recordings couldn't be deleted.",
            error instanceof Error ? error.message : String(error)
          )
        );
      }
    },
  };

  return { containers, removal };
};
