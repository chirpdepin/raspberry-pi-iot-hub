import { domainError, err, type Result } from '../../domain/errors';

import type { ZigbeePermitJoinPorts } from './contract';

/**
 * How long the network stays open for new devices.
 *
 * Long enough for a user to fetch the device and perform its pairing action;
 * short enough that forgetting about it is not a security problem. A
 * permanently open Zigbee network lets any nearby device join uninvited, which
 * is why this is bounded rather than a toggle.
 */
export const JOIN_WINDOW_SECONDS = 60;

/** Guard against a caller asking for an unbounded window. */
const MAX_JOIN_SECONDS = 254;

export const handleZigbeePermitJoin = async (
  ports: ZigbeePermitJoinPorts,
  seconds: number = JOIN_WINDOW_SECONDS
): Promise<Result<void>> => {
  if (seconds <= 0 || seconds > MAX_JOIN_SECONDS) {
    return err(domainError('unknown', 'The pairing window must be between 1 and 254 seconds.'));
  }

  return ports.zigbee.permitJoin(seconds);
};

/** Separate operation, separate export (Contract 1 S). */
export const handleZigbeeStopJoin = async (ports: ZigbeePermitJoinPorts): Promise<Result<void>> =>
  ports.zigbee.stopJoin();
