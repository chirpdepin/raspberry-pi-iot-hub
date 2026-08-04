import { describe, expect, it } from 'vitest';

import type { Camera } from '../../domain/camera';
import { PENDING_JOB_VERSION, type PendingJob } from '../../domain/pending-job';

import type { CameraAddResumePorts } from './contract';
import { handleCameraAddResume } from './usecase';

const camera = (id: string): Camera => ({
  id,
  displayName: 'Camera 1',
  address: '',
  hostPort: 18081,
  firstLoginUsername: 'admin',
  firstLoginPassword: 'seeded-once',
  online: true,
});

const job = (overrides: Partial<PendingJob> = {}): PendingJob => ({
  version: PENDING_JOB_VERSION,
  id: 'job-1',
  camera: null,
  state: 'awaiting-runtime',
  createdAt: 0,
  updatedAt: 0,
  ...overrides,
});

const ports = (
  stored: PendingJob | null,
  options: { existing?: Camera | null; addFails?: boolean } = {}
) => {
  const calls: string[] = [];
  let current = stored;

  const value: CameraAddResumePorts & { calls: string[]; stored: () => PendingJob | null } = {
    jobs: {
      read: async () => current,
      write: async (next) => {
        current = next;
      },
      clear: async () => {
        current = null;
      },
    },
    attention: {
      focus: async () => void calls.push('focus'),
      notify: async () => void calls.push('notify'),
    },
    cleanup: { discard: async () => void calls.push('discard') },
    existing: async () => options.existing ?? null,
    addPorts: () => ({}) as never,
    add: async () => {
      calls.push('add');
      return options.addFails
        ? { ok: false, error: { code: 'unknown', message: "Couldn't set up this camera." } }
        : { ok: true, value: camera('twin-abc') };
    },
    now: () => 1,
    calls,
    stored: () => current,
  };

  return value;
};

describe('camera-add-resume', () => {
  it('does nothing when no camera was ever requested', async () => {
    const p = ports(null);

    expect(await handleCameraAddResume(p)).toBeNull();
    expect(p.calls).toEqual([]);
  });

  it('creates the camera and brings the user back', async () => {
    const p = ports(job());
    const result = await handleCameraAddResume(p);

    expect(result?.state).toBe('done');
    // The user was told to come back to the app; the notification is what makes
    // that instruction true rather than hopeful.
    expect(p.calls).toContain('focus');
    expect(p.calls).toContain('notify');
  });

  it('keeps the first-login credentials on the job', async () => {
    // The Twin forces a password change at first login and these are the only
    // way in until then. A resume that ran in the background and dropped them
    // would lock the user out of their own camera.
    const result = await handleCameraAddResume(ports(job()));

    expect(result?.result?.firstLoginPassword).toBe('seeded-once');
  });

  it('does not create a second camera when one already exists', async () => {
    // The reboot case: an earlier attempt got further than its bookkeeping did.
    const p = ports(job(), { existing: camera('twin-abc') });
    const result = await handleCameraAddResume(p);

    expect(result?.state).toBe('done');
    expect(p.calls).not.toContain('add');
  });

  it('discards a half-finished container before retrying', async () => {
    // A container without a record would make the retry fail on a name clash.
    const p = ports(job());
    await handleCameraAddResume(p);

    expect(p.calls.indexOf('discard')).toBeLessThan(p.calls.indexOf('add'));
  });

  it('keeps the request when the attempt fails, so it can be retried', async () => {
    const p = ports(job(), { addFails: true });
    const result = await handleCameraAddResume(p);

    expect(result?.state).toBe('failed');
    // Kept, not cleared: the user asked for this camera and should be offered a
    // retry rather than discovering the request vanished.
    expect(p.stored()).not.toBeNull();
  });

  it('discards a job written by a different version of the app', async () => {
    const p = ports(job({ version: PENDING_JOB_VERSION + 1 }));

    expect(await handleCameraAddResume(p)).toBeNull();
    expect(p.stored()).toBeNull();
  });

  it('returns a finished job untouched so its result can still be shown', async () => {
    const p = ports(job({ state: 'done', result: camera('twin-abc') }));
    const result = await handleCameraAddResume(p);

    expect(result?.state).toBe('done');
    expect(p.calls).not.toContain('add');
  });
});
