import { describe, expect, it, vi } from 'vitest';

import { domainError, err, ok } from '../../domain/errors';
import type { CameraConfig } from '../../domain/camera';

import type { CameraAddPorts, ContainerRuntimePort, ImageEnsurePort } from './contract';
import { handleCameraAdd } from './usecase';

const config: CameraConfig = {
  displayName: 'Front door',
  address: '192.168.2.40',
  credentials: { username: 'admin', password: 'videocamera1$' },
  rtspPath: '/Streaming/Channels/102',
  onvifPort: 80,
  recording: 'motion',
  retentionDays: 14,
};

type CreateTwinMock = ReturnType<typeof vi.fn<ContainerRuntimePort['createTwin']>>;
type EnsureMock = ReturnType<typeof vi.fn<ImageEnsurePort['ensure']>>;

const ports = (overrides: { ensureFails?: boolean; registerFails?: boolean } = {}) => {
  const createTwin: CreateTwinMock = vi.fn(async () => ok(undefined));
  const save = vi.fn(async () => undefined);
  const ensure: EnsureMock = vi.fn(async () =>
    overrides.ensureFails ? err<string>(domainError('unknown', 'Download failed.')) : ok('lens-twin:2.1.0')
  );

  const value: CameraAddPorts & {
    createTwin: CreateTwinMock;
    ensure: EnsureMock;
    save: typeof save;
  } = {
    discovery: {
      discover: async () => [],
      probe: async () => ok({ frameDataUrl: 'data:image/jpeg;base64,x', codec: 'H264', width: 640, height: 360 }),
    },
    images: { ensure },
    lens: {
      newTwinKey: () => 'abcdef0123456789',
      registerTwin: async () =>
        overrides.registerFails
          ? err(domainError('unknown', 'Lens unavailable.'))
          : ok({ bootstrapToken: 'one-time-token', lensUri: 'https://lens.chirpwireless.io' }),
    },
    containers: { createTwin },
    // Camera-add is one consumer of the shared allocator, so here it is just
    // another fake — which is the point of hoisting it out of the runtime.
    ports: { allocate: async () => ok(18081) },
    records: { save },
    createTwin,
    ensure,
    save,
  };

  return value;
};

describe('camera-add', () => {
  it('runs end to end with four fakes and no Docker', async () => {
    const result = await handleCameraAdd(ports(), config);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.camera.displayName).toBe('Front door');
      expect(result.value.camera.hostPort).toBe(18081);
    }
  });

  it('pre-seeds config.json rather than relying on environment variables', async () => {
    const p = ports();
    await handleCameraAdd(p, config);

    const seeded = p.createTwin.mock.calls[0]?.[0]?.config as Record<string, unknown>;
    const capture = seeded?.['capture'] as { ipcamera?: Record<string, unknown> } | undefined;

    // The Twin refuses camera configuration via env: connection details and the
    // display name are operator-owned UI input. Pre-seeding the mounted volume
    // is the documented automation path, and this app IS the operator UI.
    expect(capture?.ipcamera?.['main_source']).toContain('rtsp://');
    expect(capture?.ipcamera?.['onvif_username']).toBe('admin');
    expect(seeded?.['name']).toBe('Front door');
  });

  it('writes the one-time bootstrap token straight into the config', async () => {
    const p = ports();
    const result = await handleCameraAdd(p, config);

    const seeded = p.createTwin.mock.calls[0]?.[0]?.config as Record<string, unknown>;

    // The token is returned exactly once and cannot be retrieved again, so it
    // goes straight into the config and is never surfaced — showing it would
    // invite the user to write down something that must not be lost.
    expect(seeded?.['bootstrap_token']).toBe('one-time-token');
    expect(JSON.stringify(result)).not.toContain('one-time-token');
  });

  it('percent-encodes credentials in the RTSP URL', async () => {
    const p = ports();
    await handleCameraAdd(p, config);

    const seeded = p.createTwin.mock.calls[0]?.[0]?.config as Record<string, unknown>;
    const capture = seeded?.['capture'] as { ipcamera?: Record<string, unknown> };

    // A '$' or '@' in a password silently corrupts an un-encoded RTSP URL, and
    // the camera then reports an authentication failure that looks like a wrong
    // password rather than a malformed URL.
    expect(capture.ipcamera?.['main_source']).toContain('videocamera1%24');
  });

  it('allocates a host port so several Twins can coexist', async () => {
    const p = ports();
    await handleCameraAdd(p, config);

    // Every Twin listens on port 80 internally; without per-Twin host ports the
    // second camera would collide with the first.
    expect(p.createTwin.mock.calls[0]?.[0]?.hostPort).toBe(18081);
  });

  it('does not register with Lens when the image could not be fetched', async () => {
    const p = ports({ ensureFails: true });
    const result = await handleCameraAdd(p, config);

    expect(result.ok).toBe(false);
    expect(p.createTwin).not.toHaveBeenCalled();
  });

  it('does not create a container when Lens registration failed', async () => {
    const p = ports({ registerFails: true });
    const result = await handleCameraAdd(p, config);

    // A Twin without a bootstrap token can never pair, so creating it would
    // leave a broken container the user has to discover and remove.
    expect(result.ok).toBe(false);
    expect(p.createTwin).not.toHaveBeenCalled();
  });

  it('reports progress in plain language', async () => {
    const steps: string[] = [];
    await handleCameraAdd(ports(), config, (step) => steps.push(step));

    for (const step of steps) {
      expect(step).not.toMatch(/docker|container|twin|rtsp|onvif/i);
    }
  });

  it('saves the camera only after its container exists', async () => {
    const p = ports();
    await handleCameraAdd(p, config);

    expect(p.save).toHaveBeenCalledTimes(1);
    // A record written before the container would survive a failed start and
    // leave a camera the user can neither open nor remove.
    expect(p.save.mock.invocationCallOrder[0]).toBeGreaterThan(p.createTwin.mock.invocationCallOrder[0] ?? 0);
  });

  it('saves nothing when the Twin could not be created', async () => {
    const p = ports();
    p.createTwin.mockResolvedValueOnce(err(domainError('unknown', 'no space left')));

    const result = await handleCameraAdd(p, config);

    expect(result.ok).toBe(false);
    expect(p.save).not.toHaveBeenCalled();
  });
});