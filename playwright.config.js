import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env.CI);
const authFile = path.resolve('playwright/.auth/user.json');

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/support/global-setup.js',
  outputDir: 'test-results',
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  // These tests share server-side data, so serial execution is intentional.
  workers: 1,
  reporter: isCI
    ? [['line'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL:
      process.env.SHIFT_ADJUSTMENT_BASE_URL ||
      'https://shift-adjustment-test.cfapps.eu10-005.hana.ondemand.com',
    storageState: authFile,
    headless: isCI,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
