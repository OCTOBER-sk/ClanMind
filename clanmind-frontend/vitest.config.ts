import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // Mirror the app-level vite `define`s so modules importing src/config/env
  // (and other compile-time-gated code) load under vitest exactly as in the
  // real build pipeline.
  define: {
    __APP_VERSION__: JSON.stringify('0.0.0-test'),
    __DEMO_MODE__: JSON.stringify(true),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.test.{ts,tsx}'],
  },
});