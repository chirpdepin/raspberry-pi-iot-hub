import { readFile } from 'node:fs/promises';

import type { Concentrator } from '../../domain/gateway';
import type { ConcentratorPort } from '../../usecase/gateway-detect/contract';
import type { PathsPort } from '../paths/paths';

/**
 * Reads the concentrator inventory that detect-concentrator.sh already wrote.
 *
 * Re-implementing chip detection in TypeScript would create a second source of
 * truth for the gateway EUI, disagreeing with what Basic Station itself reads
 * from the chip (Contract 4).
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

export const createConcentratorDiscovery = (paths: PathsPort): ConcentratorPort => ({
  async read(): Promise<Concentrator | null> {
    const env = await readEnvFile(paths.concentratorEnv());
    const eui = env['GATEWAY_EUI'];

    // The EUI is written only once the chip has actually answered, so its
    // absence means no working concentrator — not merely an unread file.
    if (!eui) return null;

    return {
      eui,
      model: env['MODEL'] ?? 'Unknown',
      interface: env['INTERFACE'] ?? 'SPI',
      devicePath: env['DEVICE'] ?? '',
    };
  },
});
