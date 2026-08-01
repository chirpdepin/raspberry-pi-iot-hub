import type { Result } from '../../domain/errors';
import type { CameraScan } from '../../domain/camera';

/**
 * Finding cameras on the network.
 *
 * **Discovery is the one camera concern this app keeps**, and only because it
 * answers a question the user genuinely cannot: what address is my camera on.
 * The Twin has its own ONVIF discovery, but it cannot run before a Twin exists,
 * and choosing which camera to create one *for* is the step that comes first.
 *
 * The port returns a `Result` rather than a bare array so that "the scan could
 * not run" stays distinguishable from "your network has no cameras" — two
 * answers that look identical as an empty list and need completely different
 * advice.
 */
export interface CameraDiscoveryPort {
  /**
   * Returns the networks it considered alongside the cameras it found.
   *
   * The scope is part of the answer, not decoration: "found 1" is indefensible
   * on its own to someone who owns twenty cameras, and "searched 254 addresses
   * on 192.168.2.0/24" is what turns it from a suspected bug into a fact they
   * can act on.
   */
  discover(): Promise<Result<CameraScan>>;
}

/**
 * Which cameras already have a Twin.
 *
 * Its own narrow port (Contract 1 I): discovery scans a network and knows
 * nothing about what we have set up. Merging the two would put the record store
 * behind the same interface as a UDP socket.
 */
export interface ConfiguredAddressPort {
  addresses(): Promise<string[]>;
}

export interface CameraDiscoverPorts {
  discovery: CameraDiscoveryPort;
  configured: ConfiguredAddressPort;
}
