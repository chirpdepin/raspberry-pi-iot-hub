import type { Host } from '../../domain/host';

export interface CapacityAdvisorPort {
  host(): Promise<Host>;
  /** How many cameras are configured right now. */
  cameraCount(): Promise<number>;
}

export interface CapacityAdvisePorts {
  capacity: CapacityAdvisorPort;
}

export interface CapacityAdvice {
  current: number;
  recommended: number;
  /**
   * False when this machine's camera capacity has not been measured, which is
   * every board absent from BOARD_COSTS and every desktop.
   *
   * The decision belongs here, not in the view: a component asking "is this a
   * Raspberry Pi?" would re-decide hardware policy in the renderer, and would go
   * stale the moment a second board is measured.
   */
  applies: boolean;
}
