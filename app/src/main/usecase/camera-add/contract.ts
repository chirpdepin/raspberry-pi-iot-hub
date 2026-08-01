import type { Result } from '../../domain/errors';
import type { Camera } from '../../domain/camera';

/**
 * Contract 1 (D): five narrow ports, all declared here by the consumer.
 *
 * `camera-add` must be unit-testable end to end with fakes and no Docker, which
 * is the check that the layering is real.
 *
 * **What is no longer here matters as much as what is.** This contract used to
 * carry a `LensPort` that minted a Twin Key and registered the Twin with Lens,
 * and a `probe` on the discovery port that pulled a frame to prove credentials.
 * Both duplicated the Twin: its Lens tab owns the connection token, key ID, MQTT
 * and STUN/TURN settings, and its Camera tab owns the stream and its
 * credentials. Registering from here meant asking the user for things the Twin
 * asks for again, and it made adding a camera fail on an API that is not wired
 * up yet — for a step the user did not need us to take.
 */

export interface ImageEnsurePort {
  /** Ensures the Twin image is present, returning its tag. */
  ensure(onProgress?: (received: number, total: number) => void): Promise<Result<string>>;
}

/**
 * Port allocation is shared with every other subsystem, so it arrives as its
 * own narrow port rather than as a method on the container runtime.
 *
 * `camera-add` is one consumer of `usecase/port-allocate`, not its owner: the
 * host's port space is also spoken for by the MQTT broker, Zigbee2MQTT and the
 * Thread border router, and a Twin must not be handed any of theirs.
 */
export interface PortAllocationPort {
  allocate(): Promise<Result<number>>;
}

/**
 * The Twin's first-login secret.
 *
 * Its own port because it is the one value here that must not be predictable,
 * and a use case that generated it internally could not be tested for what it
 * does with it. The Twin refuses to boot without either these or an explicit
 * ship-a-known-default override — which is exactly the override a product
 * flashed by strangers must not use.
 */
export interface CredentialSeedPort {
  newPassword(): string;
  /**
   * A unique container-name seed for a camera added without a scan.
   *
   * Beside `newPassword` rather than in a port of its own: both are "an
   * unpredictable value from the platform", so they change for the same reason
   * and a test fakes them together.
   */
  newId(): string;
}

export interface ContainerRuntimePort {
  /**
   * Starts a Twin for one camera and nothing else.
   *
   * **No configuration is written.** The Twin boots on its own defaults, with
   * recording off, and the user configures the camera in its UI. Pre-seeding a
   * config.json here is what made this app a second, worse copy of the Twin's
   * settings screen.
   */
  createTwin(input: {
    id: string;
    imageTag: string;
    hostPort: number;
    seedUsername: string;
    seedPassword: string;
  }): Promise<Result<void>>;
}

/**
 * Persistence of the camera record.
 *
 * The container alone is not enough: it carries no display name and cannot tell
 * us the one-time password we gave it, which the user may still need.
 */
export interface CameraRecordPort {
  save(camera: Camera): Promise<void>;
  /**
   * How many cameras exist, for numbering the next one.
   *
   * A count, not `all()` (Contract 1 I) — naming a camera does not need every
   * record, and asking for them would let this use case grow a dependency on
   * fields it has no business reading.
   */
  count(): Promise<number>;
}

export interface CameraAddPorts {
  images: ImageEnsurePort;
  containers: ContainerRuntimePort;
  ports: PortAllocationPort;
  secrets: CredentialSeedPort;
  records: CameraRecordPort;
}

export interface CameraAddResult {
  camera: Camera;
}
