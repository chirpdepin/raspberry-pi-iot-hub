/// <reference types="vite/client" />

import type { ChirpHubApi } from '@shared/ipc';

/**
 * What `preload` exposes. Declared so the renderer has a typed view of the IPC
 * contract without importing anything from main — the boundary the checker
 * enforces and the reason shared/ipc.ts holds types only.
 */
declare global {
    interface Window {
        chirpHub: ChirpHubApi;
    }
}

export {};
