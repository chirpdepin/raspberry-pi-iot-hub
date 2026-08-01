import { BOARD_COSTS, MIB } from '../../config/capacity';

import type { CapacityAdvisePorts, CapacityAdvice } from './contract';

/**
 * Advises on camera capacity.
 *
 * Contract 2: this is **advice, never a block**. The app still lets the user add
 * a camera past the number, because the cost of a camera depends on its
 * resolution, keyframe interval and how busy its scene is — none of which this
 * can know in advance.
 *
 * Two limits, and whichever runs out first wins:
 *
 * - the **board figure**, measured on that hardware, which is what binds on the
 *   4 GB and 8 GB Pi 4 (they have RAM for far more cameras than they have CPU
 *   and I/O for);
 * - **RAM**, which at the measured cost only binds on the 1 GB Pi 4. That term
 *   is not decoration even so: the hub image has no swap, so exhausting RAM is
 *   the OOM killer rather than a slowdown, and a future board with a cheaper
 *   camera cost would reach the memory wall first.
 */
export const handleCapacityAdvise = async (ports: CapacityAdvisePorts): Promise<CapacityAdvice> => {
  const [host, current] = await Promise.all([ports.capacity.host(), ports.capacity.cameraCount()]);

  const model = host.model?.toLowerCase() ?? '';
  const board = BOARD_COSTS.find((candidate) => candidate.match.some((needle) => model.includes(needle)));

  // Hardware nobody measured gets no number at all. Publishing a figure for an
  // unmeasured board is exactly how the previous invented profiles got here.
  if (!board) {
    return { current, recommended: 0, applies: false };
  }

  const byRam = Math.floor((host.totalMemoryBytes / MIB - board.reservedRamMib) / board.ramMibPerCamera);

  return {
    current,
    recommended: Math.max(1, Math.min(byRam, board.camerasRecommended)),
    applies: true,
  };
};
