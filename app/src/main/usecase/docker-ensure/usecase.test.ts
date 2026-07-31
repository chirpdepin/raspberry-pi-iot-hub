import { describe, expect, it, vi } from 'vitest';

import { ok } from '../../domain/errors';

import type { DockerEnsurePorts, RuntimeStatus } from './contract';
import { handleDockerEnsure, handleDockerInstall } from './usecase';

const ports = (status: RuntimeStatus, openInstaller = vi.fn(async () => ok(undefined))): DockerEnsurePorts => ({
  runtime: {
    status: async () => status,
    openInstaller,
  },
});

describe('docker-ensure', () => {
  it('offers no action when the runtime is ready', async () => {
    const result = await handleDockerEnsure(ports({ state: 'ready', version: '29.1.3' }));

    expect(result.message).toBeUndefined();
    expect(result.action).toBeUndefined();
  });

  it('offers exactly one action per state, and different actions for missing vs stopped', async () => {
    const missing = await handleDockerEnsure(ports({ state: 'missing', version: null }));
    const stopped = await handleDockerEnsure(ports({ state: 'stopped', version: '29.1.3' }));

    expect(missing.action).toBe('Install Docker');
    expect(stopped.action).toBe('Start Docker');
    expect(missing.message).not.toEqual(stopped.message);
  });

  it('never installs as a side effect of checking', async () => {
    const openInstaller = vi.fn(async () => ok(undefined));
    await handleDockerEnsure(ports({ state: 'missing', version: null }, openInstaller));

    // Contract 2: a silent install could put a business user in breach of the
    // Docker Desktop licence without their knowledge. Installing must be an
    // explicit, separate call.
    expect(openInstaller).not.toHaveBeenCalled();
  });

  it('launches the installer only when explicitly asked', async () => {
    const openInstaller = vi.fn(async () => ok(undefined));
    await handleDockerInstall(ports({ state: 'missing', version: null }, openInstaller));

    expect(openInstaller).toHaveBeenCalledOnce();
  });
});
