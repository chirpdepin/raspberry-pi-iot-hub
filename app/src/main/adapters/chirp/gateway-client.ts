import { domainError, err, ok, type Result } from '../../domain/errors';
import type { GatewayRegistration } from '../../domain/gateway';
import { CERT_ZIP_ENTRIES, CHIRP_API } from '../../config/endpoints';
import type { ChirpGatewayPort } from '../../usecase/gateway-register/contract';

/**
 * Chirp BFF client for gateway registration.
 *
 * Endpoints verified in bff/pkg/api/: gateways.go:72 creates the node, and
 * certissuer.go:17 returns a ZIP that already contains tc.trust, tc.crt and
 * tc.key under exactly those names.
 *
 * Unzipping happens here so the use case only ever handles three PEM strings —
 * the archive format is a transport detail.
 */

export interface ChirpAuth {
  /** Bearer token from the Chirp sign-in flow. */
  token(): string | null;
}

export interface ChirpGatewayClientDeps {
  auth: ChirpAuth;
  /** Injected so tests never reach the network. */
  fetchImpl?: typeof fetch;
  /** Injected because unzipping is a library concern, not business logic. */
  unzip: (data: ArrayBuffer) => Promise<Record<string, string>>;
}

export const createChirpGatewayClient = ({
  auth,
  fetchImpl = fetch,
  unzip,
}: ChirpGatewayClientDeps): ChirpGatewayPort => {
  const request = async (path: string, init?: RequestInit): Promise<Response | Result<never>> => {
    const token = auth.token();
    if (!token) {
      return err(domainError('permission-denied', 'Sign in to Chirp to continue.'));
    }

    return fetchImpl(`${CHIRP_API.baseUrl}${path}`, {
      ...init,
      headers: {
        ...init?.headers,
        Authorization: `Bearer ${token}`,
      },
    });
  };

  return {
    async register(registration: GatewayRegistration): Promise<Result<void>> {
      try {
        const response = await request(CHIRP_API.registerGateway(registration.region, registration.eui), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: registration.name }),
        });

        if (!(response instanceof Response)) return response;

        if (!response.ok) {
          const detail = await response.text().catch(() => '');

          // 409 is the single most likely failure in practice, and it has a
          // completely different remedy from a genuine error.
          if (response.status === 409) {
            return err(
              domainError(
                'unknown',
                'This gateway is already registered in Chirp. Use "I already registered this gateway" instead.',
                detail
              )
            );
          }

          return err(
            domainError('unknown', "Couldn't register the gateway with Chirp.", `${response.status} ${detail}`)
          );
        }

        return ok(undefined);
      } catch (error) {
        return err(
          domainError(
            'unknown',
            "Couldn't reach Chirp. Check this device's internet connection.",
            error instanceof Error ? error.message : String(error)
          )
        );
      }
    },

    async fetchCertificates(eui: string) {
      try {
        const response = await request(CHIRP_API.signedCertificate(eui));
        if (!(response instanceof Response)) return response;

        if (!response.ok) {
          const detail = await response.text().catch(() => '');
          return err(
            domainError('unknown', "Couldn't download the gateway certificates.", `${response.status} ${detail}`)
          );
        }

        const entries = await unzip(await response.arrayBuffer());

        const trust = entries[CERT_ZIP_ENTRIES.trust];
        const cert = entries[CERT_ZIP_ENTRIES.cert];
        const key = entries[CERT_ZIP_ENTRIES.key];

        if (!trust || !cert || !key) {
          return err(
            domainError(
              'unknown',
              'The certificate download was incomplete. Try again.',
              `archive contained: ${Object.keys(entries).join(', ')}`
            )
          );
        }

        return ok({ trust, cert, key });
      } catch (error) {
        return err(
          domainError(
            'unknown',
            "Couldn't download the gateway certificates.",
            error instanceof Error ? error.message : String(error)
          )
        );
      }
    },
  };
};
