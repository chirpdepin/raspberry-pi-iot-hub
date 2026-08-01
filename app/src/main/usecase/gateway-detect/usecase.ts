import type { Concentrator } from '../../domain/gateway';

import type { GatewayDetectPorts } from './contract';

/**
 * Returns the fitted concentrator, or null when there is none.
 *
 * Null is not an error — it is the normal answer on a laptop, and the UI turns
 * it into the "LoRaWAN needs a concentrator on a Pi HAT" empty state rather
 * than a failure (Contract 2 rule 4).
 */
export const handleGatewayDetect = async (ports: GatewayDetectPorts): Promise<Concentrator | null> =>
  ports.concentrator.read();
