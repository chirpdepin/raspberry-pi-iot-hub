import { describe, expect, it, vi } from 'vitest';

import { domainError, err, ok } from '../../domain/errors';
import type { DiscoveredCamera } from '../../domain/camera';

import type { CameraAddPorts, ContainerRuntimePort, ImageEnsurePort } from './contract';
import { handleCameraAdd } from './usecase';

const camera: DiscoveredCamera = {
  xaddr: 'http://192.168.2.205:2020/onvif/device_service',
  address: '192.168.2.205',
  manufacturer: 'TC71',
  model: 'TC71',
};

type CreateTwinMock = ReturnType<typeof vi.fn<ContainerRuntimePort['createTwin']>>;
type EnsureMock = ReturnType<typeof vi.fn<ImageEnsurePort['ensure']>>;

const ports = (overrides: { ensureFails?: boolean; portFails?: boolean; createFails?: boolean } = {}) => {
  const createTwin: CreateTwinMock = vi.fn(async () =>
    overrides.createFails ? err<void>(domainError('unknown', "Couldn't set up this camera on the device.")) : ok(undefined)
  );
  const save = vi.fn(async () => undefined);
  const ensure: EnsureMock = vi.fn(async () =>
    overrides.ensureFails ? err<string>(domainError('unknown', 'Download failed.')) : ok('lens-twin:2.1.0')
  );

  const value: CameraAddPorts & {
    createTwin: CreateTwinMock;
    ensure: EnsureMock;
    save: typeof save;
  } = {
    images: { ensure },
    containers: { createTwin },
    ports: {
      allocate: async () => (overrides.portFails ? err<number>(domainError('unknown', 'No free port.')) : ok(8_100)),
    },
    secrets: { newPassword: () => 'a-generated-password' },
    records: { save },
    createTwin,
    ensure,
    save,
  };

  return value;
};

describe('camera-add', () => {
  it('starts a Twin for the camera and records it', async () => {
    const deps = ports();
    const result = await handleCameraAdd(deps, camera);

    expect(result.ok).toBe(true);
    expect(deps.createTwin).toHaveBeenCalledOnce();
    expect(deps.save).toHaveBeenCalledOnce();
  });

  /**
   * The heart of the rework. Camera configuration — credentials, stream paths,
   * recording mode, retention, the Lens connection — belongs to the Twin's own
   * settings screens. Sending any of it here made the user answer the same
   * questions twice and gave us a second copy to keep in step.
   */
  it('sends no camera configuration to the container', async () => {
    const deps = ports();
    await handleCameraAdd(deps, camera);

    const input = deps.createTwin.mock.calls[0]?.[0];
    expect(input).toBeDefined();
    expect(Object.keys(input ?? {}).sort()).toEqual(['hostPort', 'id', 'imageTag', 'seedPassword', 'seedUsername']);
  });

  it('seeds first-login credentials so the Twin never boots on a known default', async () => {
    const deps = ports();
    await handleCameraAdd(deps, camera);

    expect(deps.createTwin.mock.calls[0]?.[0].seedPassword).toBe('a-generated-password');
  });

  /**
   * The user has to be able to find these again: the Twin consumes them on
   * first boot and forces a change, so a screen that forgets them locks them
   * out of their own camera (Contract 2 rule 6).
   */
  it('keeps the first-login credentials on the record', async () => {
    const deps = ports();
    const result = await handleCameraAdd(deps, camera);

    expect(result.ok && result.value.camera.firstLoginPassword).toBe('a-generated-password');
    expect(result.ok && result.value.camera.firstLoginUsername).toBe('admin');
  });

  it('derives the container name from the address, so one camera cannot get two Twins', async () => {
    const deps = ports();
    await handleCameraAdd(deps, camera);

    expect(deps.createTwin.mock.calls[0]?.[0].id).toBe('twin-192-168-2-205');
  });

  it('names the camera from its model until the user renames it in the Twin', async () => {
    const result = await handleCameraAdd(ports(), camera);

    expect(result.ok && result.value.camera.displayName).toBe('TC71');
  });

  it('stops if the camera software cannot be downloaded', async () => {
    const deps = ports({ ensureFails: true });
    const result = await handleCameraAdd(deps, camera);

    expect(result.ok).toBe(false);
    expect(deps.createTwin).not.toHaveBeenCalled();
  });

  /** A Twin with no port must fail before it exists, not half-exist. */
  it('stops if no port can be allocated', async () => {
    const deps = ports({ portFails: true });
    const result = await handleCameraAdd(deps, camera);

    expect(result.ok).toBe(false);
    expect(deps.createTwin).not.toHaveBeenCalled();
  });

  it('records nothing when the container fails to start', async () => {
    const deps = ports({ createFails: true });
    const result = await handleCameraAdd(deps, camera);

    expect(result.ok).toBe(false);
    expect(deps.save).not.toHaveBeenCalled();
  });

  it('reports progress in words a non-technical user can read', async () => {
    const steps: string[] = [];
    await handleCameraAdd(ports(), camera, (step) => steps.push(step));

    expect(steps.length).toBeGreaterThan(0);
    for (const step of steps) {
      for (const word of ['Docker', 'container', 'Twin', 'image']) {
        expect(step).not.toContain(word);
      }
    }
  });
});
