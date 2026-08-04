import { BrowserWindow, Notification } from 'electron';

import type { UserAttentionPort } from '../../usecase/camera-add-resume/contract';

/**
 * Bringing the user back to the app.
 *
 * The install flow tells them: *finish Docker, then come back to Chirp Hub*.
 * This is what makes that instruction true rather than hopeful — the app was
 * behind the installer window, and something has to say when it is worth
 * returning to.
 *
 * Both parts degrade quietly. A notification the OS refuses to show, or a window
 * that has been closed, must not fail the camera the user actually asked for.
 */
export const createUserAttention = (): UserAttentionPort => ({
  async focus(): Promise<void> {
    const [window] = BrowserWindow.getAllWindows();
    if (!window) return;

    // A minimised window cannot take focus, so it is restored first.
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
  },

  async notify(title: string, body: string): Promise<void> {
    // Linux without a notification daemon, and any platform where the user has
    // denied permission, report unsupported rather than throwing.
    if (!Notification.isSupported()) return;

    new Notification({ title, body }).show();
  },
});
