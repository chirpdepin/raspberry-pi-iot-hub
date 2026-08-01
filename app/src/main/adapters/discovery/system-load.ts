import { cpus, freemem, loadavg, totalmem } from 'node:os';

import type { SystemLoadSample } from '../../domain/host';
import type { SystemLoadPort } from '../../usecase/system-load/contract';

/**
 * Live machine load, straight from the OS.
 *
 * Reports facts and decides nothing — no thresholds, no percentages. Those
 * belong to the use case, so that changing what counts as "busy" never means
 * touching an adapter.
 *
 * `loadavg()` returns [1, 5, 15] minute averages. The 1-minute figure is the one
 * that responds fast enough to see a camera being added. On Windows it returns
 * zeroes, which reads as an idle machine rather than an error — acceptable,
 * since the memory row still carries real information there.
 */
export const createSystemLoad = (): SystemLoadPort => ({
  async read(): Promise<SystemLoadSample> {
    // loadavg() always returns three entries, but the array type cannot say so.
    const [load1 = 0] = loadavg();

    return {
      load1,
      cpuCount: cpus().length,
      totalMemoryBytes: totalmem(),
      freeMemoryBytes: freemem(),
    };
  },
});
