import { safeStorage } from 'electron';
import Store from 'electron-store';

import type { Camera } from '../../domain/camera';
import type { CameraRecordsPort } from '../../usecase/camera-list/contract';

/**
 * The configured cameras, on disk.
 *
 * **The first-login password is encrypted at rest** with Electron's safeStorage,
 * which uses the OS keychain where one exists — the same treatment the Chirp
 * session token gets, and for the same reason: it is a credential, and a
 * credential in plaintext on disk is one anyone with filesystem access can lift.
 *
 * It is held at all because the Twin consumes it on first boot and forces a
 * change at first login, so a user who closes the app before writing it down
 * would otherwise be locked out of their own camera with no way back
 * (Contract 2 rule 6). It stops being useful the moment they set their own.
 *
 * Everything else here — display name, address, port — is not sensitive and is
 * stored plainly, so a list refresh does not pay for a keychain round-trip per
 * camera.
 */

/** The stored shape: as `Camera`, but with the password encrypted. */
type StoredCamera = Omit<Camera, 'firstLoginPassword'> & { encryptedFirstLoginPassword?: string };

interface CamerasSchema {
  cameras: StoredCamera[];
}

const encrypt = (value: string): string | undefined => {
  try {
    return safeStorage.encryptString(value).toString('base64');
  } catch {
    // No keychain available. Dropping the password loses a convenience, while
    // writing it in plaintext would quietly break the promise above.
    return undefined;
  }
};

const decrypt = (value: string | undefined): string => {
  if (!value) return '';

  try {
    return safeStorage.decryptString(Buffer.from(value, 'base64'));
  } catch {
    // A machine change or keychain reset invalidates it. The user has almost
    // certainly set their own password by then; an empty string renders as
    // "not available" rather than crashing the camera list.
    return '';
  }
};

export const createCameraStore = (): CameraRecordsPort => {
  const store = new Store<CamerasSchema>({ name: 'cameras', defaults: { cameras: [] } });

  return {
    async all(): Promise<Camera[]> {
      return store.get('cameras').map(({ encryptedFirstLoginPassword, ...camera }) => ({
        ...camera,
        firstLoginPassword: decrypt(encryptedFirstLoginPassword),
      }));
    },

    async count(): Promise<number> {
      return store.get('cameras').length;
    },

    async save(camera: Camera): Promise<void> {
      const { firstLoginPassword, ...rest } = camera;
      const existing = store.get('cameras').filter((entry) => entry.id !== camera.id);

      // `online` is not persisted as truth — the list use case overwrites it
      // from the container runtime — but storing it keeps the shape whole.
      store.set('cameras', [...existing, { ...rest, encryptedFirstLoginPassword: encrypt(firstLoginPassword) }]);
    },

    async remove(id: string): Promise<void> {
      store.set(
        'cameras',
        store.get('cameras').filter((camera) => camera.id !== id)
      );
    },
  };
};
