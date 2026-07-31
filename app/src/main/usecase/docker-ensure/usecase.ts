import type { DockerEnsurePorts, DockerEnsureResult } from './contract';

/**
 * Reports the container runtime state and the single next action for it.
 *
 * Contract 2 rule 4: exactly one primary action per state. "Installed but not
 * running" and "not installed" are different screens — collapsing them sends
 * people to reinstall software they already have.
 *
 * Contract 2 rule 1: the message says what the user gets ("Camera recording
 * needs Docker"), not what the software is.
 */

const MESSAGE = {
  missing: 'Camera recording needs Docker.',
  stopped: 'Docker is installed but not running.',
} as const;

const ACTION = {
  install: 'Install Docker',
  start: 'Start Docker',
} as const;

export const handleDockerEnsure = async (ports: DockerEnsurePorts): Promise<DockerEnsureResult> => {
  const status = await ports.runtime.status();

  if (status.state === 'ready') {
    return { status };
  }

  if (status.state === 'stopped') {
    return { status, message: MESSAGE.stopped, action: ACTION.start };
  }

  return { status, message: MESSAGE.missing, action: ACTION.install };
};

/**
 * Separate operation, separate export (Contract 1 S): checking the runtime and
 * launching an installer fail for different reasons and the UI calls them at
 * different moments.
 */
export const handleDockerInstall = async (ports: DockerEnsurePorts) => ports.runtime.openInstaller();
