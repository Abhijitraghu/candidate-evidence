import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests', testMatch: '*.spec.ts', workers: 1,
  timeout: 180000, expect: { timeout: 10000 },
  use: { baseURL: process.env.LIVE_URL || 'http://127.0.0.1:5174', channel: 'chrome', headless: true, trace: 'off', screenshot: 'off' },
  webServer: process.env.LIVE_URL ? undefined : { command: 'npm run dev -- --port 5174', url: 'http://127.0.0.1:5174', reuseExistingServer: false },
});
