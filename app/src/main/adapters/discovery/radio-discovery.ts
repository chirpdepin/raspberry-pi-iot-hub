import { readFile, access } from 'node:fs/promises';

import type { RadioDiscoveryPort } from '../../usecase/host-capabilities/contract';
import type { RadioRole } from '../../domain/radio';
import type { PathsPort } from '../paths/paths';
import type { RadioRolesResult } from '../../usecase/radio-roles/contract';

/**
 * Radio discovery.
 *
 * **`radios.env` first, live scan second.** On the Pi the installer's
 * `detect-radios.sh` writes that file, and it is what the udev rules and
 * systemd units agree with — so it stays authoritative there (Contract 4).
 *
 * Everywhere else it does not exist, and the previous version stopped at that
 * point and reported "no radio". That was the bug: a dongle plugged into a
 * laptop could never be found, on any platform, no matter how long the UI
 * polled. The live scan is the fallback, so the same dongle is recognised
 * whether it is in the hub or in the machine running this app.
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

export interface RadioDiscoveryDeps {
  paths: PathsPort;
  /** Live enumeration with roles applied, used when radios.env is absent. */
  scanRoles: () => Promise<RadioRolesResult>;
}

export const createRadioDiscovery = ({ paths, scanRoles }: RadioDiscoveryDeps): RadioDiscoveryPort => {
  /** True when a radio holding this role is attached right now. */
  const hasRole = async (role: RadioRole): Promise<boolean> => {
    const { assigned } = await scanRoles();
    return assigned.some((entry) => entry.role === role);
  };

  return {
  async hasConcentrator(): Promise<boolean> {
    const env = await readEnvFile(paths.concentratorEnv());
    // The EUI is only written once the chip has actually answered, so its
    // presence means a working concentrator, not merely a fitted one.
    return Boolean(env['GATEWAY_EUI']);
  },

  async hasZigbeeCoordinator(): Promise<boolean> {
    const env = await readEnvFile(paths.radiosEnv());

    if (env['ZIGBEE_PORT']) {
      // The env file records what was detected at install time; the device node
      // proves it is still plugged in right now.
      return exists(paths.radioDevice('zigbee'));
    }

    return hasRole('zigbee');
  },

  async hasThreadRadio(): Promise<boolean> {
    const env = await readEnvFile(paths.radiosEnv());

    if (env['THREAD_PORT']) return exists(paths.radioDevice('thread'));

    return hasRole('thread');
  },
  };
};
