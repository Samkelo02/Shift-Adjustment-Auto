import { test, expect } from '@playwright/test';
import { MasterDataPage } from '../tests/pages/master-data.page.js';
import { verifyUserManagementQueries, verifyUserManagementColumns } from '../tests/support/user-management-checks.js';
import { verifyUserManagementLifecycle } from '../tests/support/user-management-lifecycle.js';
test.beforeEach(async ({ page }) => {
  test.setTimeout(120_000);
  page.setDefaultTimeout(60_000);
  const [userResponse] = await Promise.all([
    page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/master-data/user/Users'
      && response.request().method() === 'GET', { timeout: 60_000 }),
    page.goto('/home', { waitUntil: 'domcontentloaded' }),
  ]);
  expect(userResponse.ok(), 'Authenticated user data must load before opening configuration').toBe(true);
  await expect(page.getByRole('heading', { name: 'Recent Activities', exact: true })).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: 'switch', exact: true }).click();
  await page.locator('#switch-confirmations-confirm-button').click();
  await expect(page).toHaveURL(/\/admin\/reference/);
});
test('User Management filters, search, reset, and pagination', async ({ page }) => {
  test.setTimeout(600_000);
  await verifyUserManagementQueries(new MasterDataPage(page));
});
test('User Management downloads and column settings', async ({ page }) => {
  test.setTimeout(300_000);
  const master = new MasterDataPage(page);
  await master.openSection('User Management', '/admin/user-management');
  await master.waitForTable();
  await master.clearFilters();
  await master.verifyDownloads();
  await verifyUserManagementColumns(master);
});
test('User Management activation, edit Cancel, role update and restoration, deactivation', async ({ page }) => {
  test.setTimeout(600_000);
  const master = new MasterDataPage(page);
  await master.openSection('User Management', '/admin/user-management');
  await verifyUserManagementLifecycle(master);
});
