import { describe, expect, it, vi } from 'vitest';

import { domainError, err, ok } from '../../domain/errors';

import type { CameraOpenPorts } from './contract';
import { handleCameraOpen } from './usecase';

const ports = (hostPort: number | null) => {
  const open = vi.fn(async () => ok(undefined));

  const value: CameraOpenPorts & { open: typeof open } = {
    external: { open },
    location: { hostPort: async () => hostPort },
    open,
  };

  return value;
};

describe('camera-open', () => {
  it('opens the camera on loopback at its own port', async () => {
    const p = ports(18_081);

    const result = await handleCameraOpen(p, 'twin-abc');

    expect(result.ok).toBe(true);
    expect(p.open).toHaveBeenCalledWith('http://127.0.0.1:18081');
  });

  /**
   * The Twin's UI is not exposed to the network. Anything other than loopback
   * here would be reachable from the LAN.
   */
  it('never builds a non-loopback address', async () => {
    const p = ports(18_081);
    await handleCameraOpen(p, 'twin-abc');

    expect(p.open).toHaveBeenCalledWith(expect.stringMatching(/^http:\/\/127\.0\.0\.1:/));
  });

  it('explains a camera that is not running rather than opening a broken tab', async () => {
    const p = ports(null);

    const result = await handleCameraOpen(p, 'twin-abc');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("isn't running");
      // Contract 2 rule 1: no jargon on the primary path.
      expect(result.error.message).not.toContain('port');
      expect(result.error.technicalDetail).toContain('twin-abc');
    }
    expect(p.open).not.toHaveBeenCalled();
  });

  it('passes a failure to open the browser straight through', async () => {
    const p = ports(18_081);
    p.open.mockResolvedValueOnce(err(domainError('unknown', 'No browser is available.')));

    const result = await handleCameraOpen(p, 'twin-abc');

    expect(result.ok).toBe(false);
  });

  it('reports the address it opened, so the UI can prove it happened', async () => {
    // The browser opens a tab but cannot raise its own window on Wayland, so
    // without this the click is indistinguishable from a dead button.
    const result = await handleCameraOpen(ports(18081), 'twin-abc');

    expect(result.ok && result.value).toBe('http://127.0.0.1:18081');
  });
});
