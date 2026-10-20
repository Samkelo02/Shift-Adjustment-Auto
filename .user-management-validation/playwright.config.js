import path from 'node:path';
import { defineConfig } from '@playwright/test';
import baseConfig from '../playwright.config.js';
export default defineConfig({
  ...baseConfig,
  testDir: '.',
  testMatch: 'user-management.spec.js',
  globalSetup: path.resolve('tests/support/global-setup.js'),
  outputDir: path.resolve('test-results/user-management-validation'),
  retries: 0,
  use: { ...baseConfig.use, headless: true },
});
