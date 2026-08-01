/**
 * LoRaWAN gateway domain.
 *
 * Contract 1: no imports. Pure types and the one piece of real domain
 * knowledge — how a region maps to an LNS hostname.
 */

/**
 * Bands accepted when registering a gateway.
 *
 * Read off the Chirp console's own region picker on 2026-08-01, which is the
 * authority for `POST /nodes/nonminer/{band}/{gatewayId}` — the BFF does not
 * enumerate them anywhere.
 *
 * This replaces a list inferred from `device_provision_lorawan`'s enum, which
 * was wrong in three ways and would have failed at gateway creation: the
 * Australian and US bands carry a sub-plan suffix (`AU915-0`, `US915-0`,
 * `US915-1`, not `AU915`/`US915`), and CN470, CN779 and ISM2400 are offered for
 * devices but not for gateways.
 */
export const LORAWAN_REGIONS = [
  'AS923',
  'AS923-2',
  'AU915-0',
  'EU433',
  'EU868',
  'IN865',
  'KR920',
  'RU864',
  'US915-0',
  'US915-1',
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
 * tc.key; the URI is a per-region hostname pattern. Deriving it is what keeps
 * the user from having to know or type it (Contract 2 rule 3).
 *
 * Verified against the console on 2026-08-01: registering EU868 displayed
 * exactly `wss://lora-eu868.cloud.chirpwireless.io:443`.
 *
 * The sub-plan suffix is dropped. `US915-0` and `US915-1` are two channel plans
 * on one network server, so the host is `lora-us915`, not `lora-us915-0`.
 */
export const lnsUrlForRegion = (region: LorawanRegion): string =>
  `wss://lora-${region.toLowerCase().replace(/-\d+$/, '')}.cloud.chirpwireless.io:443`;

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
