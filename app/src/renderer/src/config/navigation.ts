/**
 * The navigation registry — the single source of truth for the left pane.
 *
 * Contract 1 (O): adding a section means adding a row here plus a page component.
 * No existing file gets edited, and there is no `switch (section)` anywhere.
 *
 * Contract 4 + chirp i18n convention: `label` and `subtitle` are the **English
 * text itself**, used directly as the translation key. A missing translation
 * therefore degrades to readable English rather than to a dotted identifier
 * leaking into the UI.
 *
 * Contract 2 rule 1: the labels are plain English — "Cameras", not "Twins";
 * "Zigbee", not "Z2M". The word "container" appears nowhere in this app's UI.
 */

export type CapabilityKey = 'cameras' | 'lorawan' | 'zigbee' | 'thread';

export interface NavItem {
  /** Stable id, also used for e2e selectors. */
  id: string;
  /** Route path under HashRouter. */
  path: string;
  /** English text, used as the i18n key. */
  label: string;
  /** English text, used as the i18n key. */
  subtitle: string;
  /**
   * Which host capability this section needs. Sections whose capability is
   * absent are still SHOWN — Contract 2 rule 4 — with an empty state explaining
   * what hardware is required. Hiding them makes the app look broken.
   */
  capability?: CapabilityKey;
}

export const NAV_ITEMS: readonly NavItem[] = [
  {
    id: 'dashboard',
    path: '/',
    label: 'Dashboard',
    subtitle: 'Everything on this device at a glance.',
  },
  {
    id: 'cameras',
    path: '/cameras',
    label: 'Cameras',
    subtitle: 'Record and stream your cameras through Chirp.',
    capability: 'cameras',
  },
  {
    id: 'lorawan',
    path: '/lorawan',
    label: 'LoRaWAN Gateway',
    subtitle: 'Connect this device to Chirp as a LoRaWAN gateway.',
    capability: 'lorawan',
  },
  {
    id: 'zigbee',
    path: '/zigbee',
    label: 'Zigbee',
    subtitle: 'Pair Zigbee devices and send their readings to Chirp.',
    capability: 'zigbee',
  },
  {
    id: 'thread',
    path: '/thread',
    label: 'Thread',
    subtitle: 'Run a Thread border router for Matter devices.',
    capability: 'thread',
  },
  {
    id: 'settings',
    path: '/settings',
    label: 'Settings',
    subtitle: 'Account, this device, and diagnostics.',
  },
] as const;
