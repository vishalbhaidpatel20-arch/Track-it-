import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const root = path.resolve(import.meta.dirname, '..');

// Uses your installed Google Chrome (no browser download). Ports differ from dev (5000/5173) so both can run at once.
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: 'chrome' }, testIgnore: /mobile\.spec\.js/ },
    { name: 'mobile', use: { ...devices['Pixel 7'], channel: 'chrome' }, testMatch: /mobile\.spec\.js/ },
  ],
  webServer: [
    {
      command: 'node start-api.js',
      cwd: import.meta.dirname,
      url: 'http://localhost:5055/api/health',
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      command: 'npx vite --port 5174 --strictPort',
      cwd: path.join(root, 'client'),
      env: { VITE_PROXY_TARGET: 'http://localhost:5055' },
      url: 'http://localhost:5174',
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
