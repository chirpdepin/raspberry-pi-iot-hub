/**
 * Host port allocation, hoisted out of the camera subsystem.
 *
 * Contract 1 (S, D): this used to be `allocatePort()` on `ContainerRuntimePort`,
 * consumed only by `camera-add`. Integration is what showed that to be the wrong
 * boundary — port allocation is cross-cutting. Mosquitto, Zigbee2MQTT, the
 * Thread border router and every Twin share one host's port space, and an
 * allocator that only knows about Twins cannot avoid the other three.
 *
 * Per the Phase 11 SOLID gate: a cross-cutting concern belongs in ONE port
 * consumed by all subsystems, not duplicated into each.
 */

import type { Result } from '../../domain/errors';

export interface PortProbePort {
  /** Whether the kernel will accept a bind right now. */
  isFree(port: number): Promise<boolean>;
}

export interface PortClaimsPort {
  /**
   * Host ports already published by containers, **including stopped ones**.
   *
   * This is the half a liveness probe cannot supply. A stopped container
   * publishes nothing, so its port reads free; hand it to a second Twin and
   * both break the next time the first one starts. Docker keeps the mapping on
   * the stopped container, so it can be asked.
   */
  published(): Promise<number[]>;
}

export interface PortAllocatePorts {
  probe: PortProbePort;
  claims: PortClaimsPort;
}

export type PortAllocateResult = Result<number>;
