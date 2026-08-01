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
 * Whether the hub can drive this radio itself.
 *
 * The **only** place the platform rule lives. Everything else asks this rather
 * than reading `process.platform`, so the reason exists once and the UI cannot
 * drift from it.
 */
export const canRunLocally = (transport: RadioTransport, platform: string): boolean =>
  transport === 'network' || platform === 'linux';

/**
 * Why a detected radio cannot be run here. English text used as an i18n key.
 *
 * Returned only when the radio is genuinely present — this explains a
 * limitation, never an absence, and it names the way forward rather than
 * stopping at "unsupported".
 */
export const unrunnableReason = (transport: RadioTransport, platform: string): string | undefined => {
  if (canRunLocally(transport, platform)) return undefined;

  return 'This dongle is plugged in, but running it needs Linux or the Chirp Hub device. A network coordinator works on any computer.';
};
