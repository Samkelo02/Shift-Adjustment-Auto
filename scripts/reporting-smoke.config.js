import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: 'reporting-smoke.spec.js', outputDir: '../.report-validation/results',
  workers: 1, retries: 0, reporter: [['list'], ['./regression-reporter.js']],
  projects: [{ name: 'admin', use: { browserName: 'chromium', headless: true } }],
});
