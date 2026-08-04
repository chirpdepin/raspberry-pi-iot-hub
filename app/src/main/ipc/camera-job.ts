import { randomUUID } from 'node:crypto';

import { TWIN_CONTAINER_PREFIX } from '../config/images';
import type { Camera, DiscoveredCamera } from '../domain/camera';
import { PENDING_JOB_VERSION, cameraIdForJob, type PendingJob } from '../domain/pending-job';
import type { CameraAddPorts } from '../usecase/camera-add/contract';
import { handleCameraAdd } from '../usecase/camera-add/usecase';
import type { CameraAddResumePorts } from '../usecase/camera-add-resume/contract';
import { handleCameraAddResume } from '../usecase/camera-add-resume/usecase';
import { handleDockerAwait } from '../usecase/docker-await/usecase';
import type { DockerAwaitPorts } from '../usecase/docker-await/contract';

/**
 * The single owner of the pending camera request.
 *
 * **Why one owner.** The request can be driven from three places — the user
 * clicking in the renderer, the poll finishing while they are away, and the app
 * starting up after a reboot. Two of those running at once would create two
 * Twins for one camera, which is the failure this exists to prevent. Everything
 * goes through here, and only one resume runs at a time.
 *
 * It is not a use case: it sequences them (`docker-await` then
 * `camera-add-resume`) and owns the in-flight state. The use cases stay
 * independently testable with fakes, which is the property that matters.
 */

export interface CameraJobDeps {
  jobs: CameraAddResumePorts['jobs'];
  attention: CameraAddResumePorts['attention'];
  // These take the camera id, which the coordinator derives from the job. The
  // resume itself is handed no-argument versions, so it cannot look up a
  // different camera from the one it is about to create.
  cleanup: { discard(cameraId: string): Promise<void> };
  existing(cameraId: string): Promise<Camera | null>;
  /** Builds the add's ports with a fixed seed, so a resume cannot mint a new id. */
  addPorts(seed: string): CameraAddPorts;
  runtime: DockerAwaitPorts['runtime'];
  wait(ms: number): Promise<void>;
  now(): number;
}

export interface CameraJobCoordinator {
  /** Records the request before the installer opens, and starts watching. */
  begin(camera: DiscoveredCamera | null): Promise<PendingJob>;
  current(): Promise<PendingJob | null>;
  /** The only thing that discards a job besides completion. */
  cancel(): Promise<void>;
  /** Clears a finished job once the UI has shown its result. */
  acknowledge(): Promise<void>;
  /** Picks up an unfinished job at startup. */
  resumeIfPending(): Promise<PendingJob | null>;
}

export const createCameraJobCoordinator = (deps: CameraJobDeps): CameraJobCoordinator => {
  let cancelled = false;
  let running: Promise<PendingJob | null> | null = null;

  const resumePorts = (job: PendingJob): CameraAddResumePorts => ({
    jobs: deps.jobs,
    attention: deps.attention,
    cleanup: { discard: () => deps.cleanup.discard(cameraIdForJob(job, TWIN_CONTAINER_PREFIX)) },
    existing: () => deps.existing(cameraIdForJob(job, TWIN_CONTAINER_PREFIX)),
    now: deps.now,
    // The seed is the job's own id, so `camera-add` derives the same Twin id
    // every time this job runs. That is what makes a resume idempotent.
    addPorts: () => deps.addPorts(job.id),
    add: async (pending, ports) => {
      const result = await handleCameraAdd(ports, pending.camera ?? undefined);
      return result.ok ? { ok: true as const, value: result.value.camera } : result;
    },
  });

  /** Waits for Docker, then finishes the camera. One at a time. */
  const watch = async (job: PendingJob): Promise<PendingJob | null> => {
    const outcome = await handleDockerAwait({
      runtime: deps.runtime,
      wait: deps.wait,
      now: deps.now,
      isCancelled: () => cancelled,
    });

    // Cancelled and gave-up both stop here, and neither discards the job:
    // cancelling is handled by `cancel()`, and giving up deliberately keeps the
    // request so a slow installer does not lose it.
    if (outcome.kind !== 'ready') return deps.jobs.read();

    return handleCameraAddResume(resumePorts(job));
  };

  return {
    async begin(camera: DiscoveredCamera | null): Promise<PendingJob> {
      cancelled = false;

      const job: PendingJob = {
        version: PENDING_JOB_VERSION,
        // The seed the Twin id is derived from, here and in `camera-add`. Fixed
        // now, so a restart mid-flight cannot produce a second camera.
        id: randomUUID(),
        camera,
        state: 'awaiting-runtime',
        createdAt: deps.now(),
        updatedAt: deps.now(),
      };

      // Written before anything else happens: an installer that triggers a
      // reboot must not be able to lose the request.
      await deps.jobs.write(job);

      running = watch(job).finally(() => {
        running = null;
      });

      return job;
    },

    current: () => deps.jobs.read(),

    async cancel(): Promise<void> {
      cancelled = true;
      await deps.jobs.clear();
    },

    async acknowledge(): Promise<void> {
      const job = await deps.jobs.read();
      // Only a finished job is cleared on acknowledgement. Clearing one that is
      // still waiting would silently abandon a camera the user is expecting.
      if (job && (job.state === 'done' || job.state === 'failed')) await deps.jobs.clear();
    },

    async resumeIfPending(): Promise<PendingJob | null> {
      if (running) return deps.jobs.read();

      const job = await deps.jobs.read();
      if (!job || job.state === 'done' || job.state === 'failed') return job;

      cancelled = false;
      running = watch(job).finally(() => {
        running = null;
      });

      return job;
    },
  };
};
