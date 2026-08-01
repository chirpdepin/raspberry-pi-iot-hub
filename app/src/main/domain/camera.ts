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

export interface Camera {
  id: string;
  displayName: string;
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
 * The container name for a camera's Twin, derived from its address.
 *
 * Deterministic on purpose: it makes setting up the same camera twice
 * impossible to do by accident, and it means the id can be recomputed from a
 * discovered camera without consulting anything.
 */
export const twinIdFor = (prefix: string, address: string): string =>
  `${prefix}${address.replace(/[^a-z0-9]+/gi, '-')}`;

/**
 * What to call a camera in our list before the user names it in the Twin.
 *
 * The address is always there and always unique; the model is friendlier when
 * the camera reports one. Contract 2 rule 3 — not a question worth asking, since
 * the Twin asks for the real name anyway.
 */
export const cameraLabel = (camera: DiscoveredCamera): string =>
  camera.model ?? camera.manufacturer ?? camera.address;
