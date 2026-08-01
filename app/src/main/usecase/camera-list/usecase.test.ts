import { describe, expect, it } from 'vitest';

import type { Camera } from '../../domain/camera';

import { handleCameraList } from './usecase';
import type { CameraListPorts } from './contract';

const camera = (id: string, online = false): Camera => ({
  id,
  displayName: `Camera ${id}`,
  address: '192.168.2.40',
  hostPort: 18_080,
  recording: 'motion',
  online,
});

const ports = (records: Camera[], running: string[]): CameraListPorts => ({
  records: { all: async () => records, save: async () => undefined, remove: async () => undefined },
  state: { running: async () => running },
});

describe('camera-list', () => {
  it('marks a camera online when its container is running', async () => {
    const result = await handleCameraList(ports([camera('twin-a')], ['twin-a']));

    expect(result[0]?.online).toBe(true);
  });

  /**
   * A stopped camera must stay visible and be marked offline. Filtering it out
   * would make a failure indistinguishable from the user having deleted it.
   */
  it('keeps a stopped camera in the list, marked offline', async () => {
    const result = await handleCameraList(ports([camera('twin-a'), camera('twin-b')], ['twin-a']));

    expect(result).toHaveLength(2);
    expect(result.find((c) => c.id === 'twin-b')?.online).toBe(false);
  });

  it('trusts the runtime over a stale stored flag', async () => {
    // Persisted as online, container gone — after a crash, for instance.
    const result = await handleCameraList(ports([camera('twin-a', true)], []));

    expect(result[0]?.online).toBe(false);
  });

  it('ignores containers with no configured camera behind them', async () => {
    const result = await handleCameraList(ports([camera('twin-a')], ['twin-a', 'twin-orphan']));

    expect(result.map((c) => c.id)).toEqual(['twin-a']);
  });

  it('returns nothing when no camera has been added', async () => {
    expect(await handleCameraList(ports([], []))).toEqual([]);
  });
});
