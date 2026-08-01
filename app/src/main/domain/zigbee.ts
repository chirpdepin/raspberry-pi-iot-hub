/**
 * Zigbee domain.
 *
 * Contract 1: no imports.
 */

/** Zigbee2MQTT adapter driver, derived from the coordinator's chip family. */
export type ZigbeeAdapter = 'ember' | 'zstack' | 'deconz' | 'zboss';

export interface ZigbeeCoordinator {
  model: string;
  /** The stable udev role symlink, never /dev/ttyUSB*. */
  port: string;
  adapter: ZigbeeAdapter | null;
  serial: string;
}

/**
 * A paired device.
 *
 * `ieeeAddress` is the identity. It is also the Zigbee2MQTT `friendly_name`,
 * and therefore the MQTT topic — see NEVER_RENAME below.
 */
export interface ZigbeeDevice {
  ieeeAddress: string;
  /** Human-readable name shown in this app and in Chirp. Never the MQTT topic. */
  displayName: string;
  type: string;
  manufacturer: string | null;
  model: string | null;
  /** Link quality indicator, 0-255. Higher is better. */
  linkQuality: number | null;
  batteryPercent: number | null;
  lastSeen: string | null;
  /** Whether messages are reaching the local broker. */
  connectedToHub: boolean;
  /** Whether the device has been provisioned into Chirp. */
  connectedToChirp: boolean;
}

/**
 * Zigbee2MQTT publishes to `zigbee2mqtt/<friendly_name>`, and friendly_name
 * defaults to the IEEE address. **Renaming it changes the MQTT topic**, which
 * silently breaks every device already provisioned in Chirp against the old
 * topic.
 *
 * So friendly_name stays the IEEE address forever and the human-readable name
 * lives in this app and in Chirp. This is the single most important invariant
 * in the Zigbee flow.
 */
export const NEVER_RENAME_FRIENDLY_NAME = true;

/** The MQTT topic a device publishes on, given the local base topic. */
export const deviceTopic = (baseTopic: string, ieeeAddress: string): string => `${baseTopic}/${ieeeAddress}`;

/**
 * The topic Chirp sees, after the Mosquitto bridge rewrites the prefix.
 *
 * The remote prefix MUST differ from the local one or the bridge re-publishes
 * what it just received, forever.
 */
export const chirpDeviceTopicTemplate = (gatewayEui: string): string => `chirp/${gatewayEui}/zigbee/{{deviceId}}`;

/**
 * A proposed sensor mapping, derived from a payload actually observed rather
 * than from a static device database — which is what makes it work for devices
 * nobody has ever modelled.
 */
export interface SensorMapping {
  /** JSON key in the device payload, e.g. "linkquality". */
  sourcePath: string;
  /** Suggested display label. */
  label: string;
  /** Suggested unit, when one can be inferred. */
  unit?: string;
  /** Whether to include it by default. */
  selected: boolean;
}

/** Units inferable from well-known Zigbee2MQTT payload keys. */
const KNOWN_UNITS: Record<string, string> = {
  temperature: '°C',
  humidity: '%',
  pressure: 'hPa',
  battery: '%',
  linkquality: 'lqi',
  illuminance: 'lx',
  voltage: 'V',
  current: 'A',
  power: 'W',
  energy: 'kWh',
  brightness: '',
};

/** Keys that describe the radio link rather than the thing being measured. */
const DIAGNOSTIC_KEYS = new Set(['linkquality', 'update', 'update_available', 'last_seen', 'elapsed']);

export const proposeMappings = (payload: Record<string, unknown>): SensorMapping[] =>
  Object.entries(payload)
    .filter(([, value]) => typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean')
    .map(([key]) => ({
      sourcePath: key,
      label: key.replace(/_/g, ' '),
      unit: KNOWN_UNITS[key],
      // Diagnostics are offered but not selected: they are useful for
      // troubleshooting and noise on a dashboard.
      selected: !DIAGNOSTIC_KEYS.has(key),
    }));
