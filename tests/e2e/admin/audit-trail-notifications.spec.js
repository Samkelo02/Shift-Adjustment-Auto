import { test, expect } from '@playwright/test';
import { HomePage } from '../../pages/home.page.js';
import { AdminAdjustmentsPage } from '../../pages/admin-adjustments.page.js';

test('Navigate through Audit Trail & Notifications', async ({ page }) => {
  test.setTimeout(240_000);
  page.setDefaultTimeout(60_000);
  const home = new HomePage(page);
  const adjustments = new AdminAdjustmentsPage(page);
  let statuses;
  let reference;

  await test.step('Navigate to Shift Adjustment and select all statuses except Pending', async () => {
    await home.goto();
    const tab = page.getByRole('tab', { name: 'Shift Adjustment', exact: true });
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    await expect(page).toHaveURL(url => url.pathname === '/shift-adjustments');
    await expect(page.getByRole('heading', { name: /Shift Adjustments \(\d+\)/ }))
      .toBeVisible({ timeout: 60_000 });
    await adjustments.clearFilters();
    statuses = await adjustments.selectAllStatusesExceptPending();
    await adjustments.expectFilteredAdjustments(statuses);
  });

  await test.step('Select an adjustment with history actions from the filtered list', async () => {
    reference = await adjustments.openFirstAdjustmentWithHistory(statuses);
    test.info().annotations.push({ type: 'adjustment', description: reference });
  });

  for (const section of ['Audit Trail', 'Notifications']) {
    await test.step('Open, navigate, and close ' + section, async () => {
      const count = await adjustments.navigateAdjustmentHistory(section, reference);
      test.info().annotations.push({ type: section, description: count + ' timeline entries' });
    });
  }
});
