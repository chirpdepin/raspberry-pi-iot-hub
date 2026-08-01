/**
 * Measured camera capacity by hardware class.
 *
 * Contract 4 and Contract 1 (O): the capacity model is DATA, not thresholds
 * buried in a React component. Re-measuring changes this file and nothing else.
 *
 * STATUS: these figures are PROVISIONAL. The only published numbers are the
 * Twin's Kubernetes manifests (requests 100m/128Mi, limits 1000m/512Mi), and
 * those predate the cgo ffmpeg motion-detection path — each Twin does real
 * libavcodec decoding and can spawn a separate go2rtc subprocess, so the 100m
 * request is almost certainly not what a working camera costs.
 *
 * The benchmark that replaces them (scripts/benchmark-twins.sh) needs the
 * published Twin image, which is blocked on lens-twin CI. Until then the app
 * treats these as advisory and says so.
 */

export interface CapacityProfile {
  /** Matched against the host's model string, case-insensitively. */
  match: string[];
  /** Cameras this hardware handles comfortably with motion detection on. */
  recommended: number;
  /** Beyond this, dropped frames are likely. */
  maximum: number;
  /** True once measured on real hardware rather than estimated. */
  measured: boolean;
}

export const CAPACITY_PROFILES: readonly CapacityProfile[] = [
  { match: ['raspberry pi 4'], recommended: 4, maximum: 6, measured: false },
  { match: ['raspberry pi 5'], recommended: 8, maximum: 12, measured: false },
  { match: ['raspberry pi 3'], recommended: 1, maximum: 2, measured: false },
] as const;

/**
 * Per-camera cost used when no profile matches — a desktop or server.
 *
 * Derived from CPU cores and memory rather than a fixed number, because a
 * workstation's capacity has nothing to do with a Pi's.
 */
export const DESKTOP_HEURISTIC = {
  /** Roughly one camera per core, leaving headroom for the OS. */
  camerasPerCore: 1,
  /** And per GB of RAM, whichever is lower. */
  camerasPerGb: 0.5,
  reservedCores: 2,
  reservedGb: 4,
} as const;
