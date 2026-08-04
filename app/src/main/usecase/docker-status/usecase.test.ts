import { describe, expect, it } from 'vitest';

import type { DockerStatusPorts, RuntimeState } from './contract';
import { handleDockerStatus } from './usecase';

const ports = (state: RuntimeState): DockerStatusPorts => ({
  runtime: {
    status: async () => ({ state, version: state === 'ready' ? '28.1.1' : null }),
    start: async () => ({ ok: true, value: undefined }),
  },
});

describe('docker-status', () => {
  it('offers nothing to do when the runtime works', async () => {
    const result = await handleDockerStatus(ports('ready'));

    expect(result.message).toBeUndefined();
    expect(result.action).toBeUndefined();
  });

  it('offers to START a stopped runtime, not to reinstall it', async () => {
    const result = await handleDockerStatus(ports('stopped'));

    // The dashboard's "Start Docker" button used to call the installer, which
    // offered to reinstall Docker to someone whose Docker was merely not running.
    expect(result.action).toBe('Start Docker');
  });

  it('treats a permission problem as its own state', async () => {
    const result = await handleDockerStatus(ports('needs-permission'));

    // Docker is installed AND running here. Reporting it as missing would send
    // a Linux user to reinstall software they already have.
    expect(result.action).not.toBe('Install Docker');
    expect(result.message).toMatch(/not allowed/i);
  });

  it('never reports an unexplained failure as "not installed"', async () => {
    const result = await handleDockerStatus(ports('unknown'));

    expect(result.action).toBe('Check again');
  });

  it('offers the install only when Docker is genuinely absent', async () => {
    const result = await handleDockerStatus(ports('missing'));

    expect(result.action).toBe('Install Docker');
  });
});
