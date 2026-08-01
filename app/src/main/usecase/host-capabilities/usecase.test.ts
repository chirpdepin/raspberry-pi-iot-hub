import { describe, expect, it } from 'vitest';

import type { Host } from '../../domain/host';

import type { HostCapabilitiesPorts } from './contract';
import { handleHostCapabilities } from './usecase';

/**
 * The proof that Contract 1 holds: this runs with no Docker, no radio, no
 * network and no Electron. If a use case ever cannot be tested this way, the
 * layering is wrong — fix the layering rather than reaching for a heavier mock.
 */

const host: Host = {
  hostname: 'test-host',
  platform: 'linux',
  arch: 'arm64',
  isRaspberryPi: true,
      model: 'Raspberry Pi 4 Model B Rev 1.5',
  totalMemoryBytes: 8 * 1024 ** 3,
  cpuCount: 4,
};

const ports = (overrides: {
  runtime?: { installed: boolean; running: boolean; version: string | null };
  concentrator?: boolean;
  zigbee?: boolean;
  thread?: boolean;
}): HostCapabilitiesPorts => ({
  hostInfo: { read: async () => host },
  containerRuntime: {
    status: async () => overrides.runtime ?? { installed: true, running: true, version: '29.1.3' },
  },
  radios: {
    hasConcentrator: async () => overrides.concentrator ?? false,
    hasZigbeeCoordinator: async () => overrides.zigbee ?? false,
    hasThreadRadio: async () => overrides.thread ?? false,
  },
});

describe('host-capabilities', () => {
  it('reports every capability as available when the hardware is present', async () => {
    const result = await handleHostCapabilities(ports({ concentrator: true, zigbee: true, thread: true }));

    expect(result.capabilities.cameras.available).toBe(true);
    expect(result.capabilities.lorawan.available).toBe(true);
    expect(result.capabilities.zigbee.available).toBe(true);
    expect(result.capabilities.thread.available).toBe(true);
  });

  it('gives a reason for every unavailable capability, never a bare false', async () => {
    const result = await handleHostCapabilities(
      ports({ runtime: { installed: false, running: false, version: null } })
    );

    // Contract 2 rule 4: an unavailable capability must explain itself, or the
    // UI has nothing to show but an empty box.
    for (const capability of Object.values(result.capabilities)) {
      if (!capability.available) {
        expect(capability.reason, `${capability.name} is unavailable with no reason`).toBeTruthy();
      }
    }
  });

  it('distinguishes Docker missing from Docker stopped', async () => {
    const missing = await handleHostCapabilities(
      ports({ runtime: { installed: false, running: false, version: null } })
    );
    const stopped = await handleHostCapabilities(
      ports({ runtime: { installed: true, running: false, version: '29.1.3' } })
    );

    // These are different screens for the user: [Install Docker] versus
    // [Start Docker]. Collapsing them into one message sends people to
    // reinstall software they already have.
    expect(missing.capabilities.cameras.reason).not.toEqual(stopped.capabilities.cameras.reason);
    expect(stopped.capabilities.cameras.reason).toContain('not running');
  });

  it('does not claim LoRaWAN on a machine with no concentrator', async () => {
    const result = await handleHostCapabilities(ports({ concentrator: false }));

    expect(result.capabilities.lorawan.available).toBe(false);
    expect(result.capabilities.lorawan.reason).toContain('RAK5146');
  });

  it('passes host details through unchanged', async () => {
    const result = await handleHostCapabilities(ports({}));

    expect(result.host).toEqual(host);
  });
});
