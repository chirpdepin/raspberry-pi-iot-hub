import type { ZigbeeDevice } from '../../domain/zigbee';

import type { ZigbeeDeviceListPorts } from './contract';

/**
 * Lists paired devices with **two** independent status flags.
 *
 * That pair is the whole troubleshooting story: it answers "is it my device or
 * your cloud?" without a support ticket. Four distinct failures are
 * distinguishable from it:
 *
 *   not in the list          -> never paired; try pairing again
 *   in the list, not seen    -> asleep or out of range; check signal
 *   hub yes, Chirp no        -> the bridge or its credentials
 *   both yes, no readings    -> the sensor mapping
 *
 * Collapsing them into one "online" flag would make every one of those look
 * identical.
 *
 * If Chirp is unreachable the local list is still returned, with every device
 * marked not-connected-to-Chirp. A cloud outage must not blank the page that
 * exists to diagnose it.
 */
export const handleZigbeeDeviceList = async (ports: ZigbeeDeviceListPorts): Promise<ZigbeeDevice[]> => {
  const [local, provisioned] = await Promise.all([
    ports.zigbee.devices(),
    ports.chirp.provisionedIds().catch(() => [] as string[]),
  ]);

  const inChirp = new Set(provisioned);

  return local.map((device) => ({
    ...device,
    connectedToChirp: inChirp.has(device.ieeeAddress),
  }));
};
