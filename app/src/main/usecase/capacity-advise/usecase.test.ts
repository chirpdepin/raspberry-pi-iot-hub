import { describe, expect, it } from 'vitest';

import type { Host } from '../../domain/host';

import type { CapacityAdvisePorts } from './contract';
import { handleCapacityAdvise } from './usecase';

const host = (overrides: Partial<Host> = {}): Host => ({
  hostname: 'workstation',
  platform: 'linux',
  arch: 'x64',
  isRaspberryPi: false,
  model: null,
  totalMemoryBytes: 32 * 1024 ** 3,
  cpuCount: 12,
  ...overrides,
});

/** The machine the figures were measured on. */
const pi4 = (gib: number): Partial<Host> => ({
  isRaspberryPi: true,
  arch: 'arm64',
  hostname: 'iot-hub',
  model: 'Raspberry Pi 4 Model B Rev 1.5',
  cpuCount: 4,
  totalMemoryBytes: gib * 1024 ** 3,
});

const ports = (h: Host, cameraCount: number): CapacityAdvisePorts => ({
  capacity: { host: async () => h, cameraCount: async () => cameraCount },
});

describe('capacity-advise', () => {
  it('gives the measured figure on the board it was measured on', async () => {
    const advice = await handleCapacityAdvise(ports(host(pi4(8)), 0));

    // 6 cameras sat at 39% load on this hardware; 8 was the ceiling.
    expect(advice).toEqual({ current: 0, recommended: 6, applies: true });
  });

  it('says nothing on hardware nobody measured', async () => {
    // A guess for an unmeasured board is worse than silence — inventing these
    // numbers is the bug this whole change exists to fix.
    const desktop = await handleCapacityAdvise(ports(host(), 2));
    const pi3 = await handleCapacityAdvise(ports(host({ isRaspberryPi: true, model: 'Raspberry Pi 3 Model B' }), 2));

    expect(desktop.applies).toBe(false);
    expect(pi3.applies).toBe(false);
  });

  it('matches a board by model, not by hostname or arch', async () => {
    // The original bug: the match string was `platform + arch + hostname`, which
    // on the real hub reads "linux arm64 iot-hub" and contains no model at all,
    // so no profile could ever fire.
    const noModel = await handleCapacityAdvise(ports(host({ ...pi4(8), model: null }), 0));

    expect(noModel.applies).toBe(false);
  });

  it('lets RAM bind once there is not enough of it', async () => {
    // Measured: at 160 MiB a camera and a 900 MiB reserve, the board figure
    // still binds at 2 GB (room for 7) and only RAM binds at 1 GB. With no swap
    // that ceiling is the OOM killer rather than a slowdown, so the RAM term
    // earns its place even though it is inactive on the common boards.
    const large = await handleCapacityAdvise(ports(host(pi4(8)), 0));
    const twoGb = await handleCapacityAdvise(ports(host(pi4(2)), 0));
    const oneGb = await handleCapacityAdvise(ports(host(pi4(1)), 0));

    expect(large.recommended).toBe(6);
    expect(twoGb.recommended).toBe(6);
    expect(oneGb.recommended).toBeLessThan(large.recommended);
  });

  it('never advises fewer than one camera', async () => {
    // A board whose reserve exceeds its RAM would otherwise advise zero, which
    // reads as "this device cannot do cameras" on hardware that manages one.
    const advice = await handleCapacityAdvise(ports(host(pi4(1)), 0));

    expect(advice.recommended).toBeGreaterThanOrEqual(1);
  });

  it('reports the count without ever blocking', async () => {
    // Contract 2: advice, not a refusal. Being over the number is reportable,
    // not preventable — the app still adds the camera.
    const advice = await handleCapacityAdvise(ports(host(pi4(8)), 99));

    expect(advice.current).toBe(99);
    expect(advice).not.toHaveProperty('blocked');
  });

  it('scales with the board, so a faster board is not given the slower one’s limit', async () => {
    const four = await handleCapacityAdvise(ports(host(pi4(8)), 0));
    const five = await handleCapacityAdvise(
      ports(host({ ...pi4(8), model: 'Raspberry Pi 5 Model B Rev 1.0' }), 0)
    );

    expect(five.recommended).toBeGreaterThan(four.recommended);
  });
});
