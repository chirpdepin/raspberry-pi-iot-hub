import type { ZigbeeAdapter } from '../domain/zigbee';

/**
 * Coordinator chip family -> Zigbee2MQTT adapter driver.
 *
 * Contract 1 (O) and Contract 4: a **registry**, so supporting a new
 * coordinator is one row here rather than an edit to a `switch`. This is the
 * same mapping `detect-radios.sh` applies on the device, kept in sync because
 * both derive it from the USB descriptor.
 *
 * Choosing the wrong adapter is the most common Zigbee2MQTT misconfiguration,
 * and it fails with "failed to connect to the adapter" — which points at the
 * cable rather than the setting.
 */
export interface AdapterRule {
  /** Case-insensitive substrings matched against vendor + model. */
  match: string[];
  adapter: ZigbeeAdapter;
}

export const ADAPTER_RULES: readonly AdapterRule[] = [
  // Silicon Labs EFR32 running EmberZNet
  {
    match: ['mg24', 'mg21', 'mg26', 'zbdongle-e', 'dongle_plus_v2', 'skyconnect', 'zbt-1', 'slzb-06mu', 'slzb-07'],
    adapter: 'ember',
  },
  // Texas Instruments CC2652 / CC1352
  { match: ['zbdongle-p', 'cc2652', 'cc1352', 'slzb-06p', 'slzb-07p'], adapter: 'zstack' },
  // dresden elektronik ConBee
  { match: ['conbee', 'raspbee', 'dresden'], adapter: 'deconz' },
  // Nordic nRF52840 running ZBOSS NCP
  { match: ['nrf52840', 'zboss'], adapter: 'zboss' },
] as const;

export const adapterFor = (vendorAndModel: string): ZigbeeAdapter | null => {
  const haystack = vendorAndModel.toLowerCase();

  for (const rule of ADAPTER_RULES) {
    if (rule.match.some((needle) => haystack.includes(needle))) return rule.adapter;
  }

  // Deliberately null rather than a guess — see the use case.
  return null;
};
