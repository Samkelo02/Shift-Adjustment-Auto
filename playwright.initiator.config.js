import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config.js';
import { authProfile } from './tests/support/auth-profiles.js';

export default defineConfig({
  ...baseConfig,
  metadata: { ...baseConfig.metadata, authRole: 'initiator' },
  testIgnore: [],
  testMatch: ['**/initiator/*.spec.js', '**/admin/add-new-shift-adjustment.spec.js'],
  retries: 0,
  use: { ...baseConfig.use, storageState: authProfile('initiator').file },
  projects: baseConfig.projects.map(project => ({
    ...project,
    name: 'initiator',
  })),
});
