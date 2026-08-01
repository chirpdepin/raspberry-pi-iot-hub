/**
 * Subsystem health.
 *
 * Contract 1: no imports.
 *
 * The three subsystems are independent by design and must be independent in
 * failure too. Unplugging the Zigbee dongle changes the Zigbee page and nothing
 * else; a blocked LNS host stops uplinks and leaves cameras recording. This
 * type is where that guarantee is written down: there is no aggregate "hub is
 * broken" state, because there is no such thing.
 */

export type SubsystemId = 'lorawan' | 'zigbee' | 'cameras';

export type SubsystemState =
  /** Working. */
  | 'running'
  /** Hardware present, not set up yet. This is not a fault. */
  | 'not-configured'
  /** No radio at all — a desktop, or a Pi with nothing plugged in. */
  | 'unavailable'
  /** Was working, is not now. The only state that raises attention. */
  | 'failed';

export interface SubsystemStatus {
  id: SubsystemId;
  state: SubsystemState;
  /** Plain-English summary. Contract 2 rule 1: no jargon. */
  summary: string;
  /**
   * What the user should do next, when there is something to do.
   * Contract 2 rule 4: a problem shown without a next action is a bug.
   */
  nextAction?: { label: string; route: string };
  /** For [Technical details]. Never on the primary path. */
  technicalDetail?: string;
}

/**
 * Only `failed` is a problem.
 *
 * A desktop with no LoRaWAN radio is not a fault, and neither is a hub whose
 * owner has not set up Zigbee yet. Treating either as one produces a dashboard
 * that cries wolf on first run, which teaches people to ignore it.
 */
export const needsAttention = (status: SubsystemStatus): boolean => status.state === 'failed';
