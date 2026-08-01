import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

/**
 * Whether a systemd unit is running.
 *
 * Reading state is **not** privileged — `systemctl is-active` works as any
 * user — so this deliberately does not go through `PrivilegedRunnerPort`.
 * Routing it there would put a pkexec password prompt in front of a dashboard
 * refresh, which is both wrong and unusable.
 *
 * Starting a unit is privileged and stays on the privileged port. The asymmetry
 * is the point: ask freely, act with permission.
 */
export const createServiceState = (platform: NodeJS.Platform) => ({
  async isActive(name: string): Promise<boolean> {
    // systemd only. Windows and macOS run their services through Docker
    // Desktop, and there is no unit to ask about.
    if (platform !== 'linux') return false;

    try {
      const { stdout } = await run('systemctl', ['is-active', name]);
      return stdout.trim() === 'active';
    } catch (error) {
      // `is-active` exits non-zero for inactive AND for unknown units, and
      // execFile turns both into a throw. Inactive and not-installed are the
      // same answer to this question, so both are false — but a unit that
      // exists and failed prints "failed", which is worth distinguishing for
      // the caller that wants it.
      const stdout = (error as { stdout?: string }).stdout ?? '';
      return stdout.trim() === 'active';
    }
  },

  /**
   * The raw sub-state, for a probe that needs to tell "never started" from
   * "started and died" — those get different messages and different advice.
   */
  async state(name: string): Promise<'active' | 'failed' | 'inactive' | 'unknown'> {
    if (platform !== 'linux') return 'unknown';

    const read = async (): Promise<string> => {
      try {
        const { stdout } = await run('systemctl', ['is-active', name]);
        return stdout.trim();
      } catch (error) {
        return ((error as { stdout?: string }).stdout ?? '').trim();
      }
    };

    const value = await read();

    if (value === 'active' || value === 'failed' || value === 'inactive') return value;
    return 'unknown';
  },
});

export type ServiceStatePort = ReturnType<typeof createServiceState>;
