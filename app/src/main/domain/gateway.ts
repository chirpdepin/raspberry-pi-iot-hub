/**
 * LoRaWAN gateway domain.
 *
 * Contract 1: no imports. Pure types and the one piece of real domain
 * knowledge — how a region maps to an LNS hostname.
 */

/**
 * Regions accepted by Chirp, taken from `device_provision_lorawan`'s enum.
 *
 * NOTE: `POST /nodes/nonminer/{band}/{gatewayId}` does not enumerate its
 * accepted `band` values anywhere in the BFF. This list is inferred from the
 * device-provisioning enum plus the LNS hostname pattern, and is flagged in
 * app/electron.md as needing one confirmation from the backend team — a wrong
 * value fails at gateway creation.
 */
export const LORAWAN_REGIONS = [
  'EU868',
  'US915',
  'AU915',
  'AS923',
  'AS923-2',
  'EU433',
  'IN865',
  'KR920',
  'RU864',
  'CN470',
  'CN779',
  'ISM2400',
] as const;

export type LorawanRegion = (typeof LORAWAN_REGIONS)[number];

export interface Concentrator {
  /** 16 hex characters, read from the chip — never typed by the user. */
  eui: string;
  model: string;
  interface: string;
  devicePath: string;
}

export interface GatewayRegistration {
  eui: string;
  name: string;
  region: LorawanRegion;
}

export interface LnsCredentials {
  /** wss:// URL of the network server. */
  uri: string;
  /** CA certificate. */
  trust: string;
  /** Client certificate. */
  cert: string;
  /** Client private key. */
  key: string;
}

/**
 * The LNS URL is **derived**, not returned by the API.
 *
 * `GET /nodes/signed-cert/{gateway_id}` returns only tc.trust, tc.crt and
 * tc.key; the URI is a documented per-region hostname pattern
 * (docs/configuration.md). Deriving it is what keeps the user from having to
 * know or type it (Contract 2 rule 3).
 */
export const lnsUrlForRegion = (region: LorawanRegion): string =>
  `wss://lora-${region.toLowerCase()}.cloud.chirpwireless.io:443`;

/**
 * Basic Station rejects CRLF in its certificate files quietly enough to waste an
 * afternoon — the gateway simply never connects and the log says nothing useful.
 * Normalising on the way in is why scripts/fix_certs.sh exists at all.
 */
export const normalisePem = (content: string): string => content.replace(/\r\n/g, '\n').trimEnd() + '\n';

/** A PEM block of the expected type, so a wrong file is caught before it is written. */
export const isPemOfType = (content: string, type: 'CERTIFICATE' | 'PRIVATE KEY'): boolean => {
  const normalised = content.replace(/\r\n/g, '\n');
  if (type === 'PRIVATE KEY') {
    // Covers PKCS#1 (RSA/EC PRIVATE KEY) as well as PKCS#8 (PRIVATE KEY).
    return /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/.test(normalised);
  }
  return normalised.includes('-----BEGIN CERTIFICATE-----');
};
