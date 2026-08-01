/**
 * Camera domain.
 *
 * Contract 1: no imports.
 *
 * **This layer is deliberately small, and that is the design.** The Twin owns
 * camera configuration — its Settings UI has a Camera tab with its own ONVIF
 * discovery and stream-path handling, and a Lens tab holding the connection
 * token, MQTT and STUN/TURN details and the camera's name. Everything this app
 * once modelled here (credentials, RTSP paths, a vendor path registry, recording
 * mode, retention, probe-failure classification) was a second implementation of
 * settings the user configures in the Twin. Two implementations of one thing is
 * one to keep in step and one to get wrong, and it made the user answer
 * questions the Twin was going to ask again.
 *
 * What is left is only what the app needs to *deploy* a Twin: which cameras are
 * on the network, and which ones already have one.
 */

export interface DiscoveredCamera {
  /** ONVIF service address, e.g. http://192.168.2.40/onvif/device_service */
  xaddr: string;
  address: string;
  manufacturer: string | null;
  model: string | null;
}

/**
 * One network the scan considered, and whether it actually searched it.
 *
 * Reported rather than kept private because a scan that finds one camera on a
 * network of twenty looks like a broken app unless the screen can say what it
 * looked at. `skipped` is a value, not a branch (Contract 1 O) — a new reason to
 * skip a network is a new member here, not an `if` in the adapter.
 */
export interface ScannedNetwork {
  /** e.g. `192.168.2.0/24` — the network, not this machine's address on it. */
  cidr: string;
  /** Usable host addresses, so the screen can say "searched 254 addresses". */
  hosts: number;
  /** Absent when the network was searched. */
  skipped?: 'too-large';
}

export interface CameraScan {
  cameras: DiscoveredCamera[];
  networks: ScannedNetwork[];
}

export interface Camera {
  id: string;
  displayName: string;
  /**
   * Empty for a camera added without a scan — we genuinely do not know it until
   * the user enters it in the Twin, and inventing one would make the list lie.
   */
  address: string;
  /** Host port the Twin's web UI is mapped to, on loopback. */
  hostPort: number;
  /**
   * The one-time credentials the Twin was seeded with.
   *
   * Kept so the user can find them again: the Twin consumes them only on first
   * boot and forces a change at first login, so once this screen has forgotten
   * them there is no way back in short of deleting the camera and its
   * recordings (Contract 2 rule 6). They stop working the moment the user sets
   * their own.
   */
  firstLoginUsername: string;
  firstLoginPassword: string;
  online: boolean;
}

/**
 * The container name for a camera's Twin, built from a seed.
 *
 * The seed is the camera's address when we have one, which makes it
 * deterministic: setting the same discovered camera up twice becomes impossible
 * to do by accident, and the id can be recomputed without consulting anything.
 * A camera added without a scan has no address to use, so it is seeded with a
 * generated token instead — unique, just not derivable.
 */
export const twinIdFor = (prefix: string, seed: string): string =>
  `${prefix}${seed.replace(/[^a-z0-9]+/gi, '-')}`;

/**
 * What to call a camera added without a scan.
 *
 * Numbered rather than "New camera", because someone setting up twenty of them
 * needs to tell the rows apart before any of them is configured. The real name
 * is set in the Twin, which is also where the address and credentials go.
 */
export const numberedCameraLabel = (existing: number): string => `Camera ${existing + 1}`;

/**
 * What to call a camera in our list before the user names it in the Twin.
 *
 * The address is always there and always unique; the model is friendlier when
 * the camera reports one. Contract 2 rule 3 — not a question worth asking, since
 * the Twin asks for the real name anyway.
 */
export const cameraLabel = (camera: DiscoveredCamera): string =>
  camera.model ?? camera.manufacturer ?? camera.address;
