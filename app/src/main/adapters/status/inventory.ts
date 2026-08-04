import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { TWIN_CONTAINER_PREFIX } from '../../config/images';
import { SERVICE_CONTAINERS, type ServiceName } from '../../config/services';
import type { ContainerState } from './subsystem-probes';
import type { DockerCommandPort } from '../container/docker-command';

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
 * Whether the container behind a unit is actually running.
 *
 * The unit cannot answer this: `Type=oneshot` with `RemainAfterExit=yes` around
 * `docker compose up -d` stays active once the command has returned, whatever
 * the container does afterwards.
 */
export const createContainerState = (docker: DockerCommandPort) => async (unit: string): Promise<ContainerState> => {
  const container = SERVICE_CONTAINERS[unit as ServiceName];
  if (!container) return 'missing';

  try {
    const { stdout } = await docker.run(['inspect', '-f', '{{.State.Status}}', container]);
    return stdout.trim() === 'running' ? 'running' : 'stopped';
  } catch {
    // `docker inspect` fails when the container has never been created — which
    // is "missing", not "stopped": never set up and set up then died get
    // different messages.
    return 'missing';
  }
};

/**
 * Twin containers and whether each is running.
 *
 * Includes stopped ones — a Twin that has stopped is the failure the camera
 * probe exists to report, so filtering to running containers would make the
 * problem invisible.
 */
export const createTwinInventory = (docker: DockerCommandPort) => async (): Promise<{ id: string; running: boolean }[]> => {
  try {
    const { stdout } = await docker.run([
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
