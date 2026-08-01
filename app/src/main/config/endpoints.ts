/**
 * Chirp API endpoints — Contract 4's single source of truth for URLs.
 *
 * A URL built inline in three different use cases is three places to change
 * when the cloud moves, and two of them will be missed.
 */

export const CHIRP_API = {
  /** Overridable so a developer can point at a staging BFF. */
  baseUrl: process.env['CHIRP_API_URL'] ?? 'https://api.chirpwireless.io',

  /**
   * Creates a non-miner node with one gateway in the given band.
   * Verified in bff/pkg/api/gateways.go:72.
   */
  registerGateway: (band: string, gatewayId: string) => `/nodes/nonminer/${band}/${gatewayId}`,

  /**
   * Returns a ZIP already containing tc.trust, tc.crt and tc.key.
   * Verified in bff/pkg/api/certissuer.go:17.
   */
  signedCertificate: (gatewayId: string) => `/nodes/signed-cert/${gatewayId}`,
} as const;

/** Names of the files inside the certificate ZIP, as the BFF writes them. */
export const CERT_ZIP_ENTRIES = {
  trust: 'tc.trust',
  cert: 'tc.crt',
  key: 'tc.key',
} as const;
