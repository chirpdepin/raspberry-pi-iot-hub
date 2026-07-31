import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

/**
 * Three separate builds, matching the three-process split in app/electron.md.
 *
 * The renderer deliberately gets NO Node polyfills and no access to main/ —
 * everything it needs arrives through the preload IPC contract. The boundary
 * checker enforces that; this config makes accidental violations fail at build
 * time too.
 */
export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts'),
          // Built separately so tests can import the real dependency graph
          // without index.ts opening a window as a side effect.
          composition: resolve(__dirname, 'src/main/composition.ts'),
          ipc: resolve(__dirname, 'src/main/ipc/register.ts'),
        },
        // `electron` MUST stay external. externalizeDepsPlugin only
        // externalizes `dependencies`, and electron is a devDependency —
        // so without this the bundler inlines the npm package's Node-side
        // helper (getElectronPath, which shells out to download a binary)
        // instead of leaving the import to resolve to Electron's runtime
        // built-in. The app then fails at launch with a confusing
        // "Electron failed to install correctly".
        external: ['electron'],
      },
    },
    resolve: {
      alias: {
        '@main': resolve(__dirname, 'src/main'),
        '@shared': resolve(__dirname, 'src/shared'),
      },
    },
  },

  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/preload/index.ts') },
        // Same reason as main — see above.
        external: ['electron'],
        // A sandboxed renderer can only load a CommonJS preload; ESM
        // preloads are silently ignored, so `window.chirpHub` never
        // appears and the failure looks like a bridge bug rather than a
        // format one. package.json has "type": "module", so the .cjs
        // extension is what forces CommonJS treatment here.
        output: {
          format: 'cjs',
          entryFileNames: '[name].cjs',
        },
      },
    },
    resolve: {
      alias: { '@shared': resolve(__dirname, 'src/shared') },
    },
  },

  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    plugins: [react()],
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer/src'),
        // @shared carries TYPES ONLY (the IPC contract). It must never pull
        // runtime code from main into the renderer bundle.
        '@shared': resolve(__dirname, 'src/shared'),
      },
    },
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/renderer/index.html') },
      },
    },
  },
});
