import { describe, expect, it } from 'vitest';

import { bridgeTopicLines, isBridgeLoopSafe, LOCAL_TOPICS, normaliseRemotePrefix } from './mqtt';

/** A real prefix as Chirp issued it on 2026-08-01. */
const TOPIC_PREFIX = 'iot/100eb045-022b-4272-bf7b-0005ad66c40a/961f5f12-3dde-42c1-837e-c9bed06bb122';

/**
 * The Phase 11 "one broker, three producers" risk, as tests.
 *
 * Mosquitto accepts a looping bridge without complaint and then floods, so the
 * invariant has to be checked here rather than discovered at runtime.
 */
describe('mqtt namespace', () => {
  it('gives each producer its own tree', () => {
    const topics = Object.values(LOCAL_TOPICS);

    expect(new Set(topics).size).toBe(topics.length);

    for (const a of topics) {
      for (const b of topics) {
        if (a === b) continue;
        // No producer's topic may be a prefix of another's, or a wildcard
        // subscription on one would swallow the other's messages.
        expect(a.startsWith(`${b}/`)).toBe(false);
      }
    }
  });

  it('takes the remote prefix from the connector rather than inventing one', () => {
    // Chirp assigns iot/<org>/<connection>. Nothing on the device can derive
    // it, and a locally invented prefix publishes where Chirp does not read.
    expect(normaliseRemotePrefix(TOPIC_PREFIX)).toBe(`${TOPIC_PREFIX}/`);
    // Idempotent, so a prefix that already ends in / is not doubled.
    expect(normaliseRemotePrefix(`${TOPIC_PREFIX}/`)).toBe(`${TOPIC_PREFIX}/`);
  });

  it('detects a bridge configuration that would loop', () => {
    expect(isBridgeLoopSafe('zigbee2mqtt/', 'zigbee2mqtt/')).toBe(false);
    expect(isBridgeLoopSafe('zigbee2mqtt/', 'zigbee2mqtt/remote/')).toBe(false);
    expect(isBridgeLoopSafe('zigbee2mqtt/', normaliseRemotePrefix(TOPIC_PREFIX))).toBe(true);
  });

  it('produces one outbound bridge line per producer, none of which loops', () => {
    const lines = bridgeTopicLines(TOPIC_PREFIX);

    expect(lines).toHaveLength(Object.keys(LOCAL_TOPICS).length);

    for (const line of lines) {
      const [, , direction, , local, remote] = line.split(' ');
      // Outbound only: subscribing to the remote tree would pull every other
      // hub's traffic in the organization down a home connection.
      expect(direction).toBe('out');
      expect(isBridgeLoopSafe(local ?? '', remote ?? '')).toBe(true);
    }
  });
});
