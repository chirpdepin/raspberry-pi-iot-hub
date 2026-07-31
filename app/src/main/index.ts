import { app, shell, BrowserWindow } from 'electron';
import { join } from 'node:path';

import { createDockerRuntime } from './adapters/container/docker-runtime';
import { createHostInfo } from './adapters/discovery/host-info';
import { createRadioDiscovery } from './adapters/discovery/radio-discovery';
import { createPaths } from './adapters/paths/paths';
import { DEV_SERVER_ENV, WINDOW } from './config/defaults';
import { registerIpcHandlers } from './ipc/register';

/**
 * Composition root.
 *
 * Contract 1 (D): the ONLY file allowed to name concrete implementations. Every
 * use case receives ports; this is where those ports are given bodies. Swapping
 * Docker for Podman, or Linux paths for Ubuntu Core's $SNAP_DATA, is a change to
 * these few lines and nothing else.
 */

const buildDependencies = () => {
  const paths = createPaths(process.platform);

  const containerRuntime = createDockerRuntime({
    platform: process.platform,
    openExternal: async (url) => shell.openExternal(url),
  });

  return {
    hostCapabilities: {
      hostInfo: createHostInfo(),
      radios: createRadioDiscovery(paths),
      // host-capabilities wants a plain boolean pair; docker-ensure wants the
      // three-state view. Same adapter, adapted at the seam rather than widening
      // either port to satisfy both (Contract 1 I).
      containerRuntime: {
        async status() {
          const status = await containerRuntime.status();
          return {
            installed: status.state !== 'missing',
            running: status.state === 'ready',
            version: status.version,
          };
        },
      },
    },
    docker: { runtime: containerRuntime },
  };
};

const createWindow = (): BrowserWindow => {
  const window = new BrowserWindow({
    width: WINDOW.defaultWidth,
    height: WINDOW.defaultHeight,
    minWidth: WINDOW.minWidth,
    minHeight: WINDOW.minHeight,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      // Contract 1 and 3: the renderer gets no Node, ever. Asserted in the
      // smoke test, not merely set here.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Shown only once painted, so the user never sees an empty white frame.
  window.on('ready-to-show', () => window.show());

  // Contract 2 rule 6: external links open in the user's own browser rather
  // than trapping them in a chrome-less window they cannot navigate.
  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  const devServerUrl = process.env[DEV_SERVER_ENV];
  if (devServerUrl) {
    void window.loadURL(devServerUrl);
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return window;
};

void app.whenReady().then(() => {
  registerIpcHandlers(buildDependencies());
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
