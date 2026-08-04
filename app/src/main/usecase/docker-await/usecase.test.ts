import { describe, expect, it } from 'vitest';

import { DOCKER_TIMEOUTS } from '../../config/docker';
import type { RuntimeState } from '../docker-status/contract';

import type { DockerAwaitPorts } from './contract';
import { handleDockerAwait } from './usecase';

/**
 * A fake clock, so a fifteen-minute give-up does not take fifteen minutes to
 * test. Time only moves when the use case waits, which is also how the real
 * thing behaves.
 */
const ports = (states: RuntimeState[], options: { cancelAfter?: number } = {}): DockerAwaitPorts & { polls: () => number } => {
  let clock = 0;
  let calls = 0;

  return {
    runtime: {
      status: async () => {
        const state = states[Math.min(calls, states.length - 1)] ?? 'missing';
        calls += 1;
        return { state, version: null };
      },
      start: async () => ({ ok: true, value: undefined }),
    },
    wait: async (ms) => {
      clock += ms;
    },
    now: () => clock,
    isCancelled: () => options.cancelAfter !== undefined && calls >= options.cancelAfter,
    polls: () => calls,
  };
};

describe('docker-await', () => {
  it('resolves as soon as the runtime can be used', async () => {
    const result = await handleDockerAwait(ports(['ready']));

    expect(result).toEqual({ kind: 'ready' });
  });

  it('keeps waiting through the states an install passes through', async () => {
    // A real install goes missing → stopped (Docker Desktop starting) → ready.
    // Stopping at the first non-ready answer would abandon the user mid-install.
    const p = ports(['missing', 'missing', 'stopped', 'ready']);

    expect(await handleDockerAwait(p)).toEqual({ kind: 'ready' });
    expect(p.polls()).toBe(4);
  });

  it('stops when the user cancels, without another probe', async () => {
    const result = await handleDockerAwait(ports(['missing'], { cancelAfter: 2 }));

    expect(result).toEqual({ kind: 'cancelled' });
  });

  it('gives up eventually rather than polling forever', async () => {
    const result = await handleDockerAwait(ports(['missing']));

    // "gave-up" is about polling only. The caller keeps the job, so a slow
    // installer does not make the app forget what the user asked for.
    expect(result).toEqual({ kind: 'gave-up' });
  });

  it('gives up no earlier than the configured window', async () => {
    const p = ports(['missing']);
    await handleDockerAwait(p);

    // Enough polls to have spanned the window, not a couple.
    expect(p.polls()).toBeGreaterThanOrEqual(DOCKER_TIMEOUTS.pollGiveUpMs / DOCKER_TIMEOUTS.pollIntervalMs);
  });
});
