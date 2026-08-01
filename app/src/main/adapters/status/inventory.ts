import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { TWIN_CONTAINER_PREFIX } from '../../config/images';

const run = promisify(execFile);

/**
 * Read-only inventory used by the subsystem probes.
 *
 * Kept apart from the adapters that *change* things: a probe must be safe to
 * run on a timer, so nothing here writes, starts or installs anything.
 */

/**
 * Whether the gateway has its LNS credentials.
 *
 * `tc.uri` specifically, and only that file. The systemd unit gates on tc.uri
 * for the same reason, and `gateway-provision` writes it LAST — so its presence
 * means all four files landed, while checking any of the other three could
 * report "configured" for a half-finished install.
 */
export const createCredentialsCheck = (credentialsDir: string) => async (): Promise<boolean> => {
  try {
    await access(join(credentialsDir, 'tc.uri'));
    return true;
  } catch {
    return false;
  }
};

/**
 * Twin containers and whether each is running.
 *
 * Includes stopped ones — a Twin that has stopped is the failure the camera
 * probe exists to report, so filtering to running containers would make the
 * problem invisible.
 */
export const createTwinInventory = () => async (): Promise<{ id: string; running: boolean }[]> => {
  try {
    const { stdout } = await run('docker', [
      'ps',
      '-a',
      '--filter',
      `name=${TWIN_CONTAINER_PREFIX}`,
      '--format',
      '{{.Names}}\t{{.State}}',
    ]);

    return stdout
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => {
        const [id = '', state = ''] = line.split('\t');
        return { id, running: state === 'running' };
      });
  } catch {
    // Docker missing or down is the container runtime's own failure, reported
    // by the probe's runtimeReady check with a better message than "no
    // cameras". Returning an empty list here lets that check speak first.
    return [];
  }
};
