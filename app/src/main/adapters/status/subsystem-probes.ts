import type { SubsystemStatus } from '../../domain/subsystem';
import type { SubsystemProbePort } from '../../usecase/subsystem-status/contract';
import { SERVICES } from '../../config/services';

/**
 * How a subsystem is really doing: the unit says whether it was asked to run,
 * the container says whether it is running.
 *
 * Both are needed. The units are oneshot wrappers around `docker compose up
 * -d`, so systemd keeps reporting them active after the container has died —
 * and the container alone cannot tell "never set up" from "set up and failed".
 */
export type UnitState = 'active' | 'failed' | 'inactive' | 'unknown';
export type ContainerState = 'running' | 'stopped' | 'missing';

const combine = (unit: UnitState, container: ContainerState): 'running' | 'failed' | 'stopped' => {
  if (unit === 'active' && container === 'running') return 'running';
  // Asked to run, and not running. This is the case systemd hides.
  if (unit === 'active' || unit === 'failed') return 'failed';
  return 'stopped';
};

/**
 * The three real subsystem probes.
 *
 * Each is built from the adapters that subsystem already owns and reaches into
 * no other subsystem's. That separation is what makes the isolation guarantee
 * hold at runtime rather than only in the use-case test: unplugging the Zigbee
 * dongle cannot affect the camera probe, because the camera probe never asks
 * about it.
 */

export interface LorawanProbeDeps {
  concentratorPresent(): Promise<boolean>;
  credentialsPresent(): Promise<boolean>;
  serviceState(unit: string): Promise<UnitState>;
  containerState(unit: string): Promise<ContainerState>;
}

export const createLorawanProbe = (deps: LorawanProbeDeps): SubsystemProbePort => ({
  id: 'lorawan',
  async probe(): Promise<SubsystemStatus> {
    if (!(await deps.concentratorPresent())) {
      return {
        id: 'lorawan',
        state: 'unavailable',
        summary: 'No LoRaWAN radio on this device.',
      };
    }

    if (!(await deps.credentialsPresent())) {
      return {
        id: 'lorawan',
        state: 'not-configured',
        summary: 'LoRaWAN radio found. It is not connected to Chirp yet.',
        nextAction: { label: 'Set up LoRaWAN', route: '/lorawan' },
      };
    }

    const [unit, container] = await Promise.all([
      deps.serviceState(SERVICES.lorawan),
      deps.containerState(SERVICES.lorawan),
    ]);

    const health = combine(unit, container);

    if (health === 'running') {
      return { id: 'lorawan', state: 'running', summary: 'Gateway is connected.' };
    }

    // "Started and died" and "never started" want different advice, so they are
    // not collapsed into one message (Contract 2 rule 2).
    return {
      id: 'lorawan',
      state: 'failed',
      summary:
        health === 'failed'
          ? 'The LoRaWAN gateway stopped unexpectedly.'
          : 'The LoRaWAN gateway is set up but not running.',
      nextAction: { label: 'Open LoRaWAN', route: '/lorawan' },
      technicalDetail: `${SERVICES.lorawan}: unit ${unit}, container ${container}`,
    };
  },
});

export interface ZigbeeProbeDeps {
  coordinatorPresent(): Promise<boolean>;
  serviceState(unit: string): Promise<UnitState>;
  containerState(unit: string): Promise<ContainerState>;
  pairedCount(): Promise<number>;
}

export const createZigbeeProbe = (deps: ZigbeeProbeDeps): SubsystemProbePort => ({
  id: 'zigbee',
  async probe(): Promise<SubsystemStatus> {
    const [present, unit, container] = await Promise.all([
      deps.coordinatorPresent(),
      deps.serviceState(SERVICES.zigbee),
      deps.containerState(SERVICES.zigbee),
    ]);

    const health = combine(unit, container);

    /**
     * The dongle-pulled case, and the reason this ordering matters: Zigbee2MQTT
     * with no radio exits and systemd restarts it forever. Reporting that as a
     * software failure would send the user to logs; reporting the missing
     * dongle sends them to the USB socket, which is where the problem is.
     */
    if (!present) {
      return {
        id: 'zigbee',
        state: health === 'stopped' ? 'unavailable' : 'failed',
        summary:
          health === 'stopped'
            ? 'No Zigbee dongle plugged in.'
            : 'The Zigbee dongle was unplugged. Plug it back into the same socket.',
        nextAction: health === 'stopped' ? undefined : { label: 'Open Zigbee', route: '/zigbee' },
      };
    }

    if (health !== 'running') {
      return {
        id: 'zigbee',
        state: health === 'failed' ? 'failed' : 'not-configured',
        summary: health === 'failed' ? 'Zigbee stopped unexpectedly.' : 'Zigbee dongle found. It is not started yet.',
        nextAction: { label: 'Open Zigbee', route: '/zigbee' },
        technicalDetail: `${SERVICES.zigbee}: unit ${unit}, container ${container}`,
      };
    }

    const paired = await deps.pairedCount();

    return {
      id: 'zigbee',
      state: 'running',
      summary: paired === 0 ? 'Zigbee is running. No devices added yet.' : `${paired} Zigbee device(s) connected.`,
      nextAction: paired === 0 ? { label: 'Add device', route: '/zigbee' } : undefined,
    };
  },
});

export interface CameraProbeDeps {
  runtimeReady(): Promise<boolean>;
  /** Twin containers, and whether each is running. */
  twins(): Promise<{ id: string; running: boolean }[]>;
}

export const createCameraProbe = (deps: CameraProbeDeps): SubsystemProbePort => ({
  id: 'cameras',
  async probe(): Promise<SubsystemStatus> {
    if (!(await deps.runtimeReady())) {
      return {
        id: 'cameras',
        state: 'unavailable',
        summary: 'Cameras need Docker, which is not running.',
        nextAction: { label: 'Open Settings', route: '/settings' },
      };
    }

    const twins = await deps.twins();

    if (twins.length === 0) {
      return {
        id: 'cameras',
        state: 'not-configured',
        summary: 'No cameras yet.',
        nextAction: { label: 'Add camera', route: '/cameras' },
      };
    }

    const down = twins.filter((twin) => !twin.running);

    if (down.length > 0) {
      return {
        id: 'cameras',
        state: 'failed',
        summary: down.length === 1 ? 'A camera has stopped recording.' : `${down.length} cameras have stopped.`,
        nextAction: { label: 'Open Cameras', route: '/cameras' },
        technicalDetail: down.map((twin) => twin.id).join(', '),
      };
    }

    return {
      id: 'cameras',
      state: 'running',
      summary: twins.length === 1 ? '1 camera recording.' : `${twins.length} cameras recording.`,
    };
  },
});
