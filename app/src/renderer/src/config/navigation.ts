/**
 * The navigation registry — the single source of truth for the left pane.
 *
 * Contract 1 (O): adding a section means adding a row here plus a page component.
 * No existing file gets edited, and there is no `switch (section)` anywhere.
 *
 * Contract 4: labels are translation KEYS, never literal text. Every string the
 * user sees lives in locales/, so a new language is a new JSON file.
 *
 * Contract 2 rule 1: the keys resolve to plain English — "Cameras", not "Twins";
 * "Zigbee", not "Z2M". The word "container" appears nowhere in this app's UI.
 */

export type CapabilityKey = 'cameras' | 'lorawan' | 'zigbee' | 'thread';

export interface NavItem {
    /** Stable id, also used for e2e selectors. */
    id: string;
    /** Route path under HashRouter. */
    path: string;
    /** i18n key in the `nav` namespace. */
    labelKey: string;
    /**
     * Which host capability this section needs. Sections whose capability is
     * absent are still SHOWN — Contract 2 rule 4 — with an empty state that
     * explains what hardware is required. Hiding them makes the app look broken.
     */
    capability?: CapabilityKey;
}

export const NAV_ITEMS: readonly NavItem[] = [
    { id: 'dashboard', path: '/', labelKey: 'nav.dashboard' },
    { id: 'cameras', path: '/cameras', labelKey: 'nav.cameras', capability: 'cameras' },
    { id: 'lorawan', path: '/lorawan', labelKey: 'nav.lorawan', capability: 'lorawan' },
    { id: 'zigbee', path: '/zigbee', labelKey: 'nav.zigbee', capability: 'zigbee' },
    { id: 'thread', path: '/thread', labelKey: 'nav.thread', capability: 'thread' },
    { id: 'settings', path: '/settings', labelKey: 'nav.settings' },
] as const;
