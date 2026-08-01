/**
 * Renderer constants — Contract 4's single source of truth for numbers in the UI.
 *
 * Every value is named and carries the reason it has that value. An inline
 * `10000` in a hook is a number nobody can safely change later, because nobody
 * knows what it was protecting.
 */

export const POLL = {
  /**
   * Hardware inventory. A user plugs a dongle in and expects the app to notice
   * within a few seconds; faster than this just spins the CPU re-reading files.
   */
  hostMs: 10_000,

  /**
   * Docker state. Polled a little slower than hardware because starting Docker
   * Desktop takes tens of seconds anyway.
   */
  dockerMs: 15_000,

  /**
   * Paired Zigbee devices. Faster than the hardware inventory because devices
   * appear live during a join window and the user is watching for them.
   */
  zigbeeDevicesMs: 3_000,
} as const;

/** How long the Zigbee network stays open for new devices, in seconds. */
export const JOIN_WINDOW_SECONDS = 60;

/** Layout values used by more than one screen. */
export const LAYOUT = {
  /** Body gap on every page, matching the chirp page-layout convention. */
  pageGap: '24px',
  /** Dashboard card grid gap. */
  cardGap: '16px',
  /** Minimum card width before the grid wraps — keeps 1024px to two columns. */
  cardMinWidth: '320px',
} as const;
