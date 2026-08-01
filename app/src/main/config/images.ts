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
} as const;

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
