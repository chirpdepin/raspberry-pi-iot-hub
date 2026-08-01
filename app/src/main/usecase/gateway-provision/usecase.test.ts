import { describe, expect, it, vi } from 'vitest';

import { ok } from '../../domain/errors';
import type { LnsCredentials } from '../../domain/gateway';

import type { GatewayProvisionPorts } from './contract';
import { handleGatewayProvision } from './usecase';

const CERT = '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----\n';
const KEY = '-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----\n';

const credentials: LnsCredentials = {
  uri: 'wss://lora-eu868.cloud.chirpwireless.io:443',
  trust: CERT,
  cert: CERT,
  key: KEY,
};

const ports = () => {
  const written: { path: string; content: string; mode?: number }[] = [];
  const startService = vi.fn(async () => ok(undefined));

  const value: GatewayProvisionPorts & { written: typeof written; startService: typeof startService } = {
    privileged: {
      writeFile: async (path, content, mode) => {
        written.push({ path, content, mode });
        return ok(undefined);
      },
      startService,
    },
    paths: { credentialsDir: () => '/etc/iot-hub/lorawan' },
    written,
    startService,
  };

  return value;
};

describe('gateway-provision', () => {
  it('writes all four credential files and starts the service', async () => {
    const p = ports();
    const result = await handleGatewayProvision(p, credentials);

    expect(result.ok).toBe(true);
    expect(p.written.map((w) => w.path)).toEqual([
      '/etc/iot-hub/lorawan/tc.trust',
      '/etc/iot-hub/lorawan/tc.crt',
      '/etc/iot-hub/lorawan/tc.key',
      '/etc/iot-hub/lorawan/tc.uri',
    ]);
    expect(p.startService).toHaveBeenCalledWith('iot-hub-lorawan');
  });

  it('writes tc.uri last, because the service start condition is its existence', async () => {
    const p = ports();
    await handleGatewayProvision(p, credentials);

    // iot-hub-lorawan.service carries ConditionPathExists on tc.uri. Writing it
    // first would let the unit start against a half-written credential set.
    expect(p.written.at(-1)?.path).toBe('/etc/iot-hub/lorawan/tc.uri');
  });

  it('never leaves the private key world-readable', async () => {
    const p = ports();
    await handleGatewayProvision(p, credentials);

    const key = p.written.find((w) => w.path.endsWith('tc.key'));
    expect(key?.mode).toBe(0o640);
  });

  it('rejects a certificate in the key slot before writing anything', async () => {
    const p = ports();
    const result = await handleGatewayProvision(p, { ...credentials, key: CERT });

    // Caught here it says "that is not a private key". Written to disk it
    // becomes a Basic Station log three screens later that says almost nothing.
    expect(result.ok).toBe(false);
    expect(p.written).toHaveLength(0);
    expect(p.startService).not.toHaveBeenCalled();
  });

  it('rejects a key in a certificate slot before writing anything', async () => {
    const p = ports();
    const result = await handleGatewayProvision(p, { ...credentials, trust: KEY });

    expect(result.ok).toBe(false);
    expect(p.written).toHaveLength(0);
  });

  it('normalises CRLF before writing', async () => {
    const p = ports();
    await handleGatewayProvision(p, {
      ...credentials,
      cert: CERT.replace(/\n/g, '\r\n'),
    });

    const cert = p.written.find((w) => w.path.endsWith('tc.crt'));
    expect(cert?.content).not.toContain('\r');
  });

  it('reports progress in plain language, not command names', async () => {
    const steps: string[] = [];
    await handleGatewayProvision(ports(), credentials, (step) => steps.push(step));

    // Contract 2 rule 1: no systemctl, no unit names, no jargon.
    expect(steps).toEqual(['Installing certificates…', 'Starting the gateway…']);
    for (const step of steps) {
      expect(step).not.toMatch(/systemctl|docker|container|tc\./i);
    }
  });
});
