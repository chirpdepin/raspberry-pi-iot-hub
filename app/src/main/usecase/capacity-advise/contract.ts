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
  maximum: number;
  /** True when the figures come from a real benchmark rather than an estimate. */
  measured: boolean;
  /** English text used as an i18n key, present only when over the recommendation. */
  warning?: string;
}
