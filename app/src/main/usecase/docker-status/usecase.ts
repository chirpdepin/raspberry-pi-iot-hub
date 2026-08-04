import type { DockerStatusPorts, DockerStatusResult } from './contract';

/**
 * Reports the container runtime state and the single next action for it.
 *
 * Contract 2 rule 4: exactly one primary action per state, and the states are
 * kept apart because the action differs. Collapsing "not installed" and
 * "installed but not running" sends people to reinstall software they already
 * have — which is what the app did before this existed.
 *
 * Contract 2 rule 1: each message says what the user gets, not what the software
 * is called internally.
 */

const MESSAGE = {
  missing: 'Cameras need Docker, which is not installed on this computer yet.',
  stopped: 'Docker is installed but not running.',
  needsPermission: 'Docker is installed, but this account is not allowed to use it yet.',
  unknown: "Couldn't tell whether Docker is working on this computer.",
} as const;

const ACTION = {
  install: 'Install Docker',
  start: 'Start Docker',
  fix: 'Fix permissions',
  retry: 'Check again',
} as const;

export const handleDockerStatus = async (ports: DockerStatusPorts): Promise<DockerStatusResult> => {
  const status = await ports.runtime.status();

  switch (status.state) {
    case 'ready':
      return { status };

    case 'stopped':
      return { status, message: MESSAGE.stopped, action: ACTION.start };

    case 'needs-permission':
      return { status, message: MESSAGE.needsPermission, action: ACTION.fix };

    // An unrecognised failure offers a retry rather than an install: telling
    // someone to install what they already have is worse than admitting we
    // could not tell.
    case 'unknown':
      return { status, message: MESSAGE.unknown, action: ACTION.retry };

    default:
      return { status, message: MESSAGE.missing, action: ACTION.install };
  }
};
