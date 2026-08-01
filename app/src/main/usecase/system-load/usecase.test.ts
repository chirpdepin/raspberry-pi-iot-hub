import { describe, expect, it } from 'vitest';

import type { SystemLoadSample } from '../../domain/host';

import type { SystemLoadPorts } from './contract';
import { handleSystemLoad } from './usecase';

const GIB = 1024 ** 3;

const ports = (sample: Partial<SystemLoadSample> = {}): SystemLoadPorts => ({
  load: {
    read: async () => ({
      load1: 1.57,
      cpuCount: 4,
      totalMemoryBytes: 8 * GIB,
      freeMemoryBytes: 6 * GIB,
      ...sample,
    }),
  },
});

describe('system-load', () => {
  it('reports load against the machine’s own cores', async () => {
    // The hub's measured 6-camera figure: 1.57 of 4 cores.
    const reading = await handleSystemLoad(ports());

    expect(reading.loadPercent).toBe(39);
    expect(reading.load1).toBe(1.57);
    expect(reading.strain).toBe('normal');
  });

  it('reports memory used, not memory free', async () => {
    const reading = await handleSystemLoad(ports({ totalMemoryBytes: 8 * GIB, freeMemoryBytes: 6 * GIB }));

    expect(reading.usedMemoryBytes).toBe(2 * GIB);
    expect(reading.memoryPercent).toBe(25);
  });

  it('turns strained only past the threshold', async () => {
    const busy = await handleSystemLoad(ports({ load1: 3.96 }));
    const easy = await handleSystemLoad(ports({ load1: 2.0 }));

    // 3.96 of 4 cores is the measured point where the hub is fully committed.
    expect(busy.strain).toBe('high');
    expect(easy.strain).toBe('normal');
  });

  it('clamps the displayed percentage but not the strain decision', async () => {
    // The hub genuinely reached load 24 on 4 cores while thrashing. The bar must
    // not overflow, but this must still read as strained rather than "full".
    const reading = await handleSystemLoad(ports({ load1: 24 }));

    expect(reading.loadPercent).toBe(100);
    expect(reading.strain).toBe('high');
    expect(reading.load1).toBe(24);
  });

  it('survives a machine that reports no cores or no memory', async () => {
    // Guards a divide-by-zero that would render NaN% in the UI.
    const reading = await handleSystemLoad(ports({ cpuCount: 0, totalMemoryBytes: 0, freeMemoryBytes: 0 }));

    expect(Number.isFinite(reading.loadPercent)).toBe(true);
    expect(Number.isFinite(reading.memoryPercent)).toBe(true);
  });
});
