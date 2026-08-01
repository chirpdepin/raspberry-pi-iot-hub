import { err, type Result } from '../../domain/errors';
import { lnsUrlForRegion, normalisePem, type GatewayRegistration, type LnsCredentials } from '../../domain/gateway';

import type { GatewayRegisterPorts } from './contract';

/**
 * Registers the gateway, then fetches its certificates and assembles the four
 * files Basic Station needs.
 *
 * The LNS URL is derived from the chosen region rather than requested from the
 * API, which does not return it. That is what spares the user from knowing or
 * typing a `wss://` hostname (Contract 2 rule 3).
 *
 * Certificates are normalised here, not in the adapter: CRLF is a domain
 * concern because it is Basic Station that rejects it, and it does so silently.
 */
export const handleGatewayRegister = async (
  ports: GatewayRegisterPorts,
  registration: GatewayRegistration
): Promise<Result<LnsCredentials>> => {
  const registered = await ports.chirp.register(registration);
  if (!registered.ok) return err(registered.error);

  const certificates = await ports.chirp.fetchCertificates(registration.eui);
  if (!certificates.ok) return err(certificates.error);

  return {
    ok: true,
    value: {
      uri: lnsUrlForRegion(registration.region),
      trust: normalisePem(certificates.value.trust),
      cert: normalisePem(certificates.value.cert),
      key: normalisePem(certificates.value.key),
    },
  };
};
