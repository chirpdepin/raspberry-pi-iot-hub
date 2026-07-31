import { readFile } from 'node:fs/promises';
import { arch, cpus, hostname, platform, totalmem } from 'node:os';

import type { Host } from '../../domain/host';
import type { HostInfoPort } from '../../usecase/host-capabilities/contract';

/**
 * Facts about the machine the app is running on.
 *
 * `isRaspberryPi` matters because it is the only place a LoRaWAN HAT can exist,
 * and it drives the wording of the LoRaWAN empty state: on a Pi the message is
 * "fit a concentrator", on a laptop it is "this needs a Raspberry Pi".
 */

const RPI_MODEL_PATH = '/proc/device-tree/model';

const detectRaspberryPi = async (): Promise<boolean> => {
  if (platform() !== 'linux') return false;

  try {
    const model = await readFile(RPI_MODEL_PATH, 'utf8');
    return /raspberry pi/i.test(model);
  } catch {
    return false;
  }
};

export const createHostInfo = (): HostInfoPort => ({
  async read(): Promise<Host> {
    return {
      hostname: hostname(),
      platform: platform(),
      arch: arch(),
      isRaspberryPi: await detectRaspberryPi(),
      totalMemoryBytes: totalmem(),
      cpuCount: cpus().length,
    };
  },
});
