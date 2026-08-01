import { domainError, err, ok, type Result } from '../../domain/errors';
import { IMAGES } from '../../config/images';

import type { TwinImageEnsurePorts } from './contract';

/** Node's arch names differ from Docker's. */
const DOCKER_ARCH: Record<string, string> = {
  arm64: 'arm64',
  x64: 'amd64',
};

/**
 * Makes sure the Twin image is available, downloading it once if not.
 *
 * Contract 2: this is the ~150 MB step, and it happens once — not per camera.
 * Progress is reported so the user sees movement rather than a frozen dialog.
 */
export const handleTwinImageEnsure = async (
  ports: TwinImageEnsurePorts,
  onProgress?: (received: number, total: number) => void
): Promise<Result<string>> => {
  const manifest = await ports.images.manifest();
  if (!manifest.ok) return err(manifest.error);

  const tag = `${IMAGES.twin}:${manifest.value.latest}`;

  if (await ports.images.has(tag)) {
    return ok(tag);
  }

  const wanted = DOCKER_ARCH[ports.arch()];
  const artifact = manifest.value.artifacts.find((candidate) => candidate.arch === wanted);

  if (!artifact) {
    return err(
      domainError(
        'not-supported-on-platform',
        'Camera recording is not available for this computer type yet.',
        `no artifact for arch ${ports.arch()}`
      )
    );
  }

  const downloaded = await ports.images.download(artifact, onProgress);
  if (!downloaded.ok) return err(downloaded.error);

  return ok(tag);
};
