import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// In development the API runs on :4000. Proxying keeps cookies same-origin (needed for the httpOnly refresh cookie + CSRF cookie).
const api = process.env.VITE_PROXY_TARGET ?? 'http://localhost:4000';
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: { port: 5173, proxy: { '/api': api, '/uploads': api } },
  preview: { port: 5173, proxy: { '/api': api, '/uploads': api } },
});
