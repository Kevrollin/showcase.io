import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const alias = { '@': fileURLToPath(new URL('./src', import.meta.url)) };

export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'jsdom',
          include: ['src/**/*.test.{ts,tsx}', 'tests/api/**/*.test.ts'],
          setupFiles: ['./src/test/setup.ts'],
          css: false,
        },
      },
      {
        extends: true,
        test: {
          name: 'db',
          environment: 'node',
          include: ['tests/db/**/*.test.ts'],
          testTimeout: 60_000,
          hookTimeout: 120_000,
          // Each file boots its own PGlite (WASM Postgres, a few hundred MB);
          // run them one at a time so low-memory machines and CI stay stable.
          fileParallelism: false,
        },
      },
    ],
  },
});
