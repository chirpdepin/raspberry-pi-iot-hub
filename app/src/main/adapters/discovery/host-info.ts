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

/**
 * The board's own name, or null off a device tree.
 *
 * Read once and **returned**, not just tested. It used to be read here, checked
 * against /raspberry pi/ and thrown away, which left nothing downstream able to
 * tell a Pi 3 from a Pi 5.
 *
 * The file is NUL-terminated, hence the trim of `\0`.
 */
const readBoardModel = async (): Promise<string | null> => {
  if (platform() !== 'linux') return null;

  try {
    const model = await readFile(RPI_MODEL_PATH, 'utf8');
    return model.replace(/\0/g, '').trim() || null;
  } catch {
    return null;
  }
};

export const createHostInfo = (): HostInfoPort => ({
  async read(): Promise<Host> {
    const model = await readBoardModel();

    return {
      hostname: hostname(),
      platform: platform(),
      arch: arch(),
      // Classification stays here because it is one fact about the machine; the
      // adapter reports facts and decides no policy beyond that.
      isRaspberryPi: model !== null && /raspberry pi/i.test(model),
      model,
      totalMemoryBytes: totalmem(),
      cpuCount: cpus().length,
    };
  },
});
