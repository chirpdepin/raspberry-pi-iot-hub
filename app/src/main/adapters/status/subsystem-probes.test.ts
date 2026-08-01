import { describe, expect, it } from 'vitest';

import { createCameraProbe, createLorawanProbe, createZigbeeProbe } from './subsystem-probes';

/**
 * These probes are adapters, but the combination of unit state and container
 * state is a decision, not I/O — and it is the decision that was wrong on real
 * hardware, so it is tested with fakes like a use case.
 *
 * The units are `Type=oneshot` with `RemainAfterExit=yes` around `docker
 * compose up -d`. Verified on the Pi: `systemctl is-active iot-hub-zigbee`
 * reports `active` because the compose command returned, and it keeps
 * reporting that no matter what the container does next.
 */

const lorawan = (unit: 'active' | 'failed' | 'inactive', container: 'running' | 'stopped' | 'missing') =>
  createLorawanProbe({
    concentratorPresent: async () => true,
    credentialsPresent: async () => true,
    serviceState: async () => unit,
    containerState: async () => container,
  });

const zigbee = (
  unit: 'active' | 'failed' | 'inactive',
  container: 'running' | 'stopped' | 'missing',
  present = true
) =>
  createZigbeeProbe({
    coordinatorPresent: async () => present,
    serviceState: async () => unit,
    containerState: async () => container,
    pairedCount: async () => 1,
  });

describe('subsystem probes', () => {
  it('reports the gateway running only when its container is', async () => {
    expect((await lorawan('active', 'running').probe()).state).toBe('running');
  });

  /** The defect. systemd says active; the container is dead. */
  it('does not believe systemd when the gateway container has died', async () => {
    const status = await lorawan('active', 'stopped').probe();

    expect(status.state).toBe('failed');
    expect(status.summary).toContain('stopped unexpectedly');
    expect(status.nextAction).toBeDefined();
  });

  it('does not believe systemd when the Zigbee container has died', async () => {
    const status = await zigbee('active', 'stopped').probe();

    expect(status.state).toBe('failed');
    expect(status.summary).toContain('stopped unexpectedly');
  });

  it('tells "never started" apart from "started and died"', async () => {
    const never = await lorawan('inactive', 'missing').probe();
    const died = await lorawan('active', 'stopped').probe();

    expect(never.summary).toContain('not running');
    expect(died.summary).toContain('unexpectedly');
    // Same state, different advice — the point of keeping them apart.
    expect(never.summary).not.toBe(died.summary);
  });

  it('reports a missing radio before a service failure, because that is the fixable part', async () => {
    const status = await zigbee('active', 'stopped', false).probe();

    // Zigbee2MQTT with no radio exits and restarts forever. Sending the user to
    // logs would waste their time; sending them to the USB socket would not.
    expect(status.summary).toContain('unplugged');
  });

  it('does not call a fresh install a failure', async () => {
    const status = await zigbee('inactive', 'missing', false).probe();

    expect(status.state).toBe('unavailable');
    expect(status.nextAction).toBeUndefined();
  });

  it('keeps a stopped camera visible as a failure', async () => {
    const probe = createCameraProbe({
      runtimeReady: async () => true,
      twins: async () => [
        { id: 'twin-a', running: true },
        { id: 'twin-b', running: false },
      ],
    });

    const status = await probe.probe();

    expect(status.state).toBe('failed');
    expect(status.technicalDetail).toContain('twin-b');
  });
});
