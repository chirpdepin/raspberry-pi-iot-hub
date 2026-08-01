import { readFile } from 'node:fs/promises';

import { ok, type Result } from '../../domain/errors';
import type { ZigbeeCoordinator } from '../../domain/zigbee';
import { adapterFor } from '../../config/zigbee-adapters';
import { SERVICES } from '../../config/services';
import type { ZigbeeServicePort } from '../../usecase/zigbee-start/contract';
import type { PathsPort } from '../paths/paths';

/**
 * Zigbee coordinator inventory and service control.
 *
 * Reads `/etc/iot-hub/radios.env`, which `detect-radios.sh` already wrote — the
 * same file the udev rules and systemd units agree with (Contract 4).
 *
 * Starting the stack is left to the systemd unit rather than driven from here,
 * because the unit already encodes the dependency order and the restart policy.
 */

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
      if (key) values[key] = trimmed.slice(separator + 1).trim();
    }

    return values;
  } catch {
    return {};
  }
};

export interface ZigbeeServiceDeps {
  paths: PathsPort;
  startService(name: string): Promise<Result<void>>;
  isServiceActive(name: string): Promise<boolean>;
}


export const createZigbeeService = ({
  paths,
  startService,
  isServiceActive,
}: ZigbeeServiceDeps): ZigbeeServicePort => ({
  async coordinator(): Promise<ZigbeeCoordinator | null> {
    const env = await readEnvFile(paths.radiosEnv());
    const port = env['ZIGBEE_PORT'];
    if (!port) return null;

    const model = env['ZIGBEE_MODEL'] ?? 'Unknown';

    return {
      model,
      port,
      // detect-radios.sh already derived this; fall back to our own registry so
      // the two never disagree silently.
      adapter: (env['ZIGBEE_ADAPTER'] as ZigbeeCoordinator['adapter']) || adapterFor(model),
      serial: env['ZIGBEE_SERIAL'] ?? '',
    };
  },

  isRunning: () => isServiceActive(SERVICES.zigbee),

  async start(): Promise<Result<void>> {
    // configuration.yaml is rendered by the installer from its template; the
    // unit gates on its existence. Starting the unit is all that is needed here.
    const started = await startService(SERVICES.zigbee);
    return started.ok ? ok(undefined) : started;
  },
});
