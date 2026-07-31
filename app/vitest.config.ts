import { defineConfig } from 'vitest/config';

/**
 * Use-case tests only. They run with fake ports and no Electron, which is the
 * proof that Contract 1's layering holds — see app/electron.md.
 */
export default defineConfig({
  test: {
    include: ['src/main/**/*.test.ts'],
    environment: 'node',
  },
});
