import { describe, expect, it } from 'vitest';

import type { CameraAvailabilityPorts } from './contract';
import { handleCameraAvailability } from './usecase';

const ports = (image: boolean): CameraAvailabilityPorts => ({
  blockers: { isImageAvailable: async () => image },
});

describe('camera-availability', () => {
  it('allows setting up a camera when the software is available', async () => {
    expect(await handleCameraAvailability(ports(true))).toEqual({ canAdd: true });
  });

  /**
   * The state today. It used to fail partway through setup, after the user had
   * committed to a camera — so the answer belongs before they start.
   */
  it('reports the block before the user invests in the flow', async () => {
    const result = await handleCameraAvailability(ports(false));

    expect(result.canAdd).toBe(false);
    expect(result.reason).toContain('not available yet');
  });

  it('still invites a scan, because finding cameras is useful on its own', async () => {
    expect((await handleCameraAvailability(ports(false))).reason).toContain('scan');
  });

  it('names the blocker for someone who can act on it', async () => {
    expect((await handleCameraAvailability(ports(false))).technicalDetail).toBe(
      'the camera software has not been published yet'
    );
  });

  it('keeps jargon out of the message the user reads', async () => {
    const result = await handleCameraAvailability(ports(false));

    for (const word of ['Docker', 'container', 'Twin', 'API', 'registry']) {
      expect(result.reason).not.toContain(word);
    }
  });
});
