import { readdir, readlink } from 'node:fs/promises';
import { basename, resolve as resolvePath, dirname } from 'node:path';

import type { SerialDevice } from '../../../domain/radio';

/**
 * Linux enumeration, from `/dev/serial/by-id/`.
 *
 * Mirrors `scripts/detect-radios.sh`, which walks the same directory. The name
 * carries everything needed, so there is no `udevadm` shell-out: it works in a
 * sandboxed process and wherever udev's property database is unavailable.
 */

export const BY_ID_DIR = '/dev/serial/by-id';

/**
 * Parses a by-id link name.
 *
 * The kernel formats these `usb-<VENDOR>_<MODEL>_<SERIAL>-if<NN>-port<N>`, with
 * spaces replaced by underscores — which is why vendor and model cannot simply
 * be split on `_`. The serial is the **last** underscore-separated field, so it
 * is taken from the end and whatever precedes it is vendor plus model.
 *
 * A real example from this machine:
 *   usb-SONOFF_SONOFF_Dongle_Plus_MG24_f620d69ac39aef11aa72ad9061ce3355-if00-port0
 *     vendor+model -> "SONOFF SONOFF Dongle Plus MG24"
 *     serial       -> "f620d69ac39aef11aa72ad9061ce3355"
 *
 * Vendor and model are not split apart: the registries match against the two
 * combined, and a wrong split would be a silent misidentification.
 */
export const parseByIdName = (name: string): { vendor: string; model: string; serial: string } | null => {
  if (!name.startsWith('usb-')) return null;

  // Drop the interface/port suffix the kernel appends for multi-interface
  // devices; it describes the endpoint, not the hardware.
  const body = name.replace(/^usb-/, '').replace(/-if[0-9a-f]{2}(-port\d+)?$/i, '');
  const parts = body.split('_').filter(Boolean);
  if (parts.length === 0) return null;

  // A single field means a device that published no serial number. It is still
  // shown; it simply cannot have a role pinned to it.
  if (parts.length === 1) return { vendor: parts[0] ?? '', model: '', serial: '' };

  const serial = parts.at(-1) ?? '';
  const rest = parts.slice(0, -1);

  return { vendor: rest[0] ?? '', model: rest.slice(1).join(' '), serial };
};

export const listLinuxSerialDevices = async (): Promise<SerialDevice[]> => {
  let names: string[];

  try {
    names = await readdir(BY_ID_DIR);
  } catch {
    // The directory only exists once a USB serial device has been attached.
    // Its absence means none is, which is an answer rather than a failure.
    return [];
  }

  const devices = await Promise.all(
    names.map(async (name) => {
      const parsed = parseByIdName(name);
      if (!parsed) return null;

      try {
        const target = await readlink(`${BY_ID_DIR}/${name}`);
        const node = resolvePath(dirname(`${BY_ID_DIR}/${name}`), target);

        return { node, vendor: parsed.vendor, model: parsed.model, serial: parsed.serial };
      } catch {
        // A link that vanished between listing and reading — the dongle was
        // unplugged mid-scan. Skip it; the next poll will agree.
        return null;
      }
    })
  );

  return devices.filter((device): device is SerialDevice => device !== null && basename(device.node).length > 0);
};
