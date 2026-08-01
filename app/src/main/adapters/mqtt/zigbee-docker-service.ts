import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { domainError, err, ok, type Result } from '../../domain/errors';
import { canRunLocally, describeDevice, type RadioTransport } from '../../domain/radio';
import type { ZigbeeCoordinator } from '../../domain/zigbee';
import { IMAGES } from '../../config/images';
import type { ZigbeeServicePort } from '../../usecase/zigbee-start/contract';
import type { RadioRolesResult } from '../../usecase/radio-roles/contract';
import type { PathsPort } from '../paths/paths';

const run = promisify(execFile);

/**
 * Zigbee2MQTT without the Pi image — driven straight through Docker.
 *
 * The hub image starts the stack through systemd, because the unit already
 * encodes dependency order and restart policy. A laptop has neither the units
 * nor the compose files, so this runs the same two pinned images directly.
 *
 * Contract 1 (L): the second implementation of `ZigbeeServicePort`.
 * `zigbee-start` is untouched and cannot tell which one it has; composition
 * picks on the image marker.
 *
 * **A serial coordinator only works on a Linux host.** Docker Desktop on
 * Windows and macOS runs containers inside a Linux VM and passes no USB
 * through, so the device would simply not be there. `canRunLocally` decides
 * that once, in the domain, and this refuses early with a reason rather than
 * starting a container that cannot see its radio.
 */

const CONTAINERS = { broker: 'chirp-hub-mosquitto', zigbee: 'chirp-hub-zigbee2mqtt' } as const;

/**
 * Candidates for Zigbee2MQTT's frontend, in order.
 *
 * 8080 first because that is what the hub image uses and what its documentation
 * refers to. The fallbacks deliberately skip 8081, which `config/ports.ts`
 * reserves for the Thread border router — falling back onto our own reserved
 * port would trade one collision for a worse one.
 */
const FRONTEND_PORTS = [8080, 18_090, 18_091, 18_092] as const;

export interface ZigbeeDockerServiceDeps {
  paths: PathsPort;
  platform: string;
  scanRoles(): Promise<RadioRolesResult>;
  /** Template rendered on first start only — see below. */
  configTemplate(): Promise<string>;
  /** Whether a TCP port can be bound right now. */
  isPortFree(port: number): Promise<boolean>;
}

const exists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

