import { describe, expect, it, vi } from 'vitest';

import { ok } from '../../domain/errors';

import type { ZigbeePermitJoinPorts } from './contract';
import { JOIN_WINDOW_SECONDS, handleZigbeePermitJoin, handleZigbeeStopJoin } from './usecase';

const ports = (permitJoin = vi.fn(async () => ok(undefined)), stopJoin = vi.fn(async () => ok(undefined))) => ({
  ports: { zigbee: { permitJoin, stopJoin } } as ZigbeePermitJoinPorts,
  permitJoin,
  stopJoin,
});

describe('zigbee-permit-join', () => {
  it('opens the network for a bounded window by default', async () => {
    const { ports: p, permitJoin } = ports();
    await handleZigbeePermitJoin(p);

    // A permanently open Zigbee network lets any nearby device join uninvited.
    expect(permitJoin).toHaveBeenCalledWith(JOIN_WINDOW_SECONDS);
    expect(JOIN_WINDOW_SECONDS).toBeGreaterThan(0);
    expect(JOIN_WINDOW_SECONDS).toBeLessThanOrEqual(254);
  });

  it('refuses an unbounded window', async () => {
    const { ports: p, permitJoin } = ports();

    expect((await handleZigbeePermitJoin(p, 0)).ok).toBe(false);
    expect((await handleZigbeePermitJoin(p, 100000)).ok).toBe(false);
    expect(permitJoin).not.toHaveBeenCalled();
  });

  it('can close the window early', async () => {
    const { ports: p, stopJoin } = ports();
    await handleZigbeeStopJoin(p);

    expect(stopJoin).toHaveBeenCalledOnce();
  });
});
