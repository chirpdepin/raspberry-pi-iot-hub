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
  totalMemoryBytes: number;
  cpuCount: number;
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
