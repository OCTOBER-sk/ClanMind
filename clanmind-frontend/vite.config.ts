import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8')) as {
  version: string;
};

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const loadedEnv = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)));
  // Compile-time demo gate — lets bundlers eliminate src/mocks entirely
  // from production output (bible rule 12).
  const demoMode = ['1', 'true'].includes(loadedEnv.VITE_DEMO_MODE ?? '');

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __DEMO_MODE__: JSON.stringify(demoMode),
    },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // Tauri 2 expects a fixed dev port and clears the screen-less output.
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    // Dev-only same-origin proxy to the Worker (live mode). The production
    // deploy serves the Worker behind the same host, so this mirrors prod.
    proxy: {
      '/api/v1': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        ws: true,
      },
    },
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
    // Tauri env vars should be exposed to the client.
    envPrefix: ['VITE_', 'TAURI_'],
  };
});
