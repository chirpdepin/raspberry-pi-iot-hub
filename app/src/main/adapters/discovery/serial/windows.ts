import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { SerialDevice } from '../../../domain/radio';

const run = promisify(execFile);

/**
 * Windows enumeration, via PowerShell's PnP device store.
 *
 * **The bus-reported device description is the whole trick.** A port's
 * FriendlyName is the *driver's* name — "Silicon Labs CP210x USB to UART Bridge
 * (COM3)" — which contains neither `SONOFF` nor `MG24`, so matching on it would
 * never identify the coordinator and every dongle would look like a generic
 * bridge. `DEVPKEY_Device_BusReportedDeviceDesc` returns the USB `iProduct`
 * string, which is the same text Linux puts in its by-id name.
 *
 * The serial comes from the instance id: `USB\VID_10C4&PID_EA60\<serial>`.
 *
 * **Unverified on real hardware** — there is no Windows machine here. The
 * parser is tested against recorded output; see IMPLEMENTATION_STATUS.md.
 */

/** Emits one JSON object per port with its COM name, instance id and USB product string. */
export const POWERSHELL_QUERY = [
  '$ErrorActionPreference = "SilentlyContinue";',
  'Get-PnpDevice -Class Ports -PresentOnly |',
  'ForEach-Object {',
  '  $desc = (Get-PnpDeviceProperty -InstanceId $_.InstanceId',
  '            -KeyName "DEVPKEY_Device_BusReportedDeviceDesc").Data;',
  '  [PSCustomObject]@{',
  '    Name = $_.FriendlyName; InstanceId = $_.InstanceId; BusDescription = $desc;',
  '    Manufacturer = $_.Manufacturer',
  '  }',
  '} | ConvertTo-Json -Compress',
].join(' ');

interface PnpPort {
  Name?: string;
  InstanceId?: string;
  BusDescription?: string;
  Manufacturer?: string;
}

/** `COM3` out of `Silicon Labs CP210x USB to UART Bridge (COM3)`. */
export const comPortFrom = (friendlyName: string): string | null =>
  /\((COM\d+)\)\s*$/i.exec(friendlyName)?.[1] ?? null;

/** `USB\VID_10C4&PID_EA60\f620d69a...` -> `f620d69a...` */
export const serialFromInstanceId = (instanceId: string): string => {
  const last = instanceId.split('\\').at(-1) ?? '';
  // Composite devices append `&0000` style interface suffixes, which are not
  // part of the serial and would break role pinning across replug.
  return last.split('&')[0] ?? '';
};

export const parsePowerShellPorts = (json: string): SerialDevice[] => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }

  // ConvertTo-Json emits a bare object rather than an array for a single port.
  const ports: PnpPort[] = Array.isArray(parsed) ? (parsed as PnpPort[]) : [parsed as PnpPort];

  return ports.flatMap((port) => {
    const node = comPortFrom(port.Name ?? '');
    if (!node) return [];

    return [
      {
        node,
        vendor: port.Manufacturer ?? '',
        // The USB product string, not the driver name — see the note above.
        model: port.BusDescription ?? port.Name ?? '',
        serial: serialFromInstanceId(port.InstanceId ?? ''),
      },
    ];
  });
};

export const listWindowsSerialDevices = async (): Promise<SerialDevice[]> => {
  try {
    const { stdout } = await run(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', POWERSHELL_QUERY],
      { timeout: 15_000, windowsHide: true }
    );

    return parsePowerShellPorts(stdout);
  } catch {
    // PowerShell missing or blocked by policy. Reported as no devices rather
    // than crashing the scan; the UI still offers a network coordinator.
    return [];
  }
};
