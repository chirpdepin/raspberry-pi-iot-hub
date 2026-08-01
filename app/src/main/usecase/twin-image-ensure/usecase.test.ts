import { describe, expect, it, vi } from 'vitest';

import { domainError, err, ok } from '../../domain/errors';

import { IMAGES } from '../../config/images';

import type { ImageStorePort, TwinArtifact, TwinImageEnsurePorts } from './contract';
import { handleTwinImageEnsure } from './usecase';

const artifact = (arch: string): TwinArtifact => ({
  version: '2.1.0',
  arch,
  url: `https://example.invalid/lens-twin-2.1.0-${arch}.tar.zst`,
  sha256: 'a'.repeat(64),
  size: 148_000_000,
});

type DownloadMock = ReturnType<typeof vi.fn<ImageStorePort['download']>>;

/**
 * `has` is answered per tag, not blanket-true. A fake that said yes to
 * everything hid which image the use case actually chose — and once a locally
 * built Twin took priority, that fake made the versioned-tag test pass for the
 * wrong reason.
 */
const ports = (overrides: {
  loaded?: string[];
  arch?: string;
  artifacts?: TwinArtifact[];
  download?: DownloadMock;
}) => {
  const download: DownloadMock = overrides.download ?? vi.fn(async () => ok(undefined));
  const loaded = new Set(overrides.loaded ?? []);

  const value: TwinImageEnsurePorts & { download: typeof download } = {
    images: {
      has: async (tag: string) => loaded.has(tag),
      manifest: async () =>
        ok({ latest: '2.1.0', artifacts: overrides.artifacts ?? [artifact('arm64'), artifact('amd64')] }),
      download,
    },
    arch: () => overrides.arch ?? 'arm64',
    download,
  };

  return value;
};

describe('twin-image-ensure', () => {
  it('downloads nothing when the image is already loaded', async () => {
    const p = ports({ loaded: ['lens-twin:2.1.0'] });
    const result = await handleTwinImageEnsure(p);

    // The ~150 MB download must happen once, not on every camera.
    expect(result.ok).toBe(true);
    expect(p.download).not.toHaveBeenCalled();
  });

  /**
   * A Twin built from the Lens repo on this machine wins outright, without the
   * update feed being consulted at all.
   *
   * Two reasons, and the second is the one that bit: a hub that already has the
   * image should never need the network to run a camera, and while the feed did
   * not exist yet the old order made every camera unusable and put a "not
   * published yet" notice in front of the user — a development fact they should
   * never have been shown.
   */
  it('prefers a locally built Twin over the update feed', async () => {
    const manifest = vi.fn(async () => ok({ latest: '2.1.0', artifacts: [artifact('arm64')] }));
    const p = ports({ loaded: [IMAGES.twinLocal] });
    p.images.manifest = manifest;

    const result = await handleTwinImageEnsure(p);

    expect(result.ok && result.value).toBe(IMAGES.twinLocal);
    expect(manifest).not.toHaveBeenCalled();
    expect(p.download).not.toHaveBeenCalled();
  });

  it('picks the artifact matching the host architecture', async () => {
    const p = ports({ arch: 'x64' });
    await handleTwinImageEnsure(p);

    // Node says x64 where Docker says amd64; getting this wrong downloads an
    // image that cannot run.
    expect(p.download).toHaveBeenCalledWith(expect.objectContaining({ arch: 'amd64' }), undefined);
  });

  it('explains rather than failing obscurely on an unsupported architecture', async () => {
    const p = ports({ arch: 'ia32' });
    const result = await handleTwinImageEnsure(p);

    expect(result.ok).toBe(false);
    expect(p.download).not.toHaveBeenCalled();
  });

  it('surfaces a download failure rather than reporting success', async () => {
    const download: DownloadMock = vi.fn(async () => err(domainError('unknown', 'Checksum did not match.')));
    const p = ports({ download });
    const result = await handleTwinImageEnsure(p);

    expect(result.ok).toBe(false);
  });

  it('returns the versioned tag so callers never guess it', async () => {
    const result = await handleTwinImageEnsure(ports({ loaded: ['lens-twin:2.1.0'] }));

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe('lens-twin:2.1.0');
  });
});
