import type { CapabilityKey } from './navigation';

/**
 * The capability registry — what each section needs, and what to say when it is
 * missing.
 *
 * Contract 1 (O): adding a capability is a row here plus a page. There is no
 * `switch (capability)` and no `if (platform === 'linux')` anywhere in the UI.
 *
 * Contract 2 rule 4: every entry states what is missing, why, and the single
 * next action. An empty state that does not say what to do next is a bug, and a
 * feature hidden because the hardware is absent makes the app look broken —
 * the user cannot tell "not supported here" from "not working".
 *
 * Contract 4: all text is English used directly as the i18n key.
 */

export interface CapabilityCopy {
  /** Shown when the capability is unavailable on this machine. */
  emptyTitle: string;
  /** Shown when available but nothing has been set up yet. */
  unconfiguredTitle: string;
  /** Primary action for the unconfigured state. */
  unconfiguredAction: string;
}

export const CAPABILITY_COPY: Record<CapabilityKey, CapabilityCopy> = {
  cameras: {
    emptyTitle: 'Camera recording needs Docker.',
    unconfiguredTitle: 'No cameras yet. Add a camera and set it up in its own window.',
    unconfiguredAction: 'Scan for cameras',
  },
  lorawan: {
    emptyTitle:
      'No LoRaWAN radio on this computer. LoRaWAN needs a concentrator such as a RAK5146 on a Raspberry Pi HAT.',
    unconfiguredTitle: 'Concentrator ready. Connect it to Chirp to start receiving data.',
    unconfiguredAction: 'Register with Chirp',
  },
  zigbee: {
    emptyTitle: 'No Zigbee coordinator found. Plug in a supported USB dongle and it will appear here.',
    unconfiguredTitle: 'Coordinator ready. No devices paired yet.',
    unconfiguredAction: 'Add device',
  },
  thread: {
    emptyTitle:
      'Thread needs its own radio. One dongle cannot run Zigbee and Thread at the same time — they use different firmware.',
    unconfiguredTitle: 'Thread radio ready. No border router running yet.',
    unconfiguredAction: 'Start Thread',
  },
};
