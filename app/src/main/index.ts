import { app, shell, BrowserWindow, ipcMain } from 'electron';
import { join } from 'node:path';
import { arch, platform } from 'node:os';

import { IPC, type AppInfo, type DockerStatus, type HostCapabilities } from '../shared/ipc';
import { WINDOW, DEV_SERVER_ENV } from './config/defaults';

/**
 * Composition root.
 *
 * Contract 1 (D): this is the ONLY file allowed to name concrete implementations.
 * From Phase 3 onward it wires adapters into use cases; today it wires the window
 * and three placeholder handlers so the shell has real data to render.
 */

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: WINDOW.defaultWidth,
    height: WINDOW.defaultHeight,
    minWidth: WINDOW.minWidth,
    minHeight: WINDOW.minHeight,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      // Contract 1 and 3: the renderer gets no Node, ever. These three are
      // asserted in the boundary tests, not just set here.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Shown only once painted, so the user never sees an empty white frame.
  window.on('ready-to-show', () => window.show());

  // Contract 2 rule 6: external links open in the user's own browser rather
  // than trapping them in a chrome-less Electron window they cannot navigate.
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
}

/**
 * Phase 2 placeholders. Phase 3 replaces each with a real use case invoked
 * through its ports — the channel names and payload shapes do not change, which
 * is the point of declaring them in shared/ipc.ts first.
 */
function registerHandlers(): void {
  ipcMain.handle(IPC.appInfo, (): AppInfo => ({
    name: app.getName(),
    version: app.getVersion(),
    platform: platform(),
    arch: arch(),
  }));

  ipcMain.handle(IPC.hostCapabilities, (): HostCapabilities => ({
    lorawan: false,
    zigbee: false,
    thread: false,
    cameras: false,
  }));

  ipcMain.handle(IPC.dockerStatus, (): DockerStatus => ({ installed: false, running: false, version: null }));
}

void app.whenReady().then(() => {
  registerHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
