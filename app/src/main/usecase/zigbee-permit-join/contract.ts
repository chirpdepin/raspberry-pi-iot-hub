import type { Result } from '../../domain/errors';

export interface PermitJoinPort {
  /** Opens the network for `seconds`, then closes it automatically. */
  permitJoin(seconds: number): Promise<Result<void>>;
  /** Closes the join window early. */
  stopJoin(): Promise<Result<void>>;
}

export interface ZigbeePermitJoinPorts {
  zigbee: PermitJoinPort;
}
