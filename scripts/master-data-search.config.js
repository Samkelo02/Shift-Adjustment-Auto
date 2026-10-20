import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.', testMatch: 'master-data-search.spec.js',
  outputDir: '../.report-validation/master-data-search',
  workers: 1, retries: 0, timeout: 10_000, reporter: 'list',
  use: { headless: true },
});
