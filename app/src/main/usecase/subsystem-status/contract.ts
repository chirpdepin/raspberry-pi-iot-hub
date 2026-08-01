import type { SubsystemId, SubsystemStatus } from '../../domain/subsystem';

/**
 * Reports each subsystem independently.
 *
 * Contract 1 (I, D): three narrow probes, not one `SystemPort`. The isolation
 * guarantee is only real if the code cannot express "ask everything at once and
 * fail together" — so each subsystem is a separate port, and the use case is
 * written so one throwing cannot reach the others.
 */

export interface SubsystemProbePort {
  id: SubsystemId;
  /**
   * May reject. That is the interesting case, and handling it is this use
   * case's entire job — an adapter is allowed to be broken.
   */
  probe(): Promise<SubsystemStatus>;
}

export interface SubsystemStatusPorts {
  probes: SubsystemProbePort[];
}
