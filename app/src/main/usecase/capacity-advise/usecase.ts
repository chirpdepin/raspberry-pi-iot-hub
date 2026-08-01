import { CAPACITY_PROFILES, DESKTOP_HEURISTIC } from '../../config/capacity';
import type { Host } from '../../domain/host';

import type { CapacityAdvisePorts, CapacityAdvice } from './contract';

const GIB = 1024 ** 3;

/** Capacity for hardware with no measured profile — a desktop or server. */
const heuristicCapacity = (host: Host): { recommended: number; maximum: number } => {
  const usableCores = Math.max(host.cpuCount - DESKTOP_HEURISTIC.reservedCores, 1);
  const usableGb = Math.max(host.totalMemoryBytes / GIB - DESKTOP_HEURISTIC.reservedGb, 1);

  const byCores = usableCores * DESKTOP_HEURISTIC.camerasPerCore;
  const byMemory = usableGb * DESKTOP_HEURISTIC.camerasPerGb;

  const recommended = Math.max(Math.floor(Math.min(byCores, byMemory)), 1);

  return { recommended, maximum: recommended * 2 };
};

/**
 * Advises on camera capacity.
 *
 * Contract 2: this is **advice, never a block**. The UI offers [Add anyway],
 * because a hard refusal on a number we have not yet measured would be worse
 * than a warning — and silently accepting a camera that then drops frames is
 * worse than both.
 */
export const handleCapacityAdvise = async (ports: CapacityAdvisePorts): Promise<CapacityAdvice> => {
  const [host, current] = await Promise.all([ports.capacity.host(), ports.capacity.cameraCount()]);

  const model = `${host.platform} ${host.arch} ${host.hostname}`.toLowerCase();
  const profile = CAPACITY_PROFILES.find((candidate) => candidate.match.some((needle) => model.includes(needle)));

  const { recommended, maximum } = profile
    ? { recommended: profile.recommended, maximum: profile.maximum }
    : heuristicCapacity(host);

  const warning =
    current >= recommended ? 'Adding another camera may cause dropped recordings on this device.' : undefined;

  return {
    current,
    recommended,
    maximum,
    measured: profile?.measured ?? false,
    warning,
  };
};
