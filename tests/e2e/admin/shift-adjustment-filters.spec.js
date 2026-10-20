import { test, expect } from '../../support/regression-test.js';
import { adminFilterData } from '../../fixtures/test-data.js';
import { AdminAdjustmentsPage } from '../../pages/admin-adjustments.page.js';
import { HomePage } from '../../pages/home.page.js';

test('Administrator adjustment search and filters', async ({ page }) => {
  test.setTimeout(180_000);
  const home = new HomePage(page);
  const adjustments = new AdminAdjustmentsPage(page);
  await home.goto();
  await home.openPendingApprovals();
  await expect(page).toHaveURL(url => url.pathname === '/shift-adjustments');
  await test.step('Search and apply status and absence-type filters', async () => {
    await adjustments.exerciseSearch('SA-ADJ');
    await adjustments.selectStatus(adminFilterData.status);
    await adjustments.selectAbsenceType(adminFilterData.absenceType);
    await adjustments.clearFilters();
  });
  await home.returnHome();
  await expect(page).toHaveURL(url => url.pathname === '/home');
  await expect(home.homeTab).toHaveAttribute('aria-selected', 'true');
});
