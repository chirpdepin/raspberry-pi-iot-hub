import { execFile } from 'node:child_process';
import { mkdtemp, writeFile as writeTempFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { domainError, err, ok, type Result } from '../../domain/errors';
import type { PrivilegedRunnerPort } from '../../usecase/gateway-provision/contract';

const run = promisify(execFile);

/**
 * Privileged operations.
 *
 * Contract 3 rule 2: every privileged action goes through this port. On Ubuntu
 * Core it becomes a snap interface connection instead of pkexec, and no use
 * case changes.
 *
 * The content is staged to a temp file and then moved with a single elevated
 * command, so the user sees **one** authentication prompt for the whole
 * operation rather than one per file — four prompts in a row reads as the app
 * malfunctioning.
 */

const ELEVATOR = 'pkexec';

export const createPrivilegedRunner = (): PrivilegedRunnerPort => ({
  async writeFile(path: string, content: string, mode = 0o640): Promise<Result<void>> {
    let staging: string | null = null;

    try {
      const dir = await mkdtemp(join(tmpdir(), 'chirp-hub-'));
      staging = join(dir, 'payload');
      await writeTempFile(staging, content, { mode: 0o600 });

      // install(1) creates the destination directory, moves the file and sets
      // the mode in one elevated call.
      await run(ELEVATOR, ['install', '-D', '-m', mode.toString(8), staging, path]);

      return ok(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      // pkexec exits 126 when the user dismisses the authentication dialog.
      // That is a choice, not a fault, and must not read as a crash.
      if (/126|dismissed|not authorized/i.test(message)) {
        return err(domainError('permission-denied', 'Permission was not granted, so nothing was changed.', message));
      }

      return err(domainError('unknown', "Couldn't save the settings to this device.", message));
    } finally {
      if (staging) await rm(join(staging, '..'), { recursive: true, force: true }).catch(() => undefined);
    }
  },

  async startService(name: string): Promise<Result<void>> {
    try {
      await run(ELEVATOR, ['systemctl', 'start', name]);
      return ok(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (/126|dismissed|not authorized/i.test(message)) {
        return err(domainError('permission-denied', 'Permission was not granted, so nothing was changed.', message));
      }

      return err(domainError('unknown', "Couldn't start the gateway.", message));
    }
  },
});
