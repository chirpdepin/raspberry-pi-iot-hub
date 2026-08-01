import { describe, expect, it, vi } from 'vitest';

import { domainError, err, ok } from '../../domain/errors';
import type { GatewayRegistration } from '../../domain/gateway';

import type { GatewayRegisterPorts } from './contract';
import { handleGatewayRegister } from './usecase';

const registration: GatewayRegistration = {
  eui: '0016C001FF1E96BB',
  name: 'Chirp Hub — iot-hub',
  region: 'EU868',
};

/** Certificates as a real server sends them: CRLF line endings. */
const CRLF_CERT = '-----BEGIN CERTIFICATE-----\r\nMIIB\r\n-----END CERTIFICATE-----\r\n';
const CRLF_KEY = '-----BEGIN PRIVATE KEY-----\r\nMIIE\r\n-----END PRIVATE KEY-----\r\n';

const ports = (overrides: Partial<GatewayRegisterPorts['chirp']> = {}): GatewayRegisterPorts => ({
  chirp: {
    register: async () => ok(undefined),
    fetchCertificates: async () => ok({ trust: CRLF_CERT, cert: CRLF_CERT, key: CRLF_KEY }),
    ...overrides,
  },
});

describe('gateway-register', () => {
  it('derives the LNS URL from the region rather than asking the user', async () => {
    const result = await handleGatewayRegister(ports(), registration);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.uri).toBe('wss://lora-eu868.cloud.chirpwireless.io:443');
    }
  });

  it('derives a different URL for a different region', async () => {
    const result = await handleGatewayRegister(ports(), { ...registration, region: 'US915' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.uri).toBe('wss://lora-us915.cloud.chirpwireless.io:443');
    }
  });

  it('normalises CRLF out of every certificate', async () => {
    const result = await handleGatewayRegister(ports(), registration);

    // Basic Station rejects CRLF quietly: the gateway simply never connects and
    // the log says nothing useful. This is the whole reason fix_certs.sh exists.
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.trust).not.toContain('\r');
      expect(result.value.cert).not.toContain('\r');
      expect(result.value.key).not.toContain('\r');
    }
  });

  it('does not fetch certificates when registration failed', async () => {
    const fetchCertificates = vi.fn(async () => ok({ trust: '', cert: '', key: '' }));
    const result = await handleGatewayRegister(
      ports({
        register: async () => err(domainError('unknown', 'Gateway already exists.')),
        fetchCertificates,
      }),
      registration
    );

    expect(result.ok).toBe(false);
    expect(fetchCertificates).not.toHaveBeenCalled();
  });

  it('surfaces a certificate failure rather than writing partial credentials', async () => {
    const result = await handleGatewayRegister(
      ports({ fetchCertificates: async () => err(domainError('unknown', 'Certificate service unavailable.')) }),
      registration
    );

    expect(result.ok).toBe(false);
  });
});
