import type { CameraAvailability, CameraAvailabilityPorts } from './contract';

/**
 * Answers whether setting a camera up can succeed, **before** the user tries.
 *
 * The blocker is known up front — the Twin image has not been published — and it
 * is not discoverable by trying: it fails partway through, after the user has
 * committed to a camera. Moving that answer to the start costs them nothing.
 *
 * Contract 2 rule 2: a cause, in words the user can act on. The version of this
 * that says "an error occurred" would be worse than saying nothing.
 *
 * Scanning is deliberately *not* gated on this. Finding your cameras is useful
 * on its own — it confirms they are on the network and reachable — and blocking
 * it would make a blocked flow look like a broken app.
 */
export const handleCameraAvailability = async (
  ports: CameraAvailabilityPorts
): Promise<CameraAvailability> => {
  if (await ports.blockers.isImageAvailable()) return { canAdd: true };

  return {
    canAdd: false,
    reason: 'Setting up a camera is not available yet. You can still scan to check your cameras are reachable.',
    technicalDetail: 'the camera software has not been published yet',
  };
};
