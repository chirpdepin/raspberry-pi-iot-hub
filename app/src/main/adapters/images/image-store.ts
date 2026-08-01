import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { domainError, err, ok, type Result } from '../../domain/errors';
import { TWIN_MANIFEST_URL } from '../../config/images';
import type { ImageStorePort, TwinArtifact } from '../../usecase/twin-image-ensure/contract';
import type { PathsPort } from '../paths/paths';

const run = promisify(execFile);

/**
 * Downloads and loads the Twin image tarball.
 *
 * The checksum is verified before `docker load` and the file is deleted if it
 * does not match. This is an executable arriving over the network onto a user's
 * machine — skipping verification would mean a corrupted or substituted
 * download runs as a container with device access.
 */

interface ManifestFile {
  latest: string;
  releases: { version: string; artifacts: TwinArtifact[] }[];
}

export interface ImageStoreDeps {
  paths: PathsPort;
  fetchImpl?: typeof fetch;
}

export const createImageStore = ({ paths, fetchImpl = fetch }: ImageStoreDeps): ImageStorePort => ({
  async has(tag: string): Promise<boolean> {
    try {
      const { stdout } = await run('docker', ['image', 'inspect', tag, '--format', '{{.Id}}']);
      return stdout.trim().length > 0;
    } catch {
      return false;
    }
  },

  async manifest(): Promise<Result<{ latest: string; artifacts: TwinArtifact[] }>> {
    try {
      const response = await fetchImpl(TWIN_MANIFEST_URL);

      if (!response.ok) {
        return err(
          domainError('unknown', "Couldn't check for the camera software.", `${response.status} ${response.statusText}`)
        );
      }

      const parsed = (await response.json()) as ManifestFile;
      const release = parsed.releases.find((candidate) => candidate.version === parsed.latest);

      if (!release) {
        return err(domainError('unknown', 'The camera software update list is malformed.'));
      }

      return ok({ latest: parsed.latest, artifacts: release.artifacts });
    } catch (error) {
      return err(
        domainError(
          'unknown',
          "Couldn't check for the camera software. Check this device's internet connection.",
          error instanceof Error ? error.message : String(error)
        )
      );
    }
  },

  async download(artifact: TwinArtifact, onProgress): Promise<Result<void>> {
    const cacheDir = paths.imageCacheDir();
    const target = join(cacheDir, `lens-twin-${artifact.version}-${artifact.arch}.tar.zst`);

    try {
      await mkdir(cacheDir, { recursive: true });

      // Resume support: a 150 MB download on a domestic connection is worth not
      // restarting from zero.
      let downloaded = 0;
      try {
        downloaded = (await stat(target)).size;
      } catch {
        downloaded = 0;
      }

      if (downloaded !== artifact.size) {
        const response = await fetchImpl(artifact.url, {
          headers: downloaded > 0 ? { Range: `bytes=${downloaded}-` } : {},
        });

        if (!response.ok || !response.body) {
          return err(
            domainError(
              'unknown',
              "Couldn't download the camera software.",
              `${response.status} ${response.statusText}`
            )
          );
        }

        const total = artifact.size;
        let received = downloaded;

        const source = Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]);
        source.on('data', (chunk: Buffer) => {
          received += chunk.length;
          onProgress?.(received, total);
        });

        await pipeline(source, createWriteStream(target, { flags: downloaded > 0 ? 'a' : 'w' }));
      }

      const digest = await new Promise<string>((resolve, reject) => {
        const hash = createHash('sha256');
        const reader = createReadStream(target);

        reader.on('data', (chunk) => hash.update(chunk));
        reader.on('end', () => resolve(hash.digest('hex')));
        reader.on('error', reject);
      });

      if (digest !== artifact.sha256) {
        // A mismatch means corruption or substitution. Deleting it means the
        // next attempt starts clean rather than resuming a bad file forever.
        await rm(target, { force: true });
        return err(
          domainError('unknown', 'The download was damaged. Try again.', `expected ${artifact.sha256}, got ${digest}`)
        );
      }

      await run('docker', ['load', '--input', target], { maxBuffer: 1024 * 1024 * 32 });

      return ok(undefined);
    } catch (error) {
      return err(
        domainError(
          'unknown',
          "Couldn't install the camera software.",
          error instanceof Error ? error.message : String(error)
        )
      );
    }
  },
});
