import { test, expect } from '@playwright/test';
import { HomePage } from '../../pages/home.page.js';
import { AdminAdjustmentsPage } from '../../pages/admin-adjustments.page.js';

test.describe('Shift adjustment recapture', () => {
  // A retry could request recapture for a second adjustment.
  test.describe.configure({ retries: 0 });

  test('Request Recapture', async ({ page }) => {
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

    await test.step('Request recapture for the selected adjustment', async () => {
      await adjustments.requestRecaptureAdjustment(
        process.env.TEST_RECAPTURE_REASON ?? 'Additional Information Required',
        process.env.TEST_RECAPTURE_COMMENT ??
          'The submitted shift adjustment does not contain sufficient supporting information to validate the request. Please review the details, provide the required supporting documentation, and resubmit the adjustment for approval',
      );
    });

    await test.step('Verify the selected adjustment is saved as Recapture Requested', async () => {
      await adjustments.expectRecaptureRequestedAdjustment(reference);
    });
  });
});
