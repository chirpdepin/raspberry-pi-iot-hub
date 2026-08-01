import { describe, expect, it, vi } from 'vitest';

import { ok } from '../../domain/errors';
import type { ZigbeeCoordinator } from '../../domain/zigbee';

import type { ZigbeeStartPorts } from './contract';
import { DEFAULT_ZIGBEE_CHANNEL, handleZigbeeStart } from './usecase';

const coordinator: ZigbeeCoordinator = {
  model: 'SONOFF_Dongle_Plus_MG24',
  port: '/dev/zigbee',
  adapter: 'ember',
  transport: 'serial',
  serial: 'f620d69ac39aef11aa72ad9061ce3355',
};

const ports = (overrides: Partial<ZigbeeStartPorts['service']> = {}) => {
  const start = vi.fn(async () => ok(undefined));

  const value: ZigbeeStartPorts & { start: typeof start } = {
    service: {
      coordinator: async () => coordinator,
      isRunning: async () => false,
      start,
      ...overrides,
    },
    start,
  };

  return value;
};

describe('zigbee-start', () => {
  it('starts on the stable role symlink, never a ttyUSB path', async () => {
    const p = ports();
    await handleZigbeeStart(p);

    // /dev/ttyUSB0 is enumeration-ordered and would point at a different device
    // after a replug — or at the LoRaWAN card.
    expect(p.start).toHaveBeenCalledWith(expect.objectContaining({ port: '/dev/zigbee' }));
  });

  it('defaults to a channel that avoids common Wi-Fi', async () => {
    const p = ports();
    await handleZigbeeStart(p);

    // Channel 11 overlaps Wi-Fi channel 1 and is the usual cause of "Zigbee is
    // flaky" on a hub whose own Wi-Fi is in use.
    expect(DEFAULT_ZIGBEE_CHANNEL).toBe(15);
    expect(p.start).toHaveBeenCalledWith(expect.objectContaining({ channel: 15 }));
  });

  it('explains rather than guessing when the adapter type is unknown', async () => {
    const p = ports({ coordinator: async () => ({ ...coordinator, adapter: null }) });
    const result = await handleZigbeeStart(p);

    // The wrong adapter fails with "failed to connect to the adapter", which
    // points at the cable rather than at the setting that is actually wrong.
    expect(result.ok).toBe(false);
    expect(p.start).not.toHaveBeenCalled();
  });

  it('is idempotent when already running', async () => {
    const p = ports({ isRunning: async () => true });
    const result = await handleZigbeeStart(p);

    expect(result.ok).toBe(true);
    expect(p.start).not.toHaveBeenCalled();
  });

  it('reports a missing coordinator as an explanation, not a crash', async () => {
    const p = ports({ coordinator: async () => null });
    const result = await handleZigbeeStart(p);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('USB dongle');
  });
});
