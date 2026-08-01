import { describe, expect, it, vi } from 'vitest';

import { domainError, err, ok } from '../../domain/errors';

import type { CameraRemovePorts } from './contract';
import { handleCameraRemove } from './usecase';

const ports = (removeFails = false) => {
  const remove = vi.fn(async () => (removeFails ? err(domainError('unknown', 'busy')) : ok(undefined)));
  const purgeData = vi.fn(async () => ok(undefined));

  const value: CameraRemovePorts & { remove: typeof remove; purgeData: typeof purgeData } = {
    containers: { remove, purgeData },
    remove,
    purgeData,
  };

  return value;
};

describe('camera-remove', () => {
  it('keeps recordings by default', async () => {
    const p = ports();
    await handleCameraRemove(p, 'twin-abc');

    // Removing a container is reversible in a minute; deleting recordings is
    // not, and someone removing a camera is usually reorganising.
    expect(p.remove).toHaveBeenCalledWith('twin-abc');
    expect(p.purgeData).not.toHaveBeenCalled();
  });

  it('deletes recordings only when explicitly asked', async () => {
    const p = ports();
    await handleCameraRemove(p, 'twin-abc', { keepRecordings: false });

    expect(p.purgeData).toHaveBeenCalledWith('twin-abc');
  });

  it('does not delete recordings when the container could not be removed', async () => {
    const p = ports(true);
    const result = await handleCameraRemove(p, 'twin-abc', { keepRecordings: false });

    // Otherwise a half-removed camera loses its footage while still running.
    expect(result.ok).toBe(false);
    expect(p.purgeData).not.toHaveBeenCalled();
  });
});
