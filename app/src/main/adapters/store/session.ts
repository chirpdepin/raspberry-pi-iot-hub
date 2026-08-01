import { safeStorage } from 'electron';
import Store from 'electron-store';

import type { ChirpAuth } from '../chirp/gateway-client';

/**
 * Chirp session token.
 *
 * Encrypted at rest with Electron's safeStorage, which uses the OS keychain
 * where one exists. A bearer token in plaintext on disk is a credential anyone
 * with filesystem access can lift.
 */

interface SessionSchema {
  encryptedToken?: string;
}

const store = new Store<SessionSchema>({ name: 'session' });

export const createSessionStore = (): ChirpAuth & {
  setToken(token: string | null): void;
} => ({
  token(): string | null {
    const encrypted = store.get('encryptedToken');
    if (!encrypted) return null;

    try {
      return safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
    } catch {
      // A machine change or keychain reset invalidates it; treat as signed out
      // rather than crashing on every request.
      return null;
    }
  },

  setToken(token: string | null): void {
    if (!token) {
      store.delete('encryptedToken');
      return;
    }

    store.set('encryptedToken', safeStorage.encryptString(token).toString('base64'));
  },
});
