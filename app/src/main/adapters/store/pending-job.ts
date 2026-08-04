import Store from 'electron-store';

import { PENDING_JOB_VERSION, type PendingJob } from '../../domain/pending-job';
import type { PendingJobPort } from '../../usecase/camera-add-resume/contract';

/**
 * The one camera request that is waiting on something outside the app.
 *
 * On disk rather than in memory because the thing it waits for can outlive the
 * process: a Docker Desktop install on Windows usually wants a restart, and an
 * in-memory request would simply vanish — the user would come back to an app
 * that had forgotten what they asked for.
 *
 * At most one at a time. The flow that creates these is a single click that
 * blocks on an installer, so a queue would be machinery for a case that cannot
 * happen, and "which of my three pending cameras is this?" is not a question
 * worth making anyone answer.
 *
 * Nothing secret is kept here: the first-login password lands in `result` only
 * once the camera exists, and the camera store owns it encrypted from then on.
 */
interface PendingJobSchema {
  job: PendingJob | null;
}

export const createPendingJobStore = (): PendingJobPort => {
  const store = new Store<PendingJobSchema>({ name: 'pending-job', defaults: { job: null } });

  return {
    async read(): Promise<PendingJob | null> {
      const job = store.get('job');
      if (!job) return null;

      // A record written by a different build, or corrupted on disk, must not
      // reach the resume logic. Discarding is safe; acting on a half-understood
      // job is not.
      if (typeof job !== 'object' || job.version !== PENDING_JOB_VERSION || typeof job.id !== 'string') {
        store.set('job', null);
        return null;
      }

      return job;
    },

    async write(job: PendingJob): Promise<void> {
      store.set('job', job);
    },

    async clear(): Promise<void> {
      store.set('job', null);
    },
  };
};
