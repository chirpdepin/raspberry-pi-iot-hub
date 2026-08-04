import { PENDING_JOB_VERSION, type PendingJob } from '../../domain/pending-job';

import type { CameraAddResumePorts } from './contract';

/**
 * Finishes a camera the user asked for before Docker was available.
 *
 * **This is the takeover.** The user clicked `[Add camera]`, went off to
 * Docker's installer, and was told to come back. Everything after that happens
 * here, with no second click.
 *
 * Contract 1 (S): it resumes a job. It does not decide whether Docker is ready
 * (`docker-status`), wait for it (`docker-await`), or know how to create a Twin
 * (`camera-add`).
 *
 * Three properties this has to hold, each learned from a way it could go wrong:
 *
 * - **Idempotent.** The job carries the camera id decided when it was created,
 *   and the add is wired with a deterministic seed, so resuming twice produces
 *   the same camera rather than a second one.
 * - **It reports the result.** The credentials the Twin was seeded with are shown
 *   once and are the only way in until the user sets their own. A resume that
 *   ran in the background and dropped them would lock the user out of their own
 *   camera, so they are written into the job for the UI to read.
 * - **It brings the user back.** They were told to return to the app; a
 *   notification and a raised window are what make that instruction true.
 */
export const handleCameraAddResume = async (ports: CameraAddResumePorts): Promise<PendingJob | null> => {
  const job = await ports.jobs.read();
  if (!job) return null;

  // A job from another version of the app cannot be trusted to mean what this
  // build thinks. Discard rather than risk acting on a half-understood record.
  if (job.version !== PENDING_JOB_VERSION) {
    await ports.jobs.clear();
    return null;
  }

  // Already finished, and simply not yet acknowledged by the UI.
  if (job.state === 'done') return job;

  // The camera exists: an earlier attempt got further than its bookkeeping did.
  const already = await ports.existing();
  if (already) {
    const finished: PendingJob = { ...job, state: 'done', result: already, updatedAt: ports.now() };
    await ports.jobs.write(finished);
    return finished;
  }

  await ports.jobs.write({ ...job, state: 'finishing', updatedAt: ports.now() });

  // A container without a record is a half-finished attempt; recreating over it
  // would fail on the name, so it goes before we try again.
  await ports.cleanup.discard();

  const result = await ports.add(job, ports.addPorts(job));

  if (!result.ok) {
    // Kept, not cleared: the user asked for this camera and should be offered a
    // retry rather than discovering the request vanished.
    const failed: PendingJob = {
      ...job,
      state: 'failed',
      error: result.error.message,
      updatedAt: ports.now(),
    };
    await ports.jobs.write(failed);
    return failed;
  }

  const done: PendingJob = { ...job, state: 'done', result: result.value, updatedAt: ports.now() };
  await ports.jobs.write(done);

  await ports.attention.focus();
  await ports.attention.notify('Docker is ready', 'Finishing your camera setup.');

  return done;
};
