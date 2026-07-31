import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Every filesystem path the app touches, in one place.
 *
 * Contract 3 rule 1 and Contract 4: no use case may contain `/etc/iot-hub` or
 * `/usr/local/bin`. On Ubuntu Core the root filesystem is read-only and these
 * become `$SNAP_DATA` / `$SNAP_COMMON`, so a hardcoded path in a use case would
 * turn a packaging change into a code change. The boundary checker fails the
 * build on any system path outside this directory.
 *
 * Contract 1 (I): a narrow port. It answers "where is X", nothing else.
 */

export interface PathsPort {
  /** Config written by the installer scripts and read by this app. */
  hubConfigDir(): string;
  /** Detected radio inventory, written by detect-radios.sh. */
  radiosEnv(): string;
  /** Detected LoRaWAN concentrator inventory. */
  concentratorEnv(): string;
  /** LNS credentials: tc.uri, tc.trust, tc.crt, tc.key. */
  lorawanCredentialsDir(): string;
  /** Zigbee2MQTT data, including its configuration.yaml. */
  zigbeeDataDir(): string;
  /** Compose project directories, one per service. */
  serviceDir(service: 'lorawan' | 'mqtt' | 'zigbee' | 'thread'): string;
  /** Downloaded container image tarballs, verified before load. */
  imageCacheDir(): string;
  /** Stable device symlinks created by the udev rules. */
  radioDevice(role: 'zigbee' | 'thread'): string;
}

/**
 * Linux layout, matching what scripts/install-radios.sh and
 * scripts/install-ubuntu.sh actually create on the Pi.
 */
export const createLinuxPaths = (): PathsPort => ({
  hubConfigDir: () => '/etc/iot-hub',
  radiosEnv: () => '/etc/iot-hub/radios.env',
  concentratorEnv: () => '/etc/iot-hub/concentrator.env',
  lorawanCredentialsDir: () => '/etc/iot-hub/lorawan',
  zigbeeDataDir: () => '/etc/iot-hub/zigbee',
  serviceDir: (service) => `/opt/iot-hub/${service}`,
  imageCacheDir: () => '/var/lib/iot-hub/images',
  radioDevice: (role) => `/dev/${role}`,
});

/**
 * Windows and macOS layout.
 *
 * There is no /etc there, and no radios either — those platforms run cameras
 * only, so the radio paths return locations that simply will not exist. The
 * capability check reports "no radio" from that, which is the correct answer
 * rather than an error.
 */
export const createDesktopPaths = (): PathsPort => {
  const base = join(homedir(), '.chirp-hub');

  return {
    hubConfigDir: () => base,
    radiosEnv: () => join(base, 'radios.env'),
    concentratorEnv: () => join(base, 'concentrator.env'),
    lorawanCredentialsDir: () => join(base, 'lorawan'),
    zigbeeDataDir: () => join(base, 'zigbee'),
    serviceDir: (service) => join(base, 'services', service),
    imageCacheDir: () => join(base, 'images'),
    radioDevice: (role) => join(base, 'devices', role),
  };
};

export const createPaths = (platform: NodeJS.Platform): PathsPort =>
  platform === 'linux' ? createLinuxPaths() : createDesktopPaths();
