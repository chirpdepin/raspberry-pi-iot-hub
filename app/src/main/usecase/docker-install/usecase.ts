import type { Result } from '../../domain/errors';

import type { DockerInstallPorts } from './contract';

/**
 * Gets Docker onto this machine.
 *
 * Contract 1 (S): one operation. Deciding *whether* Docker is needed belongs to
 * `docker-status`, waiting for it to arrive belongs to `docker-await`, and
 * finishing the camera belongs to `camera-add-resume`. This only starts an
 * install.
 *
 * Two routes, chosen by what the machine can actually do rather than by
 * platform name:
 *
 * - **Automated** where the distribution is one we have tested (the hub image).
 *   The user never leaves the app, which matters most on the Pi — its "installer
 *   URL" is a documentation page, a dead end for someone who has never opened a
 *   terminal.
 * - **Guided** everywhere else, so the user sees and accepts Docker's own
 *   licence terms.
 */
export const handleDockerInstall = async (ports: DockerInstallPorts): Promise<Result<void>> => {
  if (await ports.installer.canInstallAutomatically()) {
    return ports.installer.installEngine();
  }

  return ports.installer.openInstaller();
};
