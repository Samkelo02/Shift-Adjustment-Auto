import { test, expect } from '@playwright/test';
import { HomePage } from '../../pages/home.page.js';
import { AdminAdjustmentsPage } from '../../pages/admin-adjustments.page.js';

test.describe('Shift adjustment cancellation', () => {
  // A retry could cancel a second adjustment.
  test.describe.configure({ retries: 0 });

  test('Cancel shift adjustment', async ({ page }) => {
    test.setTimeout(240_000);
    page.setDefaultTimeout(60_000);
    const home = new HomePage(page);
    const adjustments = new AdminAdjustmentsPage(page);
    let reference;

    await test.step('Navigate to Shift Adjustment and filter by Posting Failed and Submitted', async () => {
      await home.goto();
      const tab = page.getByRole('tab', { name: 'Shift Adjustment', exact: true });
      await tab.click();
      await expect(tab).toHaveAttribute('aria-selected', 'true');
      await expect(page).toHaveURL(url => url.pathname === '/shift-adjustments');
      await expect(page.getByRole('heading', { name: /Shift Adjustments \(\d+\)/ }))
        .toBeVisible({ timeout: 60_000 });
      await adjustments.clearFilters();
      await adjustments.selectStatus('Posting Failed');
      await adjustments.selectStatus('Submitted');
      await adjustments.expectFilteredAdjustments(['Posting Failed', 'Submitted']);
    });

    await test.step('Select a submitted or posting failed adjustment from the list', async () => {
      reference = await adjustments.openFirstFilteredAdjustment(['Posting Failed', 'Submitted']);
      test.info().annotations.push({ type: 'adjustment', description: reference });
    });

    await test.step('Cancel the selected adjustment', async () => {
      await adjustments.cancelAdjustment(
        process.env.TEST_CANCELLATION_REASON ?? 'Administrative Cancellation',
        process.env.TEST_CANCELLATION_COMMENT ??
          'Cancelled during automated cancellation workflow validation.',
      );
    });

    await test.step('Verify the selected adjustment is saved as Cancelled', async () => {
      await adjustments.expectCancelledAdjustment(reference);
    });
  });
});
