/**
 * How to find and install Docker — Contract 4's single source of truth.
 *
 * Contract 1 (O): every platform difference is a **table entry**, so supporting
 * a new platform or a new install location is a data change. No `if (platform
 * === 'win32')` belongs in a use case or an adapter's logic.
 */

/**
 * Where Docker's CLI ends up when the installer does not reach our PATH.
 *
 * This exists because of a specific failure: Electron inherits its PATH at
 * launch, so a Docker installed *while the app is running* is invisible to
 * `docker …` until the app restarts. On Windows in particular the installer
 * edits the system PATH, which the running process never re-reads — the app
 * would poll forever while Docker sat there working perfectly.
 */
export const DOCKER_BINARY_PATHS: Record<string, readonly string[]> = {
  linux: ['/usr/bin/docker', '/usr/local/bin/docker', '/snap/bin/docker'],
  // Both Apple silicon and Intel: Docker Desktop uses the same CLI location,
  // and Homebrew's differs by architecture.
  darwin: ['/usr/local/bin/docker', '/opt/homebrew/bin/docker', '/Applications/Docker.app/Contents/Resources/bin/docker'],
  win32: [
    'C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe',
    'C:\\ProgramData\\DockerDesktop\\version-bin\\docker.exe',
  ],
};

/**
 * The official installer, per platform **and architecture**.
 *
 * Architecture matters: we package macOS builds for arm64 and x64, and the
 * previous single arm64 URL handed an Intel Mac a disk image it cannot run.
 */
export const DOCKER_INSTALLER_URL: Record<string, Record<string, string>> = {
  darwin: {
    arm64: 'https://desktop.docker.com/mac/main/arm64/Docker.dmg',
    x64: 'https://desktop.docker.com/mac/main/amd64/Docker.dmg',
  },
  win32: {
    x64: 'https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe',
    arm64: 'https://desktop.docker.com/win/main/arm64/Docker%20Desktop%20Installer.exe',
  },
};

/**
 * Distributions where we install Docker Engine ourselves.
 *
 * Deliberately a short allow-list rather than "linux". `linux` spans dozens of
 * distributions and package managers, and guessing wrong means running a
 * privileged command that does something unintended on a user's machine. The
 * hub image is Ubuntu/Debian; anything else gets guided instructions instead of
 * an automated install that might not fit.
 *
 * Matched against the `ID` and `ID_LIKE` fields of /etc/os-release.
 */
export const AUTOMATED_INSTALL_DISTROS: readonly string[] = ['ubuntu', 'debian', 'raspbian'];

/**
 * The official convenience script. Apache-2.0 Docker Engine, not Docker Desktop,
 * so there is no subscription question on Linux the way there is on macOS and
 * Windows.
 */
export const DOCKER_INSTALL_SCRIPT_URL = 'https://get.docker.com';

export const DOCKER_TIMEOUTS = {
  /** A single probe. Long enough for a cold daemon, short enough to poll. */
  probeMs: 5_000,
  /** Gap between readiness polls while an install is in progress. */
  pollIntervalMs: 3_000,
  /**
   * When to stop polling on our own.
   *
   * Reaching this does **not** discard the job — a slow installer must not make
   * the app forget the request moments before Docker appears. It stops the
   * polling and offers to check again.
   */
  pollGiveUpMs: 15 * 60 * 1_000,
  /** An install command can be slow on a Pi over a slow link. */
  installMs: 10 * 60 * 1_000,
} as const;
