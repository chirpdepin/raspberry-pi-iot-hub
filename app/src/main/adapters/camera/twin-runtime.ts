import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { domainError, err, ok, type Result } from '../../domain/errors';
import type { ContainerRuntimePort } from '../../usecase/camera-add/contract';
import type { TwinRemovalPort } from '../../usecase/camera-remove/contract';

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
 *
 * **State lives in a named Docker volume, not a host directory.** A bind mount
 * was tried and failed on the first camera: the host directory is owned by the
 * desktop user, the Twin runs as its own `twin:lens` account, and the container
 * sat in a retry loop logging `mkdir ./data/config: permission denied` while
 * reporting itself healthy-ish and answering nothing. A named volume is seeded
 * from the image, ownership included, so the Twin's own `chown` in its
 * Dockerfile actually applies. It is also the only option that behaves the same
 * on Windows and macOS, where Docker runs in a VM and host paths and uids do not
 * map through (Contract 3).
 */

export const createTwinRuntime = () => {
  /**
   * The volume holding one Twin's data. Derived once so creation and deletion
   * cannot build the name differently — the version of this bug that deletes
   * another camera's recordings is not one worth risking.
   */
  const dataVolume = (id: string): string => `${id}-data`;

  const containers: ContainerRuntimePort = {
    async createTwin({ id, imageTag, hostPort, seedUsername, seedPassword }): Promise<Result<void>> {
      try {
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
          // Named volume, so its configuration and credentials survive a
          // restart. Nothing is written into it here: the Twin writes its own
          // defaults on first boot and the user configures it from its UI.
          '-v',
          `${dataVolume(id)}:/home/twin/data`,
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
        // Only ever the one Twin's own volume, named the same way it is at
        // creation, so this cannot reach another camera's recordings.
        await run('docker', ['volume', 'rm', dataVolume(id)]);
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
