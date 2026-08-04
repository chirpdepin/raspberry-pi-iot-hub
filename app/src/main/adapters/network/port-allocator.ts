import { execFile } from 'node:child_process';
import { createServer } from 'node:net';
import { promisify } from 'node:util';

import type { PortClaimsPort, PortProbePort } from '../../usecase/port-allocate/contract';
import type { DockerCommandPort } from '../container/docker-command';

const run = promisify(execFile);

/**
 * The two halves of "is this port available", as separate ports.
 *
 * Contract 1 (I): a probe and a claims list are different questions with
 * different failure modes, so they are not one interface. The probe cannot see
 * a stopped container; the claims list cannot see a program the user installed
 * themselves. Only both together give the right answer.
 */

export const createPortProbe = (): PortProbePort => ({
  isFree: (port) =>
    new Promise((resolve) => {
      const server = createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => server.close(() => resolve(true)));
      server.listen(port, '127.0.0.1');
    }),
});

/**
 * Host ports published by containers, running or not.
 *
 * `docker ps -a` rather than `docker ps` — that `-a` is the entire point. A
 * stopped Twin keeps its port mapping, and it is the case the kernel cannot
 * report.
 */
export const createPortClaims = (docker: DockerCommandPort): PortClaimsPort => ({
  async published(): Promise<number[]> {
    try {
      const { stdout } = await docker.run(['ps', '-a', '--format', '{{.Ports}}']);

      // Formats seen: "0.0.0.0:18080->80/tcp", "[::]:18080->80/tcp",
      // ":::18080->80/tcp", and several comma-separated on one line.
      return [...stdout.matchAll(/:(\d+)->/g)].map((match) => Number(match[1]));
    } catch {
      // Docker missing or not running means no containers, so nothing is
      // claimed. Failing the allocation here would block adding a camera for a
      // reason that has its own, better error earlier in the flow.
      return [];
    }
  },
});
