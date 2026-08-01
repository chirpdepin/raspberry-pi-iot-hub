/**
 * The machine the app is running on, and what it can therefore do.
 *
 * Contract 2 rule 4: capabilities are never hidden. A desktop with no LoRaWAN
 * radio still shows the LoRaWAN section, with an empty state explaining what
 * hardware is required — a user who cannot find a feature assumes the app is
 * broken, whereas one who is told why knows what to buy.
 */

export interface Host {
  hostname: string;
  platform: string;
  arch: string;
  /** True on a Raspberry Pi, which is the only place a LoRaWAN HAT can exist. */
  isRaspberryPi: boolean;
  /**
   * The board's own name, e.g. `Raspberry Pi 4 Model B Rev 1.5`. Null anywhere
   * that does not publish one.
   *
   * Carried because `isRaspberryPi` alone cannot tell a Pi 3 from a Pi 5, and
   * capacity advice was matching against `platform + arch + hostname` — which on
   * the hub reads `linux arm64 iot-hub` and contains no model at all, so no
   * board profile could ever match and every Pi fell through to the desktop
   * heuristic.
   */
  model: string | null;
  totalMemoryBytes: number;
  cpuCount: number;
}

/**
 * A single reading of how hard the machine is working right now.
 *
 * Separate from `Host` because these change every few seconds while `Host` is
 * effectively fixed for the life of the process — different concern, different
 * refresh rate, so a different port reads it.
 *
 * `load1` is the 1-minute load average, which counts processes waiting on I/O
 * as well as processes on CPU. That is deliberate and is the whole reason this
 * is load rather than CPU percentage: measured on the hub, `docker stats`
 * reported half a core busy while the real load was 1.57, because most of the
 * cost of a camera is blocked I/O that CPU percentage does not see.
 */
export interface SystemLoadSample {
  load1: number;
  cpuCount: number;
  totalMemoryBytes: number;
  freeMemoryBytes: number;
}

export type CapabilityName = 'cameras' | 'lorawan' | 'zigbee' | 'thread';

export interface Capability {
  name: CapabilityName;
  available: boolean;
  /**
   * Why it is unavailable, as English text used directly as an i18n key.
   * Undefined when available.
   */
  reason?: string;
}

export type Capabilities = Record<CapabilityName, Capability>;
