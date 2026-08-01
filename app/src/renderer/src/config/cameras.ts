/**
 * Camera defaults — Contract 4's single source of truth for the wizard.
 *
 * Every value is a decision with a reason, not a number someone typed into a
 * form component.
 */

export const CAMERA_DEFAULTS = {
  /**
   * Nearly every IP camera ships with this. Pre-filling it removes one of the
   * two fields the user actually has to answer.
   */
  username: 'admin',

  /**
   * Motion, not continuous: continuous recording fills a card in days, and most
   * people want events rather than eight hours of an empty hallway.
   */
  recording: 'motion' as const,

  /** Two weeks. Long enough to notice something happened, short enough to fit. */
  retentionDays: 14,
} as const;

/** Retention choices offered in the wizard, in days. */
export const RETENTION_OPTIONS = [7, 14, 30, 90] as const;
