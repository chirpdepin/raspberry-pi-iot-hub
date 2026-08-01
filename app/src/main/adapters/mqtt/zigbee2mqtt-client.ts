import mqtt, { type MqttClient } from 'mqtt';

import { domainError, err, ok, type Result } from '../../domain/errors';
import type { ZigbeeCoordinator, ZigbeeDevice } from '../../domain/zigbee';
import { adapterFor } from '../../config/zigbee-adapters';
import { BROKER_URL, LOCAL_TOPICS } from '../../config/mqtt';
import type { PermitJoinPort } from '../../usecase/zigbee-permit-join/contract';
import type { ObservedPayloadPort } from '../../usecase/zigbee-device-link-chirp/contract';
import type { Zigbee2MqttPort } from '../../usecase/zigbee-device-list/contract';

/**
 * Zigbee2MQTT over the local MQTT broker.
 *
 * Everything here talks to 127.0.0.1: the broker binds loopback on purpose, so
 * an anonymous broker never exposes control of the user's Zigbee devices to
 * their whole network.
 *
 * The client keeps the last payload seen per device, which is what lets sensor
 * mappings be proposed from what a device actually sends rather than from a
 * static database that cannot cover devices nobody has modelled.
 */

/**
 * Broker and base topic come from config/mqtt.ts, which is where the namespace
 * shared with camera and hub telemetry is decided. A second copy here is how
 * two producers end up publishing into the same tree.
 */
const BASE_TOPIC = LOCAL_TOPICS.zigbee;

/** How long to wait for the bridge to answer before deciding it is not running. */
const BRIDGE_TIMEOUT_MS = 3_000;

interface BridgeDevice {
  ieee_address: string;
  friendly_name: string;
  type: string;
  manufacturer?: string;
  model_id?: string;
  definition?: { model?: string; vendor?: string } | null;
  supported?: boolean;
}

export interface Zigbee2MqttClientDeps {
  /** Injected so tests can supply a fake broker. */
  connect?: (url: string) => MqttClient;
}

export const createZigbee2MqttClient = ({ connect = (url) => mqtt.connect(url) }: Zigbee2MqttClientDeps = {}) => {
  let client: MqttClient | null = null;
  let bridgeDevices: BridgeDevice[] = [];
  let bridgeOnline = false;

  /** Last payload per IEEE address, and when it arrived. */
  const lastPayloads = new Map<string, { payload: Record<string, unknown>; at: number }>();

  const ensureConnected = (): MqttClient => {
    if (client) return client;

    client = connect(BROKER_URL);

    client.on('connect', () => {
      client?.subscribe([`${BASE_TOPIC}/bridge/devices`, `${BASE_TOPIC}/bridge/state`, `${BASE_TOPIC}/+`]);
    });

    client.on('message', (topic, buffer) => {
      const text = buffer.toString();

      if (topic === `${BASE_TOPIC}/bridge/devices`) {
        try {
          bridgeDevices = JSON.parse(text) as BridgeDevice[];
        } catch {
          // A malformed retained message must not take the client down.
        }
        return;
      }

      if (topic === `${BASE_TOPIC}/bridge/state`) {
        bridgeOnline = text.includes('online');
        return;
      }

      // zigbee2mqtt/<friendly_name>, where friendly_name is the IEEE address
      // because we never rename it — see domain/zigbee.ts.
      const name = topic.slice(BASE_TOPIC.length + 1);
      if (name.includes('/')) return;

      try {
        lastPayloads.set(name, { payload: JSON.parse(text) as Record<string, unknown>, at: Date.now() });
      } catch {
        // Non-JSON payloads are not device state.
      }
    });

    client.on('error', () => {
      bridgeOnline = false;
    });

    return client;
  };

  const publish = async (topic: string, payload: string): Promise<Result<void>> => {
    try {
      const connection = ensureConnected();

      await new Promise<void>((resolve, reject) => {
        connection.publish(topic, payload, { qos: 1 }, (error) => (error ? reject(error) : resolve()));
      });

      return ok(undefined);
    } catch (error) {
      return err(
        domainError(
          'unknown',
          "Couldn't reach the Zigbee service on this device.",
          error instanceof Error ? error.message : String(error)
        )
      );
    }
  };

  const zigbeePort: Zigbee2MqttPort = {
    async coordinator(): Promise<ZigbeeCoordinator | null> {
      // The coordinator comes from the radio inventory, not from MQTT — it is
      // known before Zigbee2MQTT is running.
      return null;
    },

    async devices(): Promise<Omit<ZigbeeDevice, 'connectedToChirp'>[]> {
      ensureConnected();

      // Give a freshly-created client a moment to receive the retained
      // bridge/devices message before reporting an empty network.
      if (bridgeDevices.length === 0) {
        await new Promise((resolve) => setTimeout(resolve, BRIDGE_TIMEOUT_MS));
      }

      return (
        bridgeDevices
          // The coordinator itself appears in this list and is not a device.
          .filter((device) => device.type !== 'Coordinator')
          .map((device) => {
            const seen = lastPayloads.get(device.friendly_name) ?? lastPayloads.get(device.ieee_address);
            const payload = seen?.payload ?? {};

            const linkQuality = typeof payload['linkquality'] === 'number' ? payload['linkquality'] : null;
            const battery = typeof payload['battery'] === 'number' ? payload['battery'] : null;

            return {
              ieeeAddress: device.ieee_address,
              // friendly_name stays the IEEE address; the readable name is ours.
              displayName: device.definition?.model ?? device.model_id ?? device.ieee_address,
              type: device.type,
              manufacturer: device.definition?.vendor ?? device.manufacturer ?? null,
              model: device.definition?.model ?? device.model_id ?? null,
              linkQuality,
              batteryPercent: battery,
              lastSeen: seen ? new Date(seen.at).toISOString() : null,
              // "Has it ever reported" is the honest meaning of connected-to-hub.
              connectedToHub: Boolean(seen),
            };
          })
      );
    },

    async isRunning(): Promise<boolean> {
      ensureConnected();
      return bridgeOnline;
    },
  };

  const permitJoinPort: PermitJoinPort = {
    permitJoin: (seconds) => publish(`${BASE_TOPIC}/bridge/request/permit_join`, JSON.stringify({ time: seconds })),
    stopJoin: () => publish(`${BASE_TOPIC}/bridge/request/permit_join`, JSON.stringify({ time: 0 })),
  };

  const payloadPort: ObservedPayloadPort = {
    async lastPayload(ieeeAddress: string) {
      return lastPayloads.get(ieeeAddress)?.payload ?? null;
    },
  };

  return {
    zigbee: zigbeePort,
    permitJoin: permitJoinPort,
    payloads: payloadPort,
    close: () => {
      client?.end();
      client = null;
    },
    /** Exposed so the service adapter can fill in the coordinator it knows. */
    adapterFor,
  };
};
