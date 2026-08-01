import type { SubsystemId, SubsystemStatus } from '../../domain/subsystem';

import type { SubsystemStatusPorts } from './contract';

/**
 * Plain-English fallbacks, per subsystem, for a probe that itself broke.
 *
 * Contract 2 rule 2: a probe throwing is still a failure the user sees, so it
 * gets a cause and a next action like any other — not "Error: undefined".
 */
const PROBE_FAILURE: Record<SubsystemId, { summary: string; label: string; route: string }> = {
  lorawan: { summary: "Couldn't check the LoRaWAN gateway.", label: 'Open LoRaWAN', route: '/lorawan' },
  zigbee: { summary: "Couldn't check Zigbee.", label: 'Open Zigbee', route: '/zigbee' },
  cameras: { summary: "Couldn't check your cameras.", label: 'Open Cameras', route: '/cameras' },
};

/**
 * Every subsystem's state, gathered so that no subsystem can take another down.
 *
 * `allSettled`, not `all`. With `all`, one rejected probe discards the results
 * of the others — pull the Zigbee dongle and a bug in its probe would blank the
 * camera and gateway cards too, which is precisely the failure this phase
 * exists to rule out.
 *
 * Probes run concurrently because they are independent; a slow one delays the
 * page, but never a wrong one.
 */
export const handleSubsystemStatus = async (ports: SubsystemStatusPorts): Promise<SubsystemStatus[]> => {
  const settled = await Promise.allSettled(ports.probes.map((probe) => probe.probe()));

  return settled.map((outcome, index) => {
    if (outcome.status === 'fulfilled') return outcome.value;

    const probe = ports.probes[index];
    // `probes` and `settled` are the same array mapped, so this cannot be
    // missing; the guard is for the type, not for a real case.
    const id: SubsystemId = probe ? probe.id : 'cameras';
    const fallback = PROBE_FAILURE[id];
    const reason: unknown = outcome.reason;

    return {
      id,
      state: 'failed',
      summary: fallback.summary,
      nextAction: { label: fallback.label, route: fallback.route },
      technicalDetail: reason instanceof Error ? reason.message : String(reason),
    };
  });
};
