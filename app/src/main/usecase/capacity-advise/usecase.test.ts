import { describe, expect, it } from 'vitest';

import type { Host } from '../../domain/host';

import type { CapacityAdvisePorts } from './contract';
import { handleCapacityAdvise } from './usecase';

const host = (overrides: Partial<Host> = {}): Host => ({
  hostname: 'workstation',
  platform: 'linux',
  arch: 'x64',
  isRaspberryPi: false,
  totalMemoryBytes: 32 * 1024 ** 3,
  cpuCount: 12,
  ...overrides,
});

const ports = (h: Host, cameraCount: number): CapacityAdvisePorts => ({
  capacity: { host: async () => h, cameraCount: async () => cameraCount },
});

describe('capacity-advise', () => {
  it('scales with the hardware rather than using one fixed number', async () => {
    const big = await handleCapacityAdvise(ports(host({ cpuCount: 12, totalMemoryBytes: 32 * 1024 ** 3 }), 0));
    const small = await handleCapacityAdvise(ports(host({ cpuCount: 4, totalMemoryBytes: 8 * 1024 ** 3 }), 0));

    // A workstation's capacity has nothing to do with a Pi's.
    expect(big.recommended).toBeGreaterThan(small.recommended);
  });

  it('never advises fewer than one camera', async () => {
    const advice = await handleCapacityAdvise(ports(host({ cpuCount: 1, totalMemoryBytes: 1024 ** 3 }), 0));

    expect(advice.recommended).toBeGreaterThanOrEqual(1);
  });

  it('warns at the recommendation but never blocks', async () => {
    const advice = await handleCapacityAdvise(ports(host({ cpuCount: 4, totalMemoryBytes: 8 * 1024 ** 3 }), 99));

    // Advice, not a refusal: the UI offers [Add anyway]. A hard limit on a
    // number nobody has measured would be worse than a warning.
    expect(advice.warning).toBeTruthy();
    expect(advice).not.toHaveProperty('blocked');
  });

  it('does not warn below the recommendation', async () => {
    const advice = await handleCapacityAdvise(ports(host(), 0));

    expect(advice.warning).toBeUndefined();
  });

  it('reports figures as unmeasured until a benchmark replaces them', async () => {
    const advice = await handleCapacityAdvise(ports(host(), 0));

    // Honesty matters here: presenting an estimate as a measurement would make
    // a dropped-frame report look like a product defect rather than a guess.
    expect(advice.measured).toBe(false);
  });
});
