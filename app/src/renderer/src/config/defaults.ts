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

/**
 * Layout values — Contract 4's single source of truth for spacing.
 *
 * These are chirp-frontend's own numbers, taken from its page skeleton
 * (`modules/Connectors/Connectors.tsx`) and sidebar (`app/Sidebar/Sidebar.tsx`).
 * chirp inlines them at each call site; kept here instead, they cannot drift
 * page by page — which is exactly how this app ended up 72px inset where chirp
 * uses 24px.
 */
export const LAYOUT = {
  /** Gap between a page's header block and its body. */
  pageGap: '24px',
  /** Gap between sections inside a page body. chirp uses the theme scale (3 = 24px). */
  bodyGap: 3,
  /** Gap inside the page header block. chirp uses 2 (= 16px). */
  headerGap: 2,
  /** Gap between the page title and its action. chirp passes gap={4} to StackRowJB. */
  headerRowGap: 4,
  /** Dashboard card grid gap. */
  cardGap: '16px',
  /** Minimum card width before the grid wraps — keeps 1024px to two columns. */
  cardMinWidth: '320px',

  /** Sidebar text size, matching chirp's language/theme row. */
  sidebarFontSize: '14px',
  /** Gap between the theme label and its switch. */
  themeToggleGap: '8px',
  /** Horizontal padding on the sidebar's bottom row. */
  sidebarRowPaddingX: '6px',
  /** Room for the select caret so the code is not clipped. */
  selectCaretGap: '20px',
  /** Menu row height in the language dropdown, matching chirp. */
  menuItemHeight: '40px',

  /** Readable line length for a form column, so fields do not stretch. */
  formMaxWidth: '640px',
  /** Empty-state icon, matching chirp's 56x56 Chirp mark. */
  emptyIconSize: 56,
  /** Empty-state block height, so a mostly-empty page still has weight. */
  emptyMinHeight: '400px',
} as const;
