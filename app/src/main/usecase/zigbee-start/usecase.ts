import { domainError, err, ok, type Result } from '../../domain/errors';

import type { ZigbeeStartPorts } from './contract';

/**
 * Channel 15.
 *
 * Zigbee channel 11 overlaps Wi-Fi channel 1, which is the most common cause of
 * "Zigbee is flaky" on a hub whose own Wi-Fi is in use. Channels 15, 20 and 25
 * sit between the common Wi-Fi channels; 15 is the usual first choice.
 */
export const DEFAULT_ZIGBEE_CHANNEL = 15;

export const handleZigbeeStart = async (
  ports: ZigbeeStartPorts,
  channel: number = DEFAULT_ZIGBEE_CHANNEL
): Promise<Result<void>> => {
  const coordinator = await ports.service.coordinator();

  if (!coordinator) {
    return err(
      domainError('unknown', 'No Zigbee coordinator found. Plug in a supported USB dongle and it will appear here.')
    );
  }

  if (!coordinator.adapter) {
    // Guessing the adapter is worse than asking: the wrong one fails with
    // "failed to connect to the adapter", which points at the cable rather than
    // at the setting that is actually wrong.
    return err(
      domainError(
        'unknown',
        "This coordinator's type could not be detected automatically. Choose it in advanced settings."
      )
    );
  }

  if (await ports.service.isRunning()) {
    return ok(undefined);
  }

  return ports.service.start({
    channel,
    port: coordinator.port,
    adapter: coordinator.adapter,
  });
};
