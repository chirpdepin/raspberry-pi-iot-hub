import { err, ok, type Result } from '../../domain/errors';
import { isPemOfType, normalisePem, type LnsCredentials } from '../../domain/gateway';
import { domainError } from '../../domain/errors';

import type { GatewayProvisionPorts } from './contract';

/** The unit gates on tc.uri existing, so it is written LAST — see below. */
const SERVICE_NAME = 'iot-hub-lorawan';

/**
 * Installs credentials and starts the gateway.
 *
 * Two decisions worth keeping:
 *
 * 1. **Validate before writing.** A malformed certificate caught here produces
 *    "this file is not a certificate"; the same file written to disk produces a
 *    Basic Station log three screens later that says almost nothing.
 *
 * 2. **tc.uri is written last.** `iot-hub-lorawan.service` carries
 *    `ConditionPathExists=/etc/iot-hub/lorawan/tc.uri`, so writing it first
 *    would let the service start against a half-written credential set.
 */
export const handleGatewayProvision = async (
  ports: GatewayProvisionPorts,
  credentials: LnsCredentials,
  onProgress?: (step: string) => void
): Promise<Result<void>> => {
  if (!isPemOfType(credentials.trust, 'CERTIFICATE')) {
    return err(domainError('unknown', 'The trust file is not a certificate. Check you uploaded tc.trust.'));
  }
  if (!isPemOfType(credentials.cert, 'CERTIFICATE')) {
    return err(domainError('unknown', 'The certificate file is not a certificate. Check you uploaded tc.crt.'));
  }
  if (!isPemOfType(credentials.key, 'PRIVATE KEY')) {
    return err(domainError('unknown', 'The key file is not a private key. Check you uploaded tc.key.'));
  }

  const dir = ports.paths.credentialsDir();

  onProgress?.('Installing certificates…');

  // 0o640: readable by the service, not world-readable. A private key is in here.
  const writes: [string, string][] = [
    [`${dir}/tc.trust`, normalisePem(credentials.trust)],
    [`${dir}/tc.crt`, normalisePem(credentials.cert)],
    [`${dir}/tc.key`, normalisePem(credentials.key)],
  ];

  // Sequential on purpose: a failure must stop the remaining writes rather than
  // leave a partial credential set on disk. Promise.all would write all four.
  // eslint-disable-next-line no-await-in-loop
  for (const [path, content] of writes) {
    const written = await ports.privileged.writeFile(path, content, 0o640);
    if (!written.ok) return err(written.error);
  }

  // Last, because the service's start condition is this file's existence.
  const uriWritten = await ports.privileged.writeFile(`${dir}/tc.uri`, `${credentials.uri}\n`, 0o640);
  if (!uriWritten.ok) return err(uriWritten.error);

  onProgress?.('Starting the gateway…');

  const started = await ports.privileged.startService(SERVICE_NAME);
  if (!started.ok) return err(started.error);

  return ok(undefined);
};
