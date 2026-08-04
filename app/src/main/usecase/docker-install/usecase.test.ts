import { describe, expect, it } from 'vitest';

import type { DockerInstallPorts } from './contract';
import { handleDockerInstall } from './usecase';

const ports = (automatic: boolean) => {
  const calls: string[] = [];

  const value: DockerInstallPorts & { calls: string[] } = {
    installer: {
      canInstallAutomatically: async () => automatic,
      openInstaller: async () => {
        calls.push('openInstaller');
        return { ok: true, value: undefined };
      },
      installEngine: async () => {
        calls.push('installEngine');
        return { ok: true, value: undefined };
      },
    },
    calls,
  };

  return value;
};

describe('docker-install', () => {
  it('installs without sending the user away where we can', async () => {
    const p = ports(true);
    await handleDockerInstall(p);

    // On the hub this matters: its "installer URL" is a documentation page,
    // which is a dead end for someone who has never opened a terminal.
    expect(p.calls).toEqual(['installEngine']);
  });

  it('hands over to the vendor installer everywhere else', async () => {
    const p = ports(false);
    await handleDockerInstall(p);

    // Docker Desktop needs a paid subscription above 250 staff or $10M revenue,
    // so the user has to see and accept Docker's own terms.
    expect(p.calls).toEqual(['openInstaller']);
  });

  it('reports a failure rather than pretending the install started', async () => {
    const p = ports(true);
    p.installer.installEngine = async () => ({
      ok: false,
      error: { code: 'permission-denied', message: 'Permission was not granted, so nothing was changed.' },
    });

    const result = await handleDockerInstall(p);

    expect(result.ok).toBe(false);
  });
});
