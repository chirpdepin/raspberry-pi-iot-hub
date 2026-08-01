/**
 * The one broker, and the topic namespace its three producers share.
 *
 * Contract 4: one source of truth. Zigbee2MQTT, camera Twins and hub telemetry
 * all publish to the same Mosquitto instance, so the namespace has to be
 * decided once, in one place, rather than by each subsystem picking a prefix
 * and hoping.
 */

/**
 * Loopback on purpose.
 *
 * The broker is anonymous — it has no authentication at all — so binding it to
 * anything else would hand control of the user's Zigbee devices to every device
 * on their network. Reaching Chirp is the bridge's job, outbound, with
 * credentials; it is not a reason to open the local broker up.
 */
export const BROKER_URL = 'mqtt://127.0.0.1:1883';

/**
 * Local top-level topics, one per producer.
 *
 * `zigbee2mqtt` is not a name we chose — it is Zigbee2MQTT's own default
 * base_topic, and changing it would mean re-flashing every published example
 * and every integration that assumes it. The other two are namespaced beside
 * it so no producer can publish into another's tree.
 */
export const LOCAL_TOPICS = {
  zigbee: 'zigbee2mqtt',
  cameras: 'chirp-hub/cameras',
  hub: 'chirp-hub/status',
} as const;

export type Producer = keyof typeof LOCAL_TOPICS;

/**
 * The remote prefix is **assigned by Chirp**, not derived here.
 *
 * Creating a Cloud MQTT connector returns a `topic_prefix` of the form
 * `iot/<organization-id>/<connection-id>` (verified on 2026-08-01). It is
 * per-connection, so a hub with two connectors has two prefixes and no device
 * -side identifier — gateway EUI included — can reproduce it.
 *
 * An earlier version computed `chirp/<eui>/` locally. That would have published
 * into a tree Chirp does not read, so telemetry would have left the hub and
 * silently gone nowhere: the bridge connects, messages flow, and nothing
 * arrives. It is stored with the connector credentials instead.
 */
export const normaliseRemotePrefix = (topicPrefix: string): string =>
  topicPrefix.endsWith('/') ? topicPrefix : `${topicPrefix}/`;

/**
 * A bridge whose remote prefix equals its local prefix loops: every message it
 * forwards out comes straight back in and is forwarded again.
 *
 * Mosquitto does not refuse this configuration — it accepts it and floods. The
 * check is here, in the domain of the decision, so the mistake cannot be made
 * by a future adapter that builds the stanza differently.
 */
export const isBridgeLoopSafe = (localPrefix: string, remotePrefix: string): boolean =>
  remotePrefix !== localPrefix && !remotePrefix.startsWith(localPrefix) && !localPrefix.startsWith(remotePrefix);

/**
 * One bridge topic line per producer, all in the `out` direction.
 *
 * Outbound only, deliberately. The hub publishes telemetry to Chirp; it does
 * not subscribe to the remote tree. A matching `in` line is a loop unless the
 * remote honours `try_private`, and Chirp's broker is not Mosquitto — so the
 * return path is not taken on trust. Nothing on the hub needs the cloud copy
 * anyway: Zigbee2MQTT already has the local one.
 *
 * `topicPrefix` comes from the connector, not from this device.
 */
export const bridgeTopicLines = (topicPrefix: string): string[] => {
  const remote = normaliseRemotePrefix(topicPrefix);

  return Object.values(LOCAL_TOPICS).map((local) => `topic # out 1 ${local}/ ${remote}${local}/`);
};
