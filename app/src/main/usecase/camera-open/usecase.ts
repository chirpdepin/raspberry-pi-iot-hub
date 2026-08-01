import { domainError, err, type Result } from '../../domain/errors';

import type { CameraOpenPorts } from './contract';

/**
 * Opens a camera's own interface in the user's browser.
 *
 * The Twin serves a full web UI on its mapped port — live view, recordings,
 * every setting this wizard deliberately does not expose. Sending people there
 * for the deep end costs nothing and avoids rebuilding it, which is why
 * `[Open camera]` was in the design from the start.
 *
 * **The system browser, not an embedded view.** A chrome-less Electron window
 * has no address bar and no back button, so a user who followed a link inside it
 * would have no way out (Contract 2 rule 6). Their own browser has both.
 *
 * Contract 2 rule 1: to the user this is "open camera". The Twin, its container
 * and its port are not mentioned.
 */
export const handleCameraOpen = async (ports: CameraOpenPorts, id: string): Promise<Result<void>> => {
  const port = await ports.location.hostPort(id);

  if (port === null) {
    // A camera with no port is one that was never set up, or whose container is
    // gone. Either way there is nothing to open, and saying so beats a browser
    // tab showing a connection error.
    return err(
      domainError('unknown', "This camera isn't running, so there's nothing to open yet.", `no host port for ${id}`)
    );
  }

  // Loopback, always: the Twin's UI is not exposed to the network, and building
  // this URL from anything the renderer supplied would make it something a bug
  // could point elsewhere.
  return ports.external.open(`http://127.0.0.1:${port}`);
};
