/**
 * Can a camera be set up at all right now?
 *
 * Contract 1 (I): its own narrow port. Discovery must not learn to answer this —
 * finding a camera and being able to keep one are different questions, and the
 * flow already conflated them once by letting a user scan, enter a password and
 * see a frame before failing on something known before they started.
 *
 * Only one blocker is left. Lens registration used to be the second, and it
 * stopped being our concern when registering moved to the Twin's own Lens tab,
 * where it belongs.
 */

export interface CameraBlockerPort {
  /** Whether the Twin image can be obtained. */
  isImageAvailable(): Promise<boolean>;
}

export interface CameraAvailabilityPorts {
  blockers: CameraBlockerPort;
}

export interface CameraAvailability {
  /** True when a camera set up now would actually end up running. */
  canAdd: boolean;
  /**
   * Why not, in plain words — English text used as the i18n key. Present only
   * when `canAdd` is false.
   */
  reason?: string;
  /** For [Technical details]; never the primary message. */
  technicalDetail?: string;
}
