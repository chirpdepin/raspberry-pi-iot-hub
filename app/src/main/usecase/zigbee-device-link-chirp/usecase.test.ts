import { describe, expect, it, vi } from 'vitest';

import { ok } from '../../domain/errors';

import type { ChirpProvisionPort, ZigbeeLinkChirpPorts } from './contract';
import { handleZigbeeLinkChirp } from './usecase';

const IEEE = '0x00124b0022a1b2c3';

const input = {
  ieeeAddress: IEEE,
  displayName: 'Living room lamp',
  gatewayEui: '0016C001FF1E96BB',
  hubName: 'Chirp Hub — iot-hub',
};

type ProvisionInput = Parameters<ChirpProvisionPort['provisionDevice']>[0];

const ports = (payload: Record<string, unknown> | null) => {
  // Typed explicitly so assertions below can read the recorded call shape.
  const provisionDevice = vi.fn<(input: ProvisionInput) => Promise<ReturnType<typeof ok<void>>>>(async () =>
    ok(undefined)
  );

  const value: ZigbeeLinkChirpPorts & { provisionDevice: typeof provisionDevice } = {
    chirp: {
      ensureConnection: async () => ok('conn-123'),
      provisionDevice,
    },
    payloads: { lastPayload: async () => payload },
    provisionDevice,
  };

  return value;
};

describe('zigbee-device-link-chirp', () => {
  it('provisions against the IEEE address, never the display name', async () => {
    const p = ports({ state: 'ON', brightness: 254, linkquality: 132 });
    await handleZigbeeLinkChirp(p, input);

    // The IEEE address is the Zigbee2MQTT topic and is stable forever. A display
    // name is editable, and provisioning against it would break the moment
    // somebody renamed the device.
    expect(p.provisionDevice).toHaveBeenCalledWith(expect.objectContaining({ clientDeviceId: IEEE }));
  });

  it('uses a device_id_topic whose remote prefix differs from the local one', async () => {
    const p = ports({ state: 'ON' });
    await handleZigbeeLinkChirp(p, input);

    const call = p.provisionDevice.mock.calls[0]?.[0];

    // Identical local and remote prefixes make the Mosquitto bridge re-publish
    // what it just received, forever.
    expect(call?.deviceIdTopic).toBe('chirp/0016C001FF1E96BB/zigbee/{{deviceId}}');
    expect(call?.deviceIdTopic.startsWith('zigbee2mqtt/')).toBe(false);
  });

  it('proposes mappings from the payload actually observed', async () => {
    const p = ports({ state: 'ON', brightness: 254, temperature: 21.5 });
    await handleZigbeeLinkChirp(p, input);

    const paths = p.provisionDevice.mock.calls[0]?.[0]?.sensorMappings.map((m) => m.sourcePath);

    // A static device database cannot cover devices nobody has modelled; the
    // payload the device actually sent can.
    expect(paths).toEqual(expect.arrayContaining(['state', 'brightness', 'temperature']));
  });

  it('excludes diagnostics from the default selection but still offers them', async () => {
    const p = ports({ temperature: 21.5, linkquality: 132 });
    await handleZigbeeLinkChirp(p, input);

    const paths = p.provisionDevice.mock.calls[0]?.[0]?.sensorMappings.map((m) => m.sourcePath);

    // linkquality is useful for troubleshooting and noise on a dashboard.
    expect(paths).toContain('temperature');
    expect(paths).not.toContain('linkquality');
  });

  it('infers units for well-known keys', async () => {
    const p = ports({ temperature: 21.5, humidity: 44 });
    await handleZigbeeLinkChirp(p, input);

    const mappings = p.provisionDevice.mock.calls[0]?.[0]?.sensorMappings ?? [];

    expect(mappings.find((m) => m.sourcePath === 'temperature')?.unit).toBe('°C');
    expect(mappings.find((m) => m.sourcePath === 'humidity')?.unit).toBe('%');
  });

  it('refuses to provision a device that has never reported', async () => {
    const p = ports(null);
    const result = await handleZigbeeLinkChirp(p, input);

    // Provisioning a device with no sensors leaves the user wondering why Chirp
    // shows nothing. Saying "it has not reported yet" is actionable.
    expect(result.ok).toBe(false);
    expect(p.provisionDevice).not.toHaveBeenCalled();
  });
});
