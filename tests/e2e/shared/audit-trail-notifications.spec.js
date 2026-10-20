import { test, expect } from '../../support/regression-test.js';
import { HomePage } from '../../pages/home.page.js';
import { AdminAdjustmentsPage } from '../../pages/admin-adjustments.page.js';

test('Navigate through Audit Trail & Notifications', async ({ page }) => {
  test.setTimeout(240_000);
  page.setDefaultTimeout(60_000);
  const home = new HomePage(page);
  const adjustments = new AdminAdjustmentsPage(page);
  let reference;

  await test.step('Navigate to the Shift Adjustment list', async () => {
    await home.goto();
    const tab = page.getByRole('tab', { name: 'Shift Adjustment', exact: true });
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    await expect(page).toHaveURL(url => url.pathname === '/shift-adjustments');
    await expect(page.getByRole('heading', { name: /Shift Adjustments \(\d+\)/ }))
      .toBeVisible({ timeout: 60_000 });
    await adjustments.clearFilters();
    await page.getByRole('textbox', { name: 'Search', exact: true }).clear();
  });

  await test.step('Select any adjustment with history actions from the list', async () => {
    reference = await adjustments.openFirstAdjustmentWithHistory();
    test.info().annotations.push({ type: 'adjustment', description: reference });
  });

  for (const section of ['Audit Trail', 'Notifications']) {
    await test.step('Open, navigate, and close ' + section, async () => {
      const count = await adjustments.navigateAdjustmentHistory(section, reference);
      test.info().annotations.push({ type: section, description: count + ' timeline entries' });
    });
  }
});
