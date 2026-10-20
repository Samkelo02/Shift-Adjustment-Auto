import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config.js';
import { authProfile } from './tests/support/auth-profiles.js';

export default defineConfig({
  ...baseConfig,
  metadata: { ...baseConfig.metadata, authRole: 'employee-benefits' },
  testIgnore: [],
  testMatch: ['**/employee-benefits/*.spec.js'],
  retries: 0,
  use: { ...baseConfig.use, storageState: authProfile('employee-benefits').file },
  projects: baseConfig.projects.map(project => ({ ...project, name: 'employee-benefits' })),
});
