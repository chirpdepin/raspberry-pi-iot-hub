/**
 * Every TCP port the hub binds, in one table.
 *
 * Contract 4: one source of truth. Before this existed, each subsystem knew its
 * own port and nothing about anyone else's — Mosquitto in a compose file,
 * Zigbee2MQTT in a compose file, the Twin allocator in an adapter constant.
 * Nothing could answer "is this port already spoken for", so the answer was
 * discovered at the next reboot instead.
 *
 * Reserved ports are reserved whether or not the service is currently running.
 * That distinction is the whole point: a stopped subsystem's port reads as free
 * to the kernel, so a liveness check alone will happily hand it to a Twin, and
 * the collision only surfaces when the stopped service comes back.
 */

export interface ReservedPort {
  port: number;
  /** Subsystem that owns it, for the diagnostic message on a collision. */
  owner: string;
  /** Why it is this number, so a future change is a decision and not a guess. */
  reason: string;
}

export const RESERVED_PORTS: readonly ReservedPort[] = [
  {
    port: 1883,
    owner: 'MQTT broker',
    reason: 'Mosquitto, bound to loopback. The one broker all three subsystems publish through.',
  },
  {
    port: 8080,
    owner: 'Zigbee2MQTT',
    reason: 'Its web frontend. Left enabled because it is the fallback when the app cannot start.',
  },
  {
    port: 8081,
    owner: 'Thread border router',
    reason: 'OTBR web UI. Moved off 8080 by docker/thread/docker-compose.yml precisely to avoid Zigbee2MQTT.',
  },
] as const;

/**
 * Host ports handed to camera Twins.
 *
 * Deliberately far above the reserved block: Twin count is the only thing here
 * that grows, and a range that starts just past a fixed port would collide the
 * moment another subsystem is added.
 */
export const TWIN_PORT_RANGE = { start: 18_080, end: 18_180 } as const;

/**
 * Basic Station is deliberately absent from the table above: it binds nothing.
 *
 * It runs with `network_mode: host` and dials **outbound** to the LNS over
 * wss://, so it contributes no listener to collide with. Adding it with a
 * made-up port would be worse than omitting it — it would reserve a port
 * nothing uses and imply an inbound connection that never happens.
 */
export const reservedPortFor = (port: number): ReservedPort | undefined =>
  RESERVED_PORTS.find((r) => r.port === port);
