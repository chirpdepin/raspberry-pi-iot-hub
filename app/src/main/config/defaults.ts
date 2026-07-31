/**
 * Runtime constants — Contract 4's single source of truth for numbers.
 *
 * Every value here is named and carries the reason it has that value. An inline
 * `5000` in a use case is a number nobody can safely change later because nobody
 * knows what it was protecting.
 */

export const WINDOW = {
  /**
   * Opening size on a desktop. Comfortable for the camera wizard, which is the
   * widest screen in the app.
   */
  defaultWidth: 1280,
  defaultHeight: 800,

  /**
   * Hard floor. 1024×600 is the common Raspberry Pi touchscreen, and Contract 3
   * requires the UI to work there because Ubuntu Core's Ubuntu Frame runs
   * fullscreen at whatever the panel is.
   */
  minWidth: 1024,
  minHeight: 600,
} as const;

export const TIMEOUTS = {
  /** Docker daemon probe. Long enough for a cold Docker Desktop start. */
  dockerProbeMs: 5_000,
  /** How often the dashboard refreshes host state while visible. */
  hostPollMs: 10_000,
} as const;

/**
 * Where the renderer is served from in development. electron-vite injects this;
 * declared here so nothing has to guess at a port number.
 */
export const DEV_SERVER_ENV = 'ELECTRON_RENDERER_URL' as const;
