import { test, expect } from '../../support/regression-test.js';
import { HomePage } from '../../pages/home.page.js';
import { AdminAdjustmentsPage } from '../../pages/admin-adjustments.page.js';
import { NewShiftAdjustmentPage } from '../../pages/new-shift-adjustment.page.js';

test.describe('Recalled adjustment submission', () => {
  // Retrying could submit a second recalled adjustment.
  test.describe.configure({ retries: 0 });

  test('Submit a recalled adjustment for approval', async ({ page }) => {
    test.setTimeout(240_000);
    page.setDefaultTimeout(60_000);
    const home = new HomePage(page);
    const adjustments = new AdminAdjustmentsPage(page);
    const form = new NewShiftAdjustmentPage(page);
    let reference;

    test.info().annotations.push(
      { type: 'prerequisite', description: 'An existing Recalled adjustment accessible to Employee Benefits with complete submission details.' },
      { type: 'expected-result', description: 'The selected recalled adjustment is submitted for approval and the same reference is listed as Submitted.' },
    );

    await test.step('Find recalled adjustments in the Shift Adjustment list', async () => {
      await home.goto();
      await page.getByRole('tab', { name: 'Shift Adjustment', exact: true }).click();
      await expect(page).toHaveURL(url => url.pathname === '/shift-adjustments');
      await adjustments.clearFilters();
      await page.getByRole('textbox', { name: 'Search', exact: true }).clear();
      await adjustments.selectStatus('Recalled');
      await adjustments.expectFilteredAdjustments(['Recalled']);
    });

    await test.step('Open a recalled adjustment for editing', async () => {
      const rows = await adjustments.expectFilteredAdjustments(['Recalled']);
      reference = (await rows.first().innerText()).match(/SA-ADJ-\d{4}-\d+/)?.[0];
      expect(reference, 'The recalled adjustment must have a reference number').toBeTruthy();
      const selectedRow = rows.filter({
        has: page.getByRole('gridcell', { name: reference, exact: true }),
      });
      await expect(selectedRow).toHaveCount(1);
      await selectedRow.click();
      await expect(page).toHaveURL(url =>
        url.pathname === '/shift-adjustments/create' && Boolean(url.searchParams.get('id')),
      );
      await expect(page.getByText('Submit for Approval', { exact: true }).first()).toBeVisible();
      test.info().annotations.push({ type: 'adjustment', description: reference });
    });

    await test.step('Submit the recalled adjustment for approval', async () => {
      expect(await form.submit(), 'The existing recalled adjustment must submit successfully')
        .toBe('submitted');
    });

    await test.step('Verify the same adjustment is saved as Submitted', async () => {
      await home.goto();
      await page.getByRole('tab', { name: 'Shift Adjustment', exact: true }).click();
      await expect(page).toHaveURL(url => url.pathname === '/shift-adjustments');
      await adjustments.clearFilters();
      await adjustments.selectStatus('Submitted');
      await page.getByRole('textbox', { name: 'Search', exact: true }).fill(reference);
      const row = page.locator('[role="rowgroup"]:visible [role="row"]').filter({
        has: page.getByRole('gridcell', { name: reference, exact: true }),
      });
      await expect(row).toHaveCount(1, { timeout: 60_000 });
      await expect(row).toContainText(/\bSubmitted\b/, { timeout: 60_000, useInnerText: true });
    });
  });
});
