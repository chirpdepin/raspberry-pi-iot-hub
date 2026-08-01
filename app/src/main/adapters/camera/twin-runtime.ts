import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { domainError, err, ok, type Result } from '../../domain/errors';
import {
  classifyProbeError,
  probeFailureMessage,
  rtspUrl,
  type CameraConfig,
  type DiscoveredCamera,
} from '../../domain/camera';
import type { CameraDiscoveryPort, ContainerRuntimePort } from '../../usecase/camera-add/contract';
import type { TwinRemovalPort } from '../../usecase/camera-remove/contract';
import type { PathsPort } from '../paths/paths';

const run = promisify(execFile);

/**
 * Camera discovery and Twin lifecycle.
 *
 * Discovery **reuses the Twin's own ONVIF implementation** by running a
 * short-lived, host-network container with `-action discover`. Re-implementing
 * WS-Discovery here would be a second implementation to keep in step with the
 * one the Twin actually uses at runtime.
 *
 * Discovery needs host networking because WS-Discovery is L2 multicast. Twins
 * themselves run on bridge networking with a mapped port, because every Twin
 * listens on port 80 internally and twenty of them on host networking would all
 * collide.
 */

const DISCOVERY_CONTAINER_TIMEOUT_MS = 20_000;

/**
 * Port allocation used to live here. It now belongs to `usecase/port-allocate`,
 * because the host's port space is shared with the MQTT broker, Zigbee2MQTT and
 * the Thread border router — none of which this adapter knows about.
 */

export interface TwinRuntimeDeps {
  paths: PathsPort;
  imageTag(): string;
}

export const createTwinRuntime = ({ paths, imageTag }: TwinRuntimeDeps) => {
  /**
   * Where Twin data lives. Derived once so creation and deletion cannot build
   * the path differently — the version of this bug that deletes the wrong
   * directory is not one worth risking.
   */
  const camerasDir = (): string => paths.serviceDir('lorawan').replace(/lorawan$/, 'cameras');

  const discovery: CameraDiscoveryPort = {
    async discover(timeoutMs: number): Promise<DiscoveredCamera[]> {
      try {
        const { stdout } = await run(
          'docker',
          ['run', '--rm', '--network', 'host', imageTag(), '-action', 'discover'],
          { timeout: Math.max(timeoutMs, DISCOVERY_CONTAINER_TIMEOUT_MS) }
        );

        // The Twin prints one JSON object per discovered camera.
        return stdout
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.startsWith('{'))
          .flatMap((line) => {
            try {
              const parsed = JSON.parse(line) as {
                xaddr?: string;
                name?: string;
                model?: string;
              };

              if (!parsed.xaddr) return [];

              return [
                {
                  xaddr: parsed.xaddr,
                  address: new URL(parsed.xaddr).hostname,
                  manufacturer: parsed.name ?? null,
                  model: parsed.model ?? null,
                },
              ];
            } catch {
              return [];
            }
          });
      } catch {
        // Discovery failing is not an error the user needs to see — it usually
        // just means nothing answered. The UI offers manual entry regardless.
        return [];
      }
    },

    async probe(config: CameraConfig) {
      try {
        const { stdout } = await run(
          'docker',
          ['run', '--rm', imageTag(), '-action', 'probe', '-source', rtspUrl(config)],
          { timeout: DISCOVERY_CONTAINER_TIMEOUT_MS }
        );

        const parsed = JSON.parse(stdout.trim()) as {
          frame?: string;
          codec?: string;
          width?: number;
          height?: number;
        };

        if (!parsed.frame) {
          return err(domainError('unknown', probeFailureMessage('no-stream', config.address)));
        }

        return ok({
          frameDataUrl: `data:image/jpeg;base64,${parsed.frame}`,
          codec: parsed.codec ?? 'unknown',
          width: parsed.width ?? 0,
          height: parsed.height ?? 0,
        });
      } catch (error) {
        const raw = error instanceof Error ? error.message : String(error);
        const failure = classifyProbeError(raw);

        // Contract 2 rule 2: a mapped cause plus the raw text behind
        // [Technical details], never ECONNREFUSED on its own.
        return err(domainError('unknown', probeFailureMessage(failure, config.address), raw));
      }
    },
  };

  const containers: ContainerRuntimePort = {
    async createTwin({ id, imageTag: tag, hostPort, config }): Promise<Result<void>> {
      try {
        const configDir = `${camerasDir()}/${id}/config`;

        // Pre-seed config.json into the volume BEFORE the container first runs.
        await run('mkdir', ['-p', configDir]);
        await run('sh', ['-c', `cat > ${configDir}/config.json <<'JSON'\n${JSON.stringify(config, null, 2)}\nJSON`]);

        await run('docker', [
          'run',
          '-d',
          '--name',
          id,
          '--restart',
          'unless-stopped',
          '-p',
          `${hostPort}:80`,
          '-v',
          `${configDir}:/home/twin/data/config`,
          tag,
        ]);

        return ok(undefined);
      } catch (error) {
        return err(
          domainError(
            'unknown',
            "Couldn't set up this camera on the device.",
            error instanceof Error ? error.message : String(error)
          )
        );
      }
    },
  };

  const removal: TwinRemovalPort = {
    async remove(id: string): Promise<Result<void>> {
      try {
        // -f because a recording Twin will not stop on its own signal quickly,
        // and the user has already confirmed they want it gone.
        await run('docker', ['rm', '-f', id]);
        return ok(undefined);
      } catch (error) {
        return err(
          domainError(
            'unknown',
            "Couldn't remove this camera. It may already be gone — refresh and check.",
            error instanceof Error ? error.message : String(error)
          )
        );
      }
    },

    async purgeData(id: string): Promise<Result<void>> {
      try {
        // Only ever the one Twin's own directory. `camerasDir` is built the
        // same way it is at creation, so this cannot reach outside it.
        await run('rm', ['-rf', `${camerasDir()}/${id}`]);
        return ok(undefined);
      } catch (error) {
        return err(
          domainError(
            'unknown',
            "The camera was removed, but its recordings couldn't be deleted.",
            error instanceof Error ? error.message : String(error)
          )
        );
      }
    },
  };

  return { discovery, containers, removal };
};
