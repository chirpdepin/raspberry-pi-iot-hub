import type { Capabilities } from '../../domain/host';

import type { HostCapabilitiesPorts, HostCapabilitiesResult } from './contract';

/**
 * Works out what this machine can do, and — when it cannot do something — why.
 *
 * Contract 2 rule 4: a capability that is unavailable still appears in the UI,
 * with the reason attached. Hiding LoRaWAN on a laptop makes the app look
 * broken; saying "LoRaWAN needs a concentrator such as a RAK5146 on a Raspberry
 * Pi HAT" tells the user what to buy.
 *
 * `reason` is English text used directly as an i18n key (Contract 5).
 */

const REASON = {
  noConcentrator:
    'No LoRaWAN radio on this computer. LoRaWAN needs a concentrator such as a RAK5146 on a Raspberry Pi HAT.',
  noZigbee: 'No Zigbee coordinator found. Plug in a supported USB dongle and it will appear here.',
  noThread: 'Thread needs its own radio. One dongle cannot run Zigbee and Thread at the same time.',
  noRuntime: 'Camera recording needs Docker.',
  runtimeStopped: 'Docker is installed but not running.',
} as const;

export const handleHostCapabilities = async (ports: HostCapabilitiesPorts): Promise<HostCapabilitiesResult> => {
  const [host, runtime, hasConcentrator, hasZigbee, hasThread] = await Promise.all([
    ports.hostInfo.read(),
    ports.containerRuntime.status(),
    ports.radios.hasConcentrator(),
    ports.radios.hasZigbeeCoordinator(),
    ports.radios.hasThreadRadio(),
  ]);

  // "Installed but not running" is a different screen from "not installed" —
  // one offers [Start Docker], the other [Install Docker].
  const cameraReason = !runtime.installed ? REASON.noRuntime : !runtime.running ? REASON.runtimeStopped : undefined;

  const capabilities: Capabilities = {
    cameras: {
      name: 'cameras',
      available: runtime.installed && runtime.running,
      reason: cameraReason,
    },
    lorawan: {
      name: 'lorawan',
      available: hasConcentrator,
      reason: hasConcentrator ? undefined : REASON.noConcentrator,
    },
    zigbee: {
      name: 'zigbee',
      available: hasZigbee,
      reason: hasZigbee ? undefined : REASON.noZigbee,
    },
    thread: {
      name: 'thread',
      available: hasThread,
      reason: hasThread ? undefined : REASON.noThread,
    },
  };

  return { host, capabilities };
};
