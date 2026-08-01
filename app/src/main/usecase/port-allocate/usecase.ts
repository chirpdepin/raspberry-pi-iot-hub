import { domainError, err, ok } from '../../domain/errors';
import { reservedPortFor, TWIN_PORT_RANGE } from '../../config/ports';

import type { PortAllocatePorts, PortAllocateResult } from './contract';

/**
 * Finds a host port nothing else owns.
 *
 * Three filters, and all three are needed:
 *
 *   1. not in the reserved table  — a stopped Zigbee2MQTT frees 8080 to the
 *      kernel while still owning it, so liveness alone would give it away
 *   2. not already published by a container — same problem, per Twin
 *   3. actually bindable — catches anything outside the hub entirely, such as a
 *      program the user installed themselves
 *
 * Returns a Result rather than a number. The previous implementation fell back
 * to the first port in the range when it found nothing, which produced a
 * plausible-looking port that was guaranteed to fail at bind — a silent wrong
 * answer where an honest failure was available.
 */
export const handlePortAllocate = async (ports: PortAllocatePorts): Promise<PortAllocateResult> => {
  const claimed = new Set(await ports.claims.published());

  for (let port = TWIN_PORT_RANGE.start; port <= TWIN_PORT_RANGE.end; port++) {
    if (reservedPortFor(port) || claimed.has(port)) continue;
    if (await ports.probe.isFree(port)) return ok(port);
  }

  const span = TWIN_PORT_RANGE.end - TWIN_PORT_RANGE.start + 1;

  // Contract 2 rule 2 and rule 6: a cause and a next action. Hitting this means
  // roughly a hundred cameras, so "remove one you no longer use" is the honest
  // advice rather than "try again".
  return err(
    domainError(
      'unknown',
      "This device has run out of free connections for new cameras. Remove a camera you no longer use, then try again.",
      `no free port in ${TWIN_PORT_RANGE.start}-${TWIN_PORT_RANGE.end} (${span} checked, ${claimed.size} claimed by containers)`
    )
  );
};
