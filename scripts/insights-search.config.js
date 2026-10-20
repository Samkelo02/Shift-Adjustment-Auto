import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: 'insights-search.spec.js',
  outputDir: '../.report-validation/insights-search',
  workers: 1, retries: 0, timeout: 10_000, reporter: 'list',
  use: { headless: true },
});
