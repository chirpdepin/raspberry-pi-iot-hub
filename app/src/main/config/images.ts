/**
 * Container images — Contract 4's single source of truth for every tag.
 *
 * An image tag written in both a compose file and a use case drifts, and the
 * boundary checker fails the build on any image reference outside this file.
 */

export const IMAGES = {
  mosquitto: 'eclipse-mosquitto:2.1.2-alpine',
  zigbee2mqtt: 'koenkk/zigbee2mqtt:2.12.1',
  basicstation: 'xoseperez/basicstation:latest',
  /** openthread/otbr publishes only :latest, so it is pinned by digest. */
  otbr: 'openthread/otbr@sha256:0cfccb10c3d5f878028e07ea4f652f72fc967592ee9591978c41dcced0ede4e6',
  /** Loaded from a downloaded tarball, not pulled — see TWIN_MANIFEST_URL. */
  twin: 'lens-twin',
  /**
   * A Twin built from the Lens repo on this machine, which is the tag that
   * repo's own README and compose files use (`docker build -t lens/twin:local
   * -f twin/Dockerfile .`).
   *
   * Checked **before** the update feed. A machine that already has a Twin
   * should not need the network to run one, and during development the feed
   * does not exist at all — which is not a fact worth telling a user about, it
   * is a reason to use what is already here.
   */
  twinLocal: 'lens/twin:local',
} as const;

/**
 * Prefix for Twin container names.
 *
 * `camera-add` builds a container name from it and the inventory probe filters
 * on it, so the two must agree — they did not when each spelled it out
 * separately, and a rename would have made every camera silently invisible to
 * the dashboard.
 */
export const TWIN_CONTAINER_PREFIX = 'twin-';

/**
 * The account name a Twin is seeded with on first boot.
 *
 * The password beside it is generated per Twin and shown to the user once; the
 * Twin forces a change at first login. The alternative the Twin offers —
 * `TWIN_ALLOW_DEFAULT_LOCAL_CREDENTIALS`, which fills in root/root — is
 * documented there as a dev override, and shipping a known login in an image
 * strangers flash is exactly what it warns against.
 */
export const TWIN_SEED_USERNAME = 'admin';

/**
 * The Twin update feed.
 *
 * Twin is closed-source, so it is published as a `docker save` tarball on the
 * PUBLIC raspberry-pi-iot-hub releases rather than a private registry. That
 * keeps the source closed without requiring every adopter to hold credentials
 * for a repo they cannot read.
 */
export const TWIN_MANIFEST_URL =
  process.env['TWIN_MANIFEST_URL'] ??
  'https://github.com/chirpdepin/raspberry-pi-iot-hub/releases/latest/download/twin-manifest.json';
