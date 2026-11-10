import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Served by the API at /guest/ in production. In development the API runs on :4000 and is proxied so the httpOnly refresh cookie stays same-origin.
const api = process.env.VITE_PROXY_TARGET ?? 'http://localhost:4000';
export default defineConfig({
  base: '/guest/',
  plugins: [react()],
  server: { port: 5177, proxy: { '/api': api, '/uploads': api } },
  preview: { port: 5177, proxy: { '/api': api, '/uploads': api } },
});
