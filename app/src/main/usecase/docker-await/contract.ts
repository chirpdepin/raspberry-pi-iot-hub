import type { ContainerRuntimeStatusPort } from '../docker-status/contract';

/**
 * Ports for waiting until Docker can actually be used.
 *
 * Contract 1 (D): the clock is injected. A use case that calls `setTimeout`
 * cannot be tested without really waiting, and a fifteen-minute give-up would
 * mean a fifteen-minute test.
 */
export interface DockerAwaitPorts {
  runtime: ContainerRuntimeStatusPort;
  /** Injected delay. */
  wait(ms: number): Promise<void>;
  /** Wall clock, injected for the same reason. */
  now(): number;
  /** True once the user has cancelled, checked between polls. */
  isCancelled(): boolean;
}

export type DockerAwaitOutcome =
  | { kind: 'ready' }
  | { kind: 'cancelled' }
  /**
   * Polling stopped, but **the request is not abandoned**. A slow installer must
   * not make the app forget what the user asked for moments before Docker
   * arrives, so the pending job survives this and the UI offers to check again.
   */
  | { kind: 'gave-up' };
