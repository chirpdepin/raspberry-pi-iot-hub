import type { Result } from '../../domain/errors';
import type { Camera, CameraConfig, DiscoveredCamera } from '../../domain/camera';

/**
 * Contract 1 (D): four narrow ports, all declared here by the consumer.
 *
 * `camera-add` must be unit-testable end to end with four fakes and no Docker,
 * which is the check that the layering is real.
 */

export interface CameraDiscoveryPort {
  /** ONVIF WS-Discovery. Reuses the Twin's own implementation. */
  discover(timeoutMs: number): Promise<DiscoveredCamera[]>;
  /**
   * Frame probe. Returns a still image as a data URL on success — the picture
   * of their own camera is what tells a non-technical user it worked.
   */
  probe(config: CameraConfig): Promise<Result<{ frameDataUrl: string; codec: string; width: number; height: number }>>;
}

export interface ImageEnsurePort {
  /** Ensures the Twin image is present, returning its tag. */
  ensure(onProgress?: (received: number, total: number) => void): Promise<Result<string>>;
}

export interface LensPort {
  /** Generates the immutable Twin Key. */
  newTwinKey(): string;
  /**
   * Registers the Twin with Lens and returns a bootstrap token.
   *
   * The token is returned EXACTLY ONCE, so it is written straight into the
   * Twin's config and never displayed or stored elsewhere.
   */
  registerTwin(input: { twinKey: string; name: string }): Promise<Result<{ bootstrapToken: string; lensUri: string }>>;
}

export interface ContainerRuntimePort {
  /** An unused host port, so several Twins can coexist. */
  allocatePort(): Promise<number>;
  /**
   * Writes the Twin's config.json into its volume BEFORE first start.
   *
   * The Twin refuses camera configuration via environment variables — camera
   * connection and display name are operator-owned UI input. Pre-seeding
   * config.json on the mounted volume is the documented automation path, and
   * this app is the operator UI.
   */
  createTwin(input: {
    id: string;
    imageTag: string;
    hostPort: number;
    config: Record<string, unknown>;
  }): Promise<Result<void>>;
}

export interface CameraAddPorts {
  discovery: CameraDiscoveryPort;
  images: ImageEnsurePort;
  lens: LensPort;
  containers: ContainerRuntimePort;
}

export interface CameraAddResult {
  camera: Camera;
}
