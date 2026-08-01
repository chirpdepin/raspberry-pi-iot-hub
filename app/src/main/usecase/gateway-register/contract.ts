import type { Result } from '../../domain/errors';
import type { GatewayRegistration, LnsCredentials } from '../../domain/gateway';

/**
 * Registers the gateway with Chirp and collects its credentials.
 *
 * Contract 1 (D): `ChirpGatewayPort` is declared here, by the consumer, not by
 * the HTTP adapter that implements it.
 */

export interface ChirpGatewayPort {
  /** POST /nodes/nonminer/{band}/{gatewayId} — creates the gateway. */
  register(registration: GatewayRegistration): Promise<Result<void>>;
  /**
   * GET /nodes/signed-cert/{gateway_id} — returns a ZIP already containing
   * tc.trust, tc.crt and tc.key. The adapter unpacks it; the use case only ever
   * sees the three PEM strings.
   */
  fetchCertificates(eui: string): Promise<Result<{ trust: string; cert: string; key: string }>>;
}

export interface GatewayRegisterPorts {
  chirp: ChirpGatewayPort;
}

export type GatewayRegisterResult = Result<LnsCredentials>;
