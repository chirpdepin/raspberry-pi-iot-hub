import { describe, expect, it } from 'vitest';

import type { ZigbeeDeviceListPorts } from './contract';
import { handleZigbeeDeviceList } from './usecase';

const bulb = {
  ieeeAddress: '0x00124b0022a1b2c3',
  displayName: 'Living room lamp',
  type: 'Router',
  manufacturer: 'IKEA',
  model: 'LED1836G9',
  linkQuality: 132,
  batteryPercent: null,
  lastSeen: '2026-08-01T00:00:00Z',
  connectedToHub: true,
};

const ports = (provisioned: string[] | (() => Promise<never>)): ZigbeeDeviceListPorts => ({
  zigbee: {
    coordinator: async () => null,
    devices: async () => [bulb],
    isRunning: async () => true,
  },
  chirp: {
    provisionedIds: typeof provisioned === 'function' ? provisioned : async () => provisioned,
  },
});

describe('zigbee-device-list', () => {
  it('reports hub and Chirp status independently', async () => {
    const [device] = await handleZigbeeDeviceList(ports([bulb.ieeeAddress]));

    expect(device?.connectedToHub).toBe(true);
    expect(device?.connectedToChirp).toBe(true);
  });

  it('shows a device paired locally but not yet in Chirp', async () => {
    const [device] = await handleZigbeeDeviceList(ports([]));

    // This is the case that tells the user the radio is fine and the cloud link
    // is the problem — the single most useful distinction on this screen.
    expect(device?.connectedToHub).toBe(true);
    expect(device?.connectedToChirp).toBe(false);
  });

  it('still lists local devices when Chirp is unreachable', async () => {
    const devices = await handleZigbeeDeviceList(
      ports(async () => {
        throw new Error('network down');
      })
    );

    // A cloud outage must not blank the page whose job is to diagnose it.
    expect(devices).toHaveLength(1);
    expect(devices[0]?.connectedToHub).toBe(true);
    expect(devices[0]?.connectedToChirp).toBe(false);
  });
});
