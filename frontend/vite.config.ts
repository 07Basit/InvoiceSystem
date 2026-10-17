import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import path from 'path';

// DEV_HTTPS=true serves the dev site over HTTPS with a throwaway self-signed certificate.
// Phones only allow some features (sharing a file to other apps, for example) on HTTPS pages,
// so run `pnpm --filter frontend dev:phone` to test those on a phone.
const https = process.env['DEV_HTTPS'] === 'true';

export default defineConfig({
  // the https server keeps its own dependency cache so it never clashes with the normal dev server
  cacheDir: https ? 'node_modules/.vite-https' : 'node_modules/.vite',
  plugins: [react(), ...(https ? [basicSsl()] : [])],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      shared: path.resolve(__dirname, '../shared/src'),
    },
  },
  server: {
    // The normal dev site answers on this computer only. `pnpm --filter frontend dev:phone` (https) opens it to
    // the local network so a phone on the same Wi-Fi can reach it.
    host: 'localhost',
    port: 5173,
    strictPort: https,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        // pass the real client address on, so the API can tell this computer from a phone
        xfwd: true,
      },
    },
  },
});
