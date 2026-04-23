import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// The base path is configurable so this app can be mounted under
// /tracking (or anywhere) inside the parent admin dashboard build.
//   VITE_APP_BASE=/tracking npm run build
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: process.env.VITE_APP_BASE ?? '/',
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  server: {
    port: 5173,
    proxy: mode === 'development'
      ? {
          // In dev, proxy /api to the tracking backend so cookies/origin work
          // without configuring CORS specifically for the dev origin.
          '/api': {
            target: process.env.VITE_API_PROXY ?? 'http://localhost:3000',
            changeOrigin: true,
          },
        }
      : undefined,
  },
}));
