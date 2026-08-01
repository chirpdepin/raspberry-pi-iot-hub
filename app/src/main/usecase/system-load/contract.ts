import type { SystemLoadSample } from '../../domain/host';

/**
 * Reads one live sample of machine load.
 *
 * Contract 1 (I): its own narrow port rather than a widened `HostInfoPort`.
 * Static hardware inventory and a live sample are different concerns polled at
 * different rates, and merging them would make every load refresh re-read the
 * device tree and enumerate USB.
 */
export interface SystemLoadPort {
  read(): Promise<SystemLoadSample>;
}

export interface SystemLoadPorts {
  load: SystemLoadPort;
}

export interface SystemLoadReading {
  /** 1-minute load average, as reported. Not clamped. */
  load1: number;
  cpuCount: number;
  /** `load1` against the machine's cores, clamped for display. */
  loadPercent: number;
  usedMemoryBytes: number;
  totalMemoryBytes: number;
  memoryPercent: number;
  /**
   * Whether the machine is under strain, decided here rather than in the view.
   *
   * Computed from the true load, not the clamped percentage, so a badly
   * overloaded machine is not indistinguishable from a merely full one.
   */
  strain: 'normal' | 'high';
}
