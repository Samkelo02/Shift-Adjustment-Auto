import { test, expect } from '@playwright/test';
import { HomePage } from '../pages/home.page.js';
import { AdminAdjustmentsPage } from '../pages/admin-adjustments.page.js';

test.describe('Shift adjustment draft deletion', () => {
  // A retry could delete a second draft.
  test.describe.configure({ retries: 0 });

  test('Delete shift adjustment', async ({ page }) => {
    test.setTimeout(240_000);
    page.setDefaultTimeout(60_000);
    const home = new HomePage(page);
    const adjustments = new AdminAdjustmentsPage(page);
    let draft;

    await test.step('Navigate to Shift Adjustment and filter by Draft', async () => {
      await home.goto();
      const tab = page.getByRole('tab', { name: 'Shift Adjustment', exact: true });
      await tab.click();
      await expect(tab).toHaveAttribute('aria-selected', 'true');
      await expect(page).toHaveURL(url => url.pathname === '/shift-adjustments');
      await expect(page.getByRole('heading', { name: /Shift Adjustments \(\d+\)/ }))
        .toBeVisible({ timeout: 60_000 });
      await adjustments.clearFilters();
      await adjustments.selectStatus('Draft');
      await adjustments.expectFilteredAdjustments(['Draft']);
    });

    await test.step('Select a draft adjustment from the list', async () => {
      draft = await adjustments.openFirstDraftAdjustment();
      test.info().annotations.push({ type: 'adjustment', description: draft.reference });
    });

    await test.step('Delete the selected draft adjustment', async () => {
      await adjustments.deleteDraftAdjustment(draft.id);
    });

    await test.step('Verify the selected draft is deleted', async () => {
      await adjustments.expectDraftDeleted(draft.reference);
    });
  });
});
