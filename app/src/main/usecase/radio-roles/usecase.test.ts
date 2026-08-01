import { describe, expect, it, vi } from 'vitest';

import type { IdentifiedSerialDevice, RadioRole } from '../../domain/radio';

import type { RadioRolesPorts } from './contract';
import { handleRadioRoles } from './usecase';

const device = (overrides: Partial<IdentifiedSerialDevice> = {}): IdentifiedSerialDevice => ({
  node: '/dev/ttyUSB0',
  vendor: 'SONOFF',
  model: 'SONOFF Dongle Plus MG24',
  serial: 'aaa',
  adapter: 'ember',
  known: true,
  ...overrides,
});

const ports = (devices: IdentifiedSerialDevice[], pinned: Record<string, RadioRole> = {}) => {
  const assign = vi.fn(async () => undefined);

  const value: RadioRolesPorts & { assign: typeof assign } = {
    scan: { scan: async () => devices },
    roles: { roles: async () => pinned, assign },
    assign,
  };

  return value;
};

describe('radio-roles', () => {
  it('claims a lone recognised coordinator for Zigbee', async () => {
    const p = ports([device()]);

    const result = await handleRadioRoles(p);

    expect(result.assigned).toEqual([{ role: 'zigbee', device: device() }]);
    expect(p.assign).toHaveBeenCalledWith('aaa', 'zigbee');
  });

  /**
   * One radio cannot run Zigbee and Thread at once — different firmware — so
   * choosing for the user would be wrong half the time.
   */
  it('refuses to guess between two unclaimed coordinators', async () => {
    const p = ports([device({ serial: 'aaa' }), device({ serial: 'bbb', node: '/dev/ttyUSB1' })]);

    const result = await handleRadioRoles(p);

    expect(result.assigned).toEqual([]);
    expect(result.awaitingChoice).toHaveLength(2);
    expect(p.assign).not.toHaveBeenCalled();
  });

  it('never claims hardware it does not recognise', async () => {
    const p = ports([device({ vendor: 'Silicon Labs', model: 'CP2102', adapter: null, known: false })]);

    const result = await handleRadioRoles(p);

    expect(result.assigned).toEqual([]);
    expect(result.unrecognised).toHaveLength(1);
    expect(p.assign).not.toHaveBeenCalled();
  });

  it('honours a role already pinned to that serial', async () => {
    const p = ports([device({ serial: 'aaa' })], { aaa: 'thread' });

    const result = await handleRadioRoles(p);

    expect(result.assigned).toEqual([{ role: 'thread', device: device({ serial: 'aaa' }) }]);
    expect(p.assign).not.toHaveBeenCalled();
  });

  it('does not claim a second dongle for Zigbee when one already holds it', async () => {
    const p = ports([device({ serial: 'aaa' }), device({ serial: 'bbb', node: '/dev/ttyUSB1' })], { aaa: 'zigbee' });

    const result = await handleRadioRoles(p);

    expect(result.assigned).toHaveLength(1);
    expect(result.awaitingChoice.map((d) => d.serial)).toEqual(['bbb']);
    expect(p.assign).not.toHaveBeenCalled();
  });

  it('does not pin a device that published no serial, since it could not be found again', async () => {
    const p = ports([device({ serial: '' })]);

    const result = await handleRadioRoles(p);

    expect(p.assign).not.toHaveBeenCalled();
    expect(result.awaitingChoice).toHaveLength(1);
  });

  it('reports nothing at all when no radio is attached', async () => {
    const result = await handleRadioRoles(ports([]));

    expect(result).toEqual({ assigned: [], awaitingChoice: [], unrecognised: [] });
  });
});
