import { app, shell, BrowserWindow } from 'electron';
import { join } from 'node:path';

import { buildDependencies } from './composition';
import { DEV_SERVER_ENV, WINDOW } from './config/defaults';
import { registerIpcHandlers } from './ipc/register';

/**
 * Application entry point.
 *
 * The dependency graph itself lives in composition.ts so it can be built without
 * this file's side effects — that is what lets the smoke test drive the real
 * adapters and use cases instead of stubs.
 */

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
