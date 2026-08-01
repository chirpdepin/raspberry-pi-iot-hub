/**
 * Thresholds for the Dashboard's live load readout.
 *
 * Contract 4: named here rather than inline in a component, so "when does this
 * turn amber" has one answer that can be changed in one place.
 */

export const LOAD_DISPLAY = {
  /**
   * Above this share of the machine's capacity the readout is reported as
   * strained.
   *
   * 80% because load average counts I/O waiting as well as CPU: on the hub,
   * 6 cameras measured 39% and 8 cameras — the point where the board is fully
   * committed — measured 99%. Amber needs to arrive before that, while adding
   * one more camera is still a decision rather than a regret.
   */
  highPercent: 80,

  /**
   * Ceiling for the reported percentage.
   *
   * Load can legitimately exceed capacity (the hub reached 24 on 4 cores while
   * thrashing). The number is clamped so a bar cannot overflow its track, but
   * `strain` is computed from the true value, so a machine at 600% still reads
   * as strained rather than merely full.
   */
  maxReportedPercent: 100,
} as const;
