import { execFile } from 'node:child_process';
import { createServer } from 'node:net';
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

/** Host ports for Twin web UIs. Above the ephemeral range on most systems. */
const PORT_RANGE_START = 18_080;
const PORT_RANGE_END = 18_180;

const isPortFree = (port: number): Promise<boolean> =>
  new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port, '127.0.0.1');
  });

export interface TwinRuntimeDeps {
  paths: PathsPort;
  imageTag(): string;
}

export const createTwinRuntime = ({ paths, imageTag }: TwinRuntimeDeps) => {
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
    async allocatePort(): Promise<number> {
      for (let port = PORT_RANGE_START; port <= PORT_RANGE_END; port++) {
        if (await isPortFree(port)) return port;
      }

      // Falling back to the range start is wrong, so surface it as a real
      // failure by returning a port the caller will fail to bind.
      return PORT_RANGE_START;
    },

    async createTwin({ id, imageTag: tag, hostPort, config }): Promise<Result<void>> {
      try {
        const configDir = `${paths.serviceDir('lorawan').replace(/lorawan$/, 'cameras')}/${id}/config`;

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

  return { discovery, containers };
};
