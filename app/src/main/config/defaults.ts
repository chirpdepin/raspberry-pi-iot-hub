/**
 * Runtime constants — Contract 4's single source of truth for numbers.
 *
 * Every value here is named and carries the reason it has that value. An inline
 * `5000` in a use case is a number nobody can safely change later because nobody
 * knows what it was protecting.
 */

/**
 * The Twin's own HTTP API, which the hub calls rather than reimplementing.
 *
 * Discovery logic lives in the Twin (`twin/machinery/src/onvif/discovery.go`).
 * Calling its API keeps exactly one ONVIF implementation in the product, and
 * keeps the hub's wizard as the only interface the user sees.
 */
/**
 * ONVIF WS-Discovery, run by this app.
 *
 * Discovery is the one camera concern the app keeps, and only to answer "what
 * is my camera's address" — everything else belongs to the Twin, which has its
 * own scan, credential verification and PTZ behind its UI.
 *
 * Both a multicast probe and a unicast sweep are sent: multicast is the
 * textbook method and finds nothing on many real networks (measured as zero
 * responders here, from the host and outside any container), while a unicast
 * probe to the same camera answers instantly.
 */
export const ONVIF = {
  /** The WS-Discovery group and port, fixed by the specification. */
  multicastAddress: '239.255.255.250',
  port: 3702,
  /** One hop past the local segment; discovery is not meant to leave the LAN. */
  multicastTtl: 2,
  /**
   * How long to keep listening **after the last probe has left the socket**.
   *
   * Measured, not guessed: a /24 sweep does not finish in milliseconds. Node
   * serializes sends on one UDP socket and every probe to an address with no
   * ARP entry waits on neighbour resolution, so 255 probes took past four
   * seconds here. Timing this window from the *start* of the sweep is a race
   * whose outcome depends on subnet size and ARP latency — it sent 194 of 255
   * probes, cancelled the rest, and missed the one camera on the network
   * because it sat at index 204.
   */
  replyWindowMs: 4_000,
  /**
   * Hard ceiling on a whole scan, sends included, so a network that resolves
   * neighbours pathologically slowly ends the scan rather than hanging the
   * screen that is waiting on it.
   */
  maxScanMs: 25_000,
  /**
   * Largest subnet worth sweeping, in hosts. A /24 is 254 probes; a /16 would
   * be 65k and is a denial of service against our own machine rather than a
   * scan.
   */
  maxSweepHosts: 1024,
} as const;

export const TWIN_API = {
  /** ONVIF WS-Discovery, as exposed by the Twin. */
  discoverPath: '/api/camera/onvif/discovery',
  /** The Twin listens on 80 inside its container; the host port is allocated. */
  containerPort: 80,
  /**
   * A discovery run is multicast with a fixed listen window, so it takes
   * seconds even when it succeeds. Generous enough not to cut a slow network
   * short, short enough that a wedged Twin does not hang the wizard.
   */
  discoverTimeoutMs: 30_000,
} as const;

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
