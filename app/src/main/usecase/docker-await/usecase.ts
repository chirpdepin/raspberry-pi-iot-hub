import { DOCKER_TIMEOUTS } from '../../config/docker';

import type { DockerAwaitOutcome, DockerAwaitPorts } from './contract';

/**
 * Waits until this process can actually run Docker.
 *
 * This is what makes the takeover possible: the user leaves for the installer,
 * and the app keeps checking so it can finish the job without them clicking
 * anything a second time.
 *
 * It polls the **operability** probe rather than a socket, because the socket
 * can answer while our own process still cannot find the CLI — see
 * `docker-command.ts`. Reporting ready too early would hand the resume a Docker
 * it cannot use.
 *
 * Cancellation is checked between polls rather than interrupting one, so a
 * cancel can never leave a probe half-finished.
 */
export const handleDockerAwait = async (ports: DockerAwaitPorts): Promise<DockerAwaitOutcome> => {
  const startedAt = ports.now();

  for (;;) {
    if (ports.isCancelled()) return { kind: 'cancelled' };

    const status = await ports.runtime.status();
    if (status.state === 'ready') return { kind: 'ready' };

    // Giving up is about polling, not about the request. The caller keeps the
    // pending job so the user can resume rather than start again.
    if (ports.now() - startedAt >= DOCKER_TIMEOUTS.pollGiveUpMs) return { kind: 'gave-up' };

    await ports.wait(DOCKER_TIMEOUTS.pollIntervalMs);

    // Checked again after waiting: a cancel that arrives during the sleep must
    // not cost another full probe.
    if (ports.isCancelled()) return { kind: 'cancelled' };
  }
};
