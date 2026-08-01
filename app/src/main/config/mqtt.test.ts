import { describe, expect, it } from 'vitest';

import { bridgeTopicLines, isBridgeLoopSafe, LOCAL_TOPICS, remoteTopicPrefix } from './mqtt';

const HUB_EUI = '0016C001FF1E96BB';

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

  it('namespaces the remote side by hub, so two hubs in one organization do not interleave', () => {
    expect(remoteTopicPrefix(HUB_EUI)).toBe('chirp/0016c001ff1e96bb/');
    expect(remoteTopicPrefix('0016C001FF1E96BB')).not.toBe(remoteTopicPrefix('0016C001FF1E96BC'));
  });

  it('detects a bridge configuration that would loop', () => {
    expect(isBridgeLoopSafe('zigbee2mqtt/', 'zigbee2mqtt/')).toBe(false);
    expect(isBridgeLoopSafe('zigbee2mqtt/', 'zigbee2mqtt/remote/')).toBe(false);
    expect(isBridgeLoopSafe('zigbee2mqtt/', remoteTopicPrefix(HUB_EUI))).toBe(true);
  });

  it('produces one outbound bridge line per producer, none of which loops', () => {
    const lines = bridgeTopicLines(HUB_EUI);

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
