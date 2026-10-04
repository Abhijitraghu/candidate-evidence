import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests', testMatch: '*.spec.ts', workers: 1,
  timeout: 180000, expect: { timeout: 10000 },
  use: { baseURL: 'http://127.0.0.1:5173', channel: 'chrome', headless: true, trace: 'off', screenshot: 'off' },
  webServer: { command: 'npm run dev', url: 'http://127.0.0.1:5173', reuseExistingServer: true },
});
