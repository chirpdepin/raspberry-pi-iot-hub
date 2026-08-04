import { twinIdFor, type Camera, type DiscoveredCamera } from './camera';

/**
 * A camera the user asked for that could not be finished immediately.
 *
 * It exists for one situation: the user clicked `[Add camera]`, Docker was not
 * installed, and finishing the job requires something outside our control — an
 * installer, possibly a reboot. Holding the request on disk is what lets the app
 * pick it up afterwards instead of the user discovering that nothing happened.
 *
 * **Versioned** because it is read by a future build of the app: the machine may
 * restart into an upgraded version, and an unreadable job must be discarded
 * safely rather than crashing the startup path.
 */
export const PENDING_JOB_VERSION = 1;

export type PendingJobState =
  /** Installer launched; waiting for Docker to become usable. */
  | 'awaiting-runtime'
  /** Docker is usable and the Twin is being created. */
  | 'finishing'
  /** Twin created. Held until the renderer has shown the credentials. */
  | 'done'
  /** Gave up or failed. Held so the user can retry rather than re-ask. */
  | 'failed';

export interface PendingJob {
  version: number;
  /**
   * Stable across restarts, so logs and the renderer can talk about the same
   * job — and the seed the Twin id is derived from.
   */
  id: string;
  /** The discovered camera, or null for a blank add. */
  camera: DiscoveredCamera | null;
  state: PendingJobState;
  createdAt: number;
  updatedAt: number;
  /** Present once state is `done`, so the renderer can show first-login details. */
  result?: Camera;
  /** Present once state is `failed`. English text used as an i18n key. */
  error?: string;
}

/**
 * The Twin id this job will create, derived rather than stored.
 *
 * **One source of truth on purpose.** This was briefly a field on the job as
 * well as something `camera-add` derived from the same seed, and two values that
 * must agree are two values that can disagree: a job whose stored id did not
 * match the derived one looked for the wrong container, failed to find it, and
 * then failed to create it because the real one was in the way. Deriving it in
 * both places removes the possibility.
 *
 * Stable because `job.id` is: the same job always yields the same camera, which
 * is what makes resuming safe to repeat.
 */
export const cameraIdForJob = (job: Pick<PendingJob, 'id' | 'camera'>, prefix: string): string =>
  twinIdFor(prefix, job.camera?.address ?? job.id);
