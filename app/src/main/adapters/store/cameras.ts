import Store from 'electron-store';

import type { Camera } from '../../domain/camera';
import type { CameraRecordsPort } from '../../usecase/camera-list/contract';

/**
 * The configured cameras, on disk.
 *
 * Deliberately **not** encrypted, unlike the session token: this holds a
 * display name, an address and a port, and no credentials at all. The camera
 * password lives only in the Twin's own config.json, written once by
 * `camera-add` and never read back — so there is nothing here worth a keychain
 * round-trip on every list refresh.
 */

interface CamerasSchema {
  cameras: Camera[];
}

export const createCameraStore = (): CameraRecordsPort => {
  const store = new Store<CamerasSchema>({ name: 'cameras', defaults: { cameras: [] } });

  return {
    async all(): Promise<Camera[]> {
      return store.get('cameras');
    },

    async save(camera: Camera): Promise<void> {
      const existing = store.get('cameras').filter((c) => c.id !== camera.id);

      // `online` is not persisted as truth — the list use case overwrites it
      // from the container runtime — but storing it keeps the shape whole.
      store.set('cameras', [...existing, camera]);
    },

    async remove(id: string): Promise<void> {
      store.set(
        'cameras',
        store.get('cameras').filter((camera) => camera.id !== id)
      );
    },
  };
};
