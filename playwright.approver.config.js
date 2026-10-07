import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config.js';
import { authProfile } from './tests/support/auth-profiles.js';

export default defineConfig({
  ...baseConfig,
  metadata: { ...baseConfig.metadata, authRole: 'approver' },
  testIgnore: [],
  testMatch: [
    '**/approver/*.spec.js',
    '**/admin/approve-shift-adjustment.spec.js',
    '**/admin/reject-shift-adjustment.spec.js',
    '**/admin/request-recapture.spec.js',
  ],
  retries: 0,
  use: { ...baseConfig.use, storageState: authProfile('approver').file },
  projects: baseConfig.projects.map(project => ({
    ...project,
    name: 'approver',
  })),
});
