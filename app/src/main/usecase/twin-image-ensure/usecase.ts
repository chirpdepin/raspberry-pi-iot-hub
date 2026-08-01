import { domainError, err, ok, type Result } from '../../domain/errors';
import { IMAGES } from '../../config/images';

import type { TwinImageEnsurePorts } from './contract';

/** Node's arch names differ from Docker's. */
const DOCKER_ARCH: Record<string, string> = {
  arm64: 'arm64',
  x64: 'amd64',
};

/**
 * Makes sure a Twin image is available, downloading one only if needed.
 *
 * **What is already on the machine wins.** A locally built Twin — the tag the
 * Lens repo's own README produces — is used before the update feed is consulted
 * at all. Two reasons, and the second is the one that bit: a hub that already
 * has the image should never need the network to run a camera, and while the
 * feed does not exist yet the old order made every camera unusable and put a
 * "not published yet" notice in front of the user. That is a development fact,
 * not something a user should ever read.
 *
 * Contract 2: the download is the ~150 MB step, and it happens once — not per
 * camera. Progress is reported so the user sees movement rather than a frozen
 * dialog.
 */
export const handleTwinImageEnsure = async (
  ports: TwinImageEnsurePorts,
  onProgress?: (received: number, total: number) => void
): Promise<Result<string>> => {
  if (await ports.images.has(IMAGES.twinLocal)) return ok(IMAGES.twinLocal);

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
