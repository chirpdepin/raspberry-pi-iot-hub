import type { Camera } from '../../domain/camera';
import type { PendingJob } from '../../domain/pending-job';
import type { Result } from '../../domain/errors';
import type { CameraAddPorts } from '../camera-add/contract';

/**
 * Ports for finishing a camera the user asked for earlier.
 *
 * Contract 1 (I): narrow, and declared here by the consumer.
 */

export interface PendingJobPort {
  read(): Promise<PendingJob | null>;
  write(job: PendingJob): Promise<void>;
  clear(): Promise<void>;
}

/**
 * Bringing the user back to the app.
 *
 * Its own tiny port rather than a method on something larger: raising a window
 * and posting a notification is a platform capability, and on Ubuntu Core it
 * becomes something else entirely (Contract 3). No use case may touch Electron
 * to do it.
 */
export interface UserAttentionPort {
  /** Raise and focus the app's own window. */
  focus(): Promise<void>;
  /** Post an OS notification. Must degrade silently where unsupported. */
  notify(title: string, body: string): Promise<void>;
}

/**
 * Cleaning up a half-finished attempt.
 *
 * A job can die between creating the container and saving the record — a reboot
 * during install is the obvious way. Recreating over the orphan would fail on a
 * name clash, so the resume discards it first and starts that one camera again.
 */
export interface PartialCleanupPort {
  discard(): Promise<void>;
}

export interface CameraAddResumePorts {
  jobs: PendingJobPort;
  attention: UserAttentionPort;
  cleanup: PartialCleanupPort;
  /** Whether this job's camera already exists, which makes the resume a no-op. */
  existing(): Promise<Camera | null>;
  /**
   * The add itself, already wired with a **deterministic** seed for this job.
   *
   * Passed as a function rather than as ports so the resume cannot accidentally
   * run an add with a fresh random id — which is what would create a second
   * camera for one request.
   */
  add(job: PendingJob, ports: CameraAddPorts): Promise<Result<Camera>>;
  /** The add's own ports, seeded deterministically from the job. */
  addPorts(job: PendingJob): CameraAddPorts;
  now(): number;
}
