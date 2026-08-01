import { adapterFor } from '../../../config/zigbee-adapters';
import { isKnownBrand } from '../../../config/radio-brands';
import type { IdentifiedSerialDevice, SerialDevice } from '../../../domain/radio';

import { listLinuxSerialDevices } from './linux';
import { listMacosSerialDevices } from './macos';
import { listWindowsSerialDevices } from './windows';

/**
 * Serial coordinator enumeration, per platform.
 *
 * Contract 1 (O): a registry keyed on `process.platform`, so supporting another
 * platform is a module plus a row — not a `switch` that grows a branch each
 * time.
 *
 * Identification is shared with the device: `adapterFor` and `isKnownBrand` are
 * the same tables `scripts/detect-radios.sh` applies on the Pi. Without that,
 * a dongle could be claimed on the hub and ignored on a laptop (Contract 4).
 */

export type SerialEnumerator = () => Promise<SerialDevice[]>;

const ENUMERATORS: Record<string, SerialEnumerator> = {
  linux: listLinuxSerialDevices,
  darwin: listMacosSerialDevices,
  win32: listWindowsSerialDevices,
};

export const identify = (device: SerialDevice): IdentifiedSerialDevice => {
  const descriptor = `${device.vendor} ${device.model}`;

  return { ...device, adapter: adapterFor(descriptor), known: isKnownBrand(descriptor) };
};

export const createSerialRadioScanner = (platform: string) => {
  const enumerate = ENUMERATORS[platform];

  return async (): Promise<IdentifiedSerialDevice[]> => {
    // An unlisted platform reports nothing rather than throwing: the rest of
    // the app still works, and cameras do not need a radio at all.
    if (!enumerate) return [];

    return (await enumerate()).map(identify);
  };
};
