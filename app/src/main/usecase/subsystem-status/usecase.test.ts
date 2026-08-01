import { describe, expect, it, vi } from 'vitest';

import { needsAttention, type SubsystemId, type SubsystemStatus } from '../../domain/subsystem';

import { handleSubsystemStatus } from './usecase';
import type { SubsystemProbePort } from './contract';

const working = (id: SubsystemId): SubsystemProbePort => ({
  id,
  probe: async () => ({ id, state: 'running', summary: 'Working.' }),
});

const broken = (id: SubsystemId, message = 'ENODEV'): SubsystemProbePort => ({
  id,
  probe: async () => {
    throw new Error(message);
  },
});

const hanging = (id: SubsystemId): SubsystemProbePort => ({
  id,
  probe: () => new Promise<SubsystemStatus>((resolve) => setTimeout(() => resolve(working(id).probe()), 5)),
});

describe('subsystem-status', () => {
  it('reports every subsystem', async () => {
    const result = await handleSubsystemStatus({
      probes: [working('lorawan'), working('zigbee'), working('cameras')],
    });

    expect(result.map((s) => s.id)).toEqual(['lorawan', 'zigbee', 'cameras']);
    expect(result.every((s) => s.state === 'running')).toBe(true);
  });

  /**
   * The Phase 11 partial-failure risk, as a test. Pulling the Zigbee dongle
   * must change the Zigbee page and nothing else.
   */
  it('keeps the other subsystems intact when one probe throws', async () => {
    const result = await handleSubsystemStatus({
      probes: [working('lorawan'), broken('zigbee'), working('cameras')],
    });

    expect(result).toHaveLength(3);
    expect(result.find((s) => s.id === 'lorawan')?.state).toBe('running');
    expect(result.find((s) => s.id === 'cameras')?.state).toBe('running');
    expect(result.find((s) => s.id === 'zigbee')?.state).toBe('failed');
  });

  it('survives every probe throwing at once', async () => {
    const result = await handleSubsystemStatus({
      probes: [broken('lorawan'), broken('zigbee'), broken('cameras')],
    });

    expect(result).toHaveLength(3);
    expect(result.every((s) => s.state === 'failed')).toBe(true);
  });

  it('gives a thrown probe a next action and hides the raw text', async () => {
    const [status] = await handleSubsystemStatus({ probes: [broken('zigbee', 'ENODEV /dev/zigbee')] });

    expect(status?.nextAction).toEqual({ label: 'Open Zigbee', route: '/zigbee' });
    expect(status?.summary).not.toContain('ENODEV');
    expect(status?.technicalDetail).toBe('ENODEV /dev/zigbee');
  });

  it('runs probes concurrently rather than one after another', async () => {
    const probes = [hanging('lorawan'), hanging('zigbee'), hanging('cameras')];
    const spies = probes.map((p) => vi.spyOn(p, 'probe'));

    await handleSubsystemStatus({ probes });

    // All three started before any resolved; sequential awaits would mean the
    // second only begins after the first settles.
    expect(spies.every((s) => s.mock.calls.length === 1)).toBe(true);
  });

  it('raises attention only for failures, so a fresh install is not a wall of warnings', async () => {
    const states: SubsystemStatus[] = [
      { id: 'lorawan', state: 'unavailable', summary: 'No LoRaWAN radio on this computer.' },
      { id: 'zigbee', state: 'not-configured', summary: 'Not set up yet.' },
      { id: 'cameras', state: 'failed', summary: 'A camera is offline.' },
    ];

    expect(states.filter(needsAttention).map((s) => s.id)).toEqual(['cameras']);
  });
});
