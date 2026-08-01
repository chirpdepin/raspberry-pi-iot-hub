import type { Result } from '../../domain/errors';

/**
 * Ensures the Twin image is present locally.
 *
 * Contract 1 (I, L): `ImageStorePort` knows nothing about GitHub Releases.
 * Moving to a registry later must not touch this use case.
 */

export interface TwinArtifact {
  version: string;
  arch: string;
  url: string;
  sha256: string;
  size: number;
}

export interface ImageStorePort {
  /** Whether an image with this tag is already loaded. */
  has(tag: string): Promise<boolean>;
  /** Fetches the update feed. */
  manifest(): Promise<Result<{ latest: string; artifacts: TwinArtifact[] }>>;
  /**
   * Downloads, verifies the SHA-256 and loads the image.
   *
   * Verification is not optional: this is an executable fetched over the
   * network onto a user's machine.
   */
  download(artifact: TwinArtifact, onProgress?: (received: number, total: number) => void): Promise<Result<void>>;
}

export interface TwinImageEnsurePorts {
  images: ImageStorePort;
  /** Host architecture, so the right artifact is chosen. */
  arch(): string;
}
