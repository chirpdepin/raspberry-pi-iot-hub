/**
 * Radios, modelled by **transport** rather than by being USB devices.
 *
 * Contract 1: no imports.
 *
 * A coordinator reaches the hub one of two ways, and which one decides far more
 * than the wording on a screen:
 *
 * - `serial`  — a USB dongle. Needs a Linux **host**, because Docker Desktop on
 *   Windows and macOS runs containers inside a Linux VM and gives them no USB
 *   passthrough: the dongle is attached to the host, not to the VM.
 * - `network` — a coordinator reachable over TCP (SLZB-06, Dongle Max over
 *   PoE). Works on every platform, because a container's networking works
 *   everywhere.
 *
 * Modelling this as transport rather than platform is what keeps the rule in
 * one place. Camera Twins are unaffected either way — a Twin talks to a camera
 * over IP and never touches USB, so cameras work on all three platforms.
 */

import type { ZigbeeAdapter } from './zigbee';

export type RadioTransport = 'serial' | 'network';

export type RadioRole = 'zigbee' | 'thread';

/** A serial device seen on this machine, before any role is assigned. */
export interface SerialDevice {
  /** OS handle: `/dev/ttyUSB0`, `/dev/cu.usbserial-x`, `COM3`. */
  node: string;
  vendor: string;
  model: string;
  /** USB serial number — stable across ports and reboots, so roles pin to it. */
  serial: string;
}

/**
 * A serial device plus what the shared registries made of it.
 *
 * Lives here rather than beside the enumerator because use cases speak in these
 * terms: a use case that imported it from an adapter would depend on the
 * adapter, which is the dependency rule the boundary checker enforces — and it
 * caught exactly that when this type started life in `adapters/`.
 */
export interface IdentifiedSerialDevice extends SerialDevice {
  /** Zigbee2MQTT driver, or null when the descriptor is inconclusive. */
  adapter: ZigbeeAdapter | null;
  /**
   * Whether the brand is recognised well enough to auto-claim a role.
   *
   * Unrecognised devices are still listed — a user with an unusual coordinator
   * can still see it — they are just never claimed silently.
   */
  known: boolean;
}

/**
 * A human-readable name for a device.
 *
 * Vendors routinely repeat their own name in the product string — the SONOFF
 * dongle reports vendor `SONOFF` and product `SONOFF Dongle Plus MG24`, so
 * joining them naively yields "SONOFF SONOFF Dongle Plus MG24". The vendor is
 * only prepended when the model does not already carry it.
 */
export const describeDevice = (vendor: string, model: string): string => {
  const trimmedVendor = vendor.trim();
  const trimmedModel = model.trim();

  if (!trimmedModel) return trimmedVendor;
  if (!trimmedVendor) return trimmedModel;
  if (trimmedModel.toLowerCase().startsWith(trimmedVendor.toLowerCase())) return trimmedModel;

  return `${trimmedVendor} ${trimmedModel}`;
};

/**
 * Whether the hub can drive this radio itself.
 *
 * The **only** place the platform rule lives. Everything else asks this rather
 * than reading `process.platform`, so the reason exists once and the UI cannot
 * drift from it.
 */
export const canRunLocally = (transport: RadioTransport, platform: string): boolean =>
  transport === 'network' || platform === 'linux';