export const createZigbeeDockerService = ({
  paths,
  platform,
  scanRoles,
  configTemplate,
  isPortFree,
}: ZigbeeDockerServiceDeps): ZigbeeServicePort => {
  const dataDir = () => paths.zigbeeDataDir();

  const coordinator = async (): Promise<(ZigbeeCoordinator & { transport: RadioTransport }) | null> => {
    const { assigned } = await scanRoles();
    const zigbee = assigned.find((entry) => entry.role === 'zigbee');
    if (!zigbee) return null;

    return {
      model: describeDevice(zigbee.device.vendor, zigbee.device.model) || 'Unknown',
      port: zigbee.device.node,
      adapter: zigbee.device.adapter,
      serial: zigbee.device.serial,
      transport: 'serial',
    };
  };

  const isRunning = async (name: string): Promise<boolean> => {
    try {
      const { stdout } = await run('docker', ['inspect', '-f', '{{.State.Running}}', name]);
      return stdout.trim() === 'true';
    } catch {
      return false;
    }
  };

  /**
   * Writes configuration.yaml only when absent.
   *
   * **It is state, not config.** Zigbee2MQTT rewrites this file with the
   * network key, PAN id and every pairing, so regenerating it over a live
   * network loses the network and every paired device has to be re-paired.
   */
  /**
   * Finds a free port for Zigbee2MQTT's own web frontend.
   *
   * The template asks for 8080, which is right on the hub image where this app
   * owns the machine. On a laptop 8080 is very often already taken — it was on
   * the machine this was written on — and Zigbee2MQTT exits with EADDRINUSE
   * *after* successfully talking to the radio, which reads as a coordinator
   * fault rather than a port clash.
   */
  const freeFrontendPort = async (): Promise<number> => {
    for (const candidate of FRONTEND_PORTS) {
      if (await isPortFree(candidate)) return candidate;
    }

    return FRONTEND_PORTS[0];
  };

  const ensureConfig = async (port: string, adapter: string | null): Promise<void> => {
    await mkdir(dataDir(), { recursive: true });
    const configPath = join(dataDir(), 'configuration.yaml');

    if (await exists(configPath)) return;

    // The template carries exactly two placeholders; the broker address and
    // base topic are literals inside it, matching config/mqtt.ts. Substituting
    // more would be substituting nothing.
    const template = await configTemplate();
    const rendered = template.replaceAll('__ZIGBEE_PORT__', port).replaceAll('__ZIGBEE_ADAPTER__', adapter ?? '');

    // Rewritten here rather than templated, so the shared template and the
    // installer that also renders it stay untouched.
    const frontendPort = await freeFrontendPort();
    const withPort =
      frontendPort === FRONTEND_PORTS[0]
        ? rendered
        : rendered.replace(/(frontend:[\s\S]*?port:\s*)\d+/, `$1${frontendPort}`);

    await writeFile(configPath, withPort, 'utf8');
  };

  return {
    coordinator,

    isRunning: () => isRunning(CONTAINERS.zigbee),

    async start(): Promise<Result<void>> {
      const radio = await coordinator();

      if (!radio) {
        return err(domainError('unknown', 'No Zigbee coordinator is plugged in.'));
      }

      if (!canRunLocally(radio.transport, platform)) {
        return err(
          domainError(
            'not-supported-on-platform',
            'This dongle is plugged in, but running it needs Linux or the Chirp Hub device. A network coordinator works on any computer.',
            `serial coordinator on ${platform}: Docker provides no USB passthrough here`
          )
        );
      }

      try {
        await ensureConfig(radio.port, radio.adapter);

        // The broker first: Zigbee2MQTT exits if it cannot connect on startup.
        if (!(await isRunning(CONTAINERS.broker))) {
          await run('docker', ['rm', '-f', CONTAINERS.broker]).catch(() => undefined);
          await run('docker', [
            'run', '-d', '--name', CONTAINERS.broker, '--restart', 'unless-stopped',
            '--network', 'host', IMAGES.mosquitto,
          ]);
        }

        await run('docker', ['rm', '-f', CONTAINERS.zigbee]).catch(() => undefined);
        await run('docker', [
          'run', '-d', '--name', CONTAINERS.zigbee, '--restart', 'unless-stopped',
          '--network', 'host',
          // The real node. `/dev/zigbee` is a Pi udev artefact and does not
          // exist anywhere else.
          '--device', `${radio.port}:${radio.port}`,
          '-v', `${dataDir()}:/app/data`,
          IMAGES.zigbee2mqtt,
        ]);

        return ok(undefined);
      } catch (error) {
        const raw = error instanceof Error ? error.message : String(error);

        return err(
          domainError(
            'unknown',
            "Couldn't start Zigbee on this computer.",
            raw
          )
        );
      }
    },
  };
};

/**
 * Reads the **same template the installer uses**, so a hub and a laptop render
 * an identical configuration.yaml (Contract 4 — one template, not two).
 *
 * Candidates rather than one path because the file sits in the repo during
 * development and in the packaged resources afterwards. Copying it into the app
 * source instead would create the second copy this avoids.
 */
export const readZigbeeTemplate =
  (candidates: string[]) =>
  async (): Promise<string> => {
    for (const candidate of candidates) {
      try {
        return await readFile(candidate, 'utf8');
      } catch {
        // Try the next location.
      }
    }

    throw new Error(`zigbee configuration template not found in: ${candidates.join(', ')}`);
  };
