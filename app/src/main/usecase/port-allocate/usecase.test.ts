import { describe, expect, it } from 'vitest';

import { RESERVED_PORTS, TWIN_PORT_RANGE } from '../../config/ports';

import { handlePortAllocate } from './usecase';
import type { PortAllocatePorts } from './contract';

const ports = (opts: { free?: (port: number) => boolean; claimed?: number[] } = {}): PortAllocatePorts => ({
  probe: { isFree: async (port) => (opts.free ? opts.free(port) : true) },
  claims: { published: async () => opts.claimed ?? [] },
});

describe('port-allocate', () => {
  it('returns the first port in the Twin range when nothing is taken', async () => {
    const result = await handlePortAllocate(ports());

    expect(result).toEqual({ ok: true, value: TWIN_PORT_RANGE.start });
  });

  it('skips ports already published by a container', async () => {
    const result = await handlePortAllocate({
      ...ports({ claimed: [TWIN_PORT_RANGE.start, TWIN_PORT_RANGE.start + 1] }),
    });

    expect(result).toEqual({ ok: true, value: TWIN_PORT_RANGE.start + 2 });
  });

  /**
   * The defect this use case exists to fix. A stopped container publishes
   * nothing, so the kernel says its port is free; allocating it anyway breaks
   * both Twins the moment the stopped one restarts.
   */
  it('does not reuse a stopped container port that the kernel reports as free', async () => {
    const stopped = TWIN_PORT_RANGE.start;

    const result = await handlePortAllocate(ports({ free: () => true, claimed: [stopped] }));

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).not.toBe(stopped);
  });

  it('never returns a port another subsystem has reserved', async () => {
    // Every reserved port answers "free", which is exactly the state a stopped
    // Zigbee2MQTT or border router leaves behind.
    const reserved = RESERVED_PORTS.map((r) => r.port);

    const result = await handlePortAllocate(ports({ free: () => true }));

    expect(result.ok).toBe(true);
    if (result.ok) expect(reserved).not.toContain(result.value);
  });

  it('falls through to a bindable port when earlier ones are in use outside Docker', async () => {
    const free = (port: number) => port >= TWIN_PORT_RANGE.start + 5;

    const result = await handlePortAllocate(ports({ free }));

    expect(result).toEqual({ ok: true, value: TWIN_PORT_RANGE.start + 5 });
  });

  it('fails honestly when the range is exhausted rather than returning an unusable port', async () => {
    const result = await handlePortAllocate(ports({ free: () => false }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('run out of free connections');
      // Contract 2 rule 1: no port numbers or jargon on the primary path.
      expect(result.error.message).not.toContain(String(TWIN_PORT_RANGE.start));
      expect(result.error.technicalDetail).toContain(String(TWIN_PORT_RANGE.start));
    }
  });
});
