import { execFile } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { promisify } from 'node:util';

import type { SerialDevice } from '../../../domain/radio';

const run = promisify(execFile);

/**
 * macOS enumeration.
 *
 * macOS has no `/dev/serial/by-id`, and the callout device name carries only
 * the serial — `/dev/cu.usbserial-<SERIAL>` or `/dev/cu.usbmodem<SERIAL><N>`.
 * The vendor and product strings come from `system_profiler SPUSBDataType`,
 * which is built in, and the two are joined on that serial.
 *
 * `cu.*` rather than `tty.*` deliberately: opening a `tty.` device blocks until
 * carrier is asserted, which a USB coordinator never does, so the open would
 * hang. `cu.` is the callout device and does not wait.
 *
 * **Unverified on real hardware** — there is no Mac here. The parser is tested
 * against recorded `system_profiler` output; see IMPLEMENTATION_STATUS.md.
 */

interface UsbNode {
  _name?: string;
  serial_num?: string;
  manufacturer?: string;
  _items?: UsbNode[];
}

/** Flattens the nested USB tree; hubs nest their children arbitrarily deep. */
const flatten = (nodes: UsbNode[]): UsbNode[] =>
  nodes.flatMap((node) => [node, ...flatten(node._items ?? [])]);

export const parseSystemProfiler = (json: string): Map<string, { vendor: string; model: string }> => {
  const index = new Map<string, { vendor: string; model: string }>();

  try {
    const parsed = JSON.parse(json) as { SPUSBDataType?: UsbNode[] };

    for (const node of flatten(parsed.SPUSBDataType ?? [])) {
      if (!node.serial_num) continue;

      index.set(node.serial_num.toLowerCase(), {
        vendor: node.manufacturer ?? '',
        model: node._name ?? '',
      });
    }
  } catch {
    // Malformed output degrades to no USB metadata: devices are still listed
    // from /dev, just without vendor and model.
  }

  return index;
};

/**
 * Extracts the serial embedded in a callout device name.
 *
 * `cu.usbserial-0001` -> `0001`, `cu.usbmodem14201` -> `14201`. The trailing
 * interface digits macOS appends to usbmodem names are not stripped, so the
 * lookup below also tries a prefix match.
 */
export const serialFromCalloutName = (name: string): string =>
  name.replace(/^cu\./, '').replace(/^(usbserial|usbmodem|SLAB_USBtoUART)-?/i, '');

export const listMacosSerialDevices = async (): Promise<SerialDevice[]> => {
  let names: string[];

  try {
    names = (await readdir('/dev')).filter((name) => name.startsWith('cu.'));
  } catch {
    return [];
  }

  // Bluetooth serial ports are always present and are never coordinators.
  const candidates = names.filter((name) => !/bluetooth|debug-console|wlan/i.test(name));
  if (candidates.length === 0) return [];

  let usb = new Map<string, { vendor: string; model: string }>();

  try {
    const { stdout } = await run('system_profiler', ['SPUSBDataType', '-json'], { timeout: 10_000 });
    usb = parseSystemProfiler(stdout);
  } catch {
    // Without it the devices are still reported, just unidentified — better
    // than pretending nothing is attached.
  }

  return candidates.map((name) => {
    const serial = serialFromCalloutName(name);
    const key = serial.toLowerCase();

    // Exact first, then prefix: macOS appends interface digits to usbmodem
    // names, so the node's serial can be longer than the USB one.
    const info =
      usb.get(key) ?? [...usb.entries()].find(([candidate]) => key.startsWith(candidate))?.[1] ?? { vendor: '', model: '' };

    return { node: `/dev/${name}`, vendor: info.vendor, model: info.model, serial };
  });
};
