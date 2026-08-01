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
  /** Gap between the page title row and its subtitle, matching Alarm's mb. */
  headerTitleGap: '4px',
  /** Gap between page actions when a screen has more than one. Alarm uses 12px. */
  headerActionGap: '12px',
  /**
   * The spacing scale, named by size.
   *
   * These are the values that were scattered as literals across a dozen
   * components until `no-raw-spacing` found them. Named rather than numbered so
   * a call site reads as intent, and changing one changes every use.
   */
  gapXs: '2px',
  gapSm: '4px',
  gapMd: '6px',
  gapLg: '8px',
  gapXl: '12px',
  gapXxl: '16px',

  /** Dashboard card grid gap. */
  cardGap: '16px',
  /** Minimum card width before the grid wraps — keeps 1024px to two columns. */
  cardMinWidth: '320px',

  /**
   * Sidebar row metrics, copied from chirp's styled link
   * (`chirp-frontend/src/app/Sidebar/style.ts` — the `Link` export).
   *
   * These are what make a row a row. Without them the link box collapses to the
   * text's line height: rows measured 20px against chirp's ~44px, and because
   * the selected highlight is drawn on this same box, it collapsed with them
   * into a thin band. Both complaints, one cause.
   */
  sidebarRowMinHeight: '32px',
  sidebarRowPadding: '6px',
  sidebarRowRadius: '4px',

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
  /** A narrow form column — the wizard's credential and name steps. */
  narrowFormMaxWidth: '420px',
  /** The gateway setup form and its progress list. */
  setupFormMaxWidth: '480px',
  /** Corner radius on inline media and progress bars. */
  radiusSm: '3px',
  radiusMd: '8px',
  /** Empty-state icon, matching chirp's 56x56 Chirp mark. */
  emptyIconSize: 56,
  /** Empty-state block height, so a mostly-empty page still has weight. */
  emptyMinHeight: '400px',
  /** Chirp drops the empty block down on a narrow screen; on lg it centres. */
  emptyTopMarginMobile: '40px',
  /** Gap between the description and the action, wider on a desktop. */
  emptyActionGap: '32px',
} as const;
