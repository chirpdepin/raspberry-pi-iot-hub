import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { DOCKER_TIMEOUTS } from '../../config/docker';
import { domainError, err, ok, type Result } from '../../domain/errors';

const run = promisify(execFile);

const ELEVATOR = 'pkexec';

/**
 * Runs one command as root.
 *
 * **Separate from `PrivilegedRunnerPort` on purpose.** That port offers exactly
 * two verbs — write this file, start this service — which is what makes it
 * reviewable. Adding a general `run(command, args)` to it would turn a narrow,
 * auditable capability into "run anything as root", and every existing consumer
 * would inherit that reach.
 *
 * This exists for one caller (installing Docker Engine) and says so.
 *
 * Contract 3 rule 2: on Ubuntu Core this becomes a snap interface rather than
 * pkexec, and the use case does not notice.
 */
export interface ElevatedCommandPort {
  run(command: string, args: string[]): Promise<Result<void>>;
}

export const createElevatedCommand = (): ElevatedCommandPort => ({
  async run(command: string, args: string[]): Promise<Result<void>> {
    try {
      await run(ELEVATOR, [command, ...args], { timeout: DOCKER_TIMEOUTS.installMs });
      return ok(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      // pkexec exits 126 when the user dismisses the authentication dialog.
      // That is a decision, not a fault, and must not read as a crash.
      if (/126|dismissed|not authorized/i.test(message)) {
        return err(domainError('permission-denied', 'Permission was not granted, so nothing was changed.', message));
      }

      return err(domainError('unknown', "Couldn't complete the installation.", message));
    }
  },
});
