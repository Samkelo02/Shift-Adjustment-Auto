import { test, expect } from '@playwright/test';
import { HomePage } from '../pages/home.page.js';
import { AdminAdjustmentsPage } from '../pages/admin-adjustments.page.js';

test.describe('Shift adjustment approval', () => {
  // A retry could approve a second adjustment.
  test.describe.configure({ retries: 0 });

  test('Approve shift adjustment', async ({ page }) => {
    test.setTimeout(240_000);
    page.setDefaultTimeout(60_000);
    const home = new HomePage(page);
    const adjustments = new AdminAdjustmentsPage(page);
    let reference;

    await test.step('Navigate to Shift Adjustment and filter by Submitted', async () => {
      await home.goto();
      const tab = page.getByRole('tab', { name: 'Shift Adjustment', exact: true });
      await tab.click();
      await expect(tab).toHaveAttribute('aria-selected', 'true');
      await expect(page).toHaveURL(url => url.pathname === '/shift-adjustments');
      await expect(page.getByRole('heading', { name: /Shift Adjustments \(\d+\)/ }))
        .toBeVisible({ timeout: 60_000 });
      await adjustments.clearFilters();
      await adjustments.selectStatus('Submitted');
      await adjustments.expectSubmittedAdjustments();
    });

    await test.step('Select a submitted adjustment from the list', async () => {
      reference = await adjustments.openFirstSubmittedAdjustment();
      test.info().annotations.push({ type: 'adjustment', description: reference });
    });

    await test.step('Approve the selected adjustment', async () => {
      await adjustments.approveAdjustment();
    });

    await test.step('Verify the selected adjustment is saved as Approved', async () => {
      await adjustments.expectApprovedAdjustment(reference);
    });
  });
});
