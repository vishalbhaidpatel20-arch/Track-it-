import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The API address can be overridden (used by the end-to-end tests, which run their own backend).
const target = process.env.VITE_PROXY_TARGET || 'http://localhost:5000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': target,
      '/socket.io': { target, ws: true },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{js,jsx}'],
  },
});
