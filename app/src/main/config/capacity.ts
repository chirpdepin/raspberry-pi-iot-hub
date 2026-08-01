/**
 * Measured camera capacity, by board.
 *
 * Contract 4 and Contract 1 (O): the capacity model is DATA, not thresholds
 * buried in a React component. Re-measuring changes this file and nothing else,
 * and supporting a new board is adding a row — never an `if` on the model name.
 *
 * ## Where these numbers come from
 *
 * Measured on a `Raspberry Pi 4 Model B Rev 1.5` (4 cores, 7796 MiB, **no
 * swap**) running the real Twin image, with `basicstation` and `mosquitto` also
 * running — a hub is not only cameras. Baseline before any camera: **866 MiB
 * used, load 0.80**.
 *
 * Every Twin decoded h264 **2304×1296 @ 15 fps with a 30-frame (2 s) GOP**, real
 * footage recorded off a Tapo C210 and restreamed byte-identically (`-c copy`),
 * with motion detection on and recording on motion.
 *
 * | Cameras | Load (of 4) | RSS/Twin | Verdict |
 * |---|---|---|---|
 * | 6 | 1.57 (39%) | 137.4 MiB | comfortable |
 * | 8 | 3.96 (99%) | 145.6 MiB | at the ceiling |
 * | 10 | 5.09 (127%) | 159.4 MiB | over |
 * | 18 | 24 | — | collapsed |
 *
 * ## Three things that are easy to get wrong here
 *
 * 1. **Motion detection decodes keyframes only** (Twin
 *    `computervision/main.go`: `if ... || !pkt.IsKeyFrame { continue }`). Cost
 *    scales with the camera's **keyframe interval**, not its frame rate. These
 *    figures assume a 2 s GOP; a camera with a 1 s GOP — a common default —
 *    decodes about twice as often and costs proportionally more.
 * 2. **Scene content matters more than camera count.** The same 18 Twins ran at
 *    load 1.75 on a static night scene and load 24 on footage with real
 *    movement. A static scene decodes, finds nothing and stops; motion also
 *    starts a recording, which is the expensive path. Everything here assumes
 *    the busy case, so it is conservative for a typical home.
 * 3. **CPU percentage lies; load average does not.** `docker stats` reported
 *    0.52 cores busy at 6 cameras while load was 1.57 — the gap is processes
 *    blocked on I/O, which CPU% does not count. Sizing on CPU% would have
 *    overstated capacity roughly fourfold.
 */

export const MIB = 1024 ** 2;

export interface BoardCost {
  /** Matched case-insensitively against /proc/device-tree/model. */
  match: string[];
  /**
   * Peak RSS of one Twin near the ceiling, rounded up.
   *
   * Rounded **up** on purpose: the hub image has no swap, so running out of RAM
   * is the OOM killer taking a camera down, not a slowdown to trade against.
   */
  ramMibPerCamera: number;
  /** Measured headroom for the OS, Mosquitto and Basic Station. */
  reservedRamMib: number;
  /** Cameras this board runs comfortably with every camera seeing motion. */
  camerasRecommended: number;
}

export const BOARD_COSTS: readonly BoardCost[] = [
  {
    // Measured directly — see the table above.
    match: ['raspberry pi 4'],
    ramMibPerCamera: 160,
    reservedRamMib: 900,
    // 6 sat at 39% load. The measured ceiling was 8 (99% load); the difference
    // is deliberate headroom for a live viewer and for uploads to Chirp, and
    // for the fact that a real camera's scene is not the worst case forever.
    camerasRecommended: 6,
  },
  {
    // DERIVED, NOT MEASURED. Same 4 cores, but Cortex-A76 @ 2.4 GHz against the
    // Pi 4's A72 @ 1.8 GHz is roughly 2x per core, and the Pi 5's storage I/O is
    // faster — which matters most, because I/O is what binds here. Taken as 2x
    // the Pi 4 figure rather than the ~2.5x some benchmarks suggest.
    // Replace this row with a real measurement when a Pi 5 is on the bench.
    match: ['raspberry pi 5'],
    ramMibPerCamera: 160,
    reservedRamMib: 900,
    camerasRecommended: 12,
  },
  // The Pi 3 is deliberately absent: it was never measured, it is slower than
  // the Pi 4 on every axis that binds here, and a guess would be worse than
  // silence. With no row it matches nothing, so the app shows no figure at all.
  // The Pi 4 is the minimum supported board.
] as const;
