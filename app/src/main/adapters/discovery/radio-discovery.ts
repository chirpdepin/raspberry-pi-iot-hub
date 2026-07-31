import { readFile, access } from 'node:fs/promises';

import type { RadioDiscoveryPort } from '../../usecase/host-capabilities/contract';
import type { PathsPort } from '../paths/paths';

/**
 * Radio discovery, reading what the installer scripts already detected.
 *
 * The Pi image ships `detect-radios.sh` and `detect-concentrator.sh`, which
 * write `/etc/iot-hub/radios.env` and `concentrator.env`. Re-implementing that
 * detection in TypeScript would create a second source of truth for which
 * dongle is which — and the shell version is the one the udev rules and systemd
 * units already agree with (Contract 4).
 *
 * On Windows and macOS these files simply do not exist, so every check returns
 * false and the UI shows the "no radio on this computer" empty state. That is
 * the correct answer there, not an error.
 */

const exists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

/** Reads KEY=VALUE from an env file, ignoring comments and blank lines. */
const readEnvFile = async (path: string): Promise<Record<string, string>> => {
  try {
    const content = await readFile(path, 'utf8');
    const values: Record<string, string> = {};

    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const separator = trimmed.indexOf('=');
      if (separator === -1) continue;

      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim();
      if (key) values[key] = value;
    }

    return values;
  } catch {
    return {};
  }
};

export const createRadioDiscovery = (paths: PathsPort): RadioDiscoveryPort => ({
  async hasConcentrator(): Promise<boolean> {
    const env = await readEnvFile(paths.concentratorEnv());
    // The EUI is only written once the chip has actually answered, so its
    // presence means a working concentrator, not merely a fitted one.
    return Boolean(env['GATEWAY_EUI']);
  },

  async hasZigbeeCoordinator(): Promise<boolean> {
    const env = await readEnvFile(paths.radiosEnv());
    if (!env['ZIGBEE_PORT']) return false;

    // The env file records what was detected at install time; the device node
    // proves it is still plugged in right now.
    return exists(paths.radioDevice('zigbee'));
  },

  async hasThreadRadio(): Promise<boolean> {
    const env = await readEnvFile(paths.radiosEnv());
    if (!env['THREAD_PORT']) return false;

    return exists(paths.radioDevice('thread'));
  },
});
