import { LOAD_DISPLAY } from '../../config/load';

import type { SystemLoadPorts, SystemLoadReading } from './contract';

const PERCENT = 100;

/**
 * Reports how hard this machine is working.
 *
 * Contract 1 (S): all the arithmetic and the strain threshold live here. The
 * card that displays it formats strings and nothing else — if a component ever
 * needs to divide by `cpuCount`, that logic has escaped into the view.
 *
 * Shown on every machine, Pi or desktop, unlike the camera limit. Watching the
 * number move when a camera is added is the point: it turns "this hardware has
 * limits" from a claim into something visible.
 */
export const handleSystemLoad = async (ports: SystemLoadPorts): Promise<SystemLoadReading> => {
  const sample = await ports.load.read();

  // A machine reporting no cores would otherwise divide by zero and render NaN.
  const cores = Math.max(sample.cpuCount, 1);
  const truePercent = (sample.load1 / cores) * PERCENT;

  const totalMemoryBytes = Math.max(sample.totalMemoryBytes, 1);
  const usedMemoryBytes = Math.max(totalMemoryBytes - sample.freeMemoryBytes, 0);

  return {
    load1: sample.load1,
    cpuCount: cores,
    loadPercent: Math.round(Math.min(truePercent, LOAD_DISPLAY.maxReportedPercent)),
    usedMemoryBytes,
    totalMemoryBytes,
    memoryPercent: Math.round((usedMemoryBytes / totalMemoryBytes) * PERCENT),
    // Deliberately the unclamped value: a machine at 600% is strained, and
    // testing the clamped one would report it as merely full.
    strain: truePercent >= LOAD_DISPLAY.highPercent ? 'high' : 'normal',
  };
};
