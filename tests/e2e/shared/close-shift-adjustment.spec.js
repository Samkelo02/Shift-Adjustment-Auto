import { test, expect } from '../../support/regression-test.js';
import { HomePage } from '../../pages/home.page.js';
import { AdminAdjustmentsPage } from '../../pages/admin-adjustments.page.js';

test.describe('Shift adjustment closure', () => {
  // A retry could close a second record.
  test.describe.configure({ retries: 0 });

  test('Close one Posting Failed shift adjustment', async ({ page }, testInfo) => {
    test.setTimeout(240_000);
    page.setDefaultTimeout(60_000);
    expect(testInfo.project.name, 'Run with npm run test:employee-benefits').toBe('employee-benefits');
    const home = new HomePage(page);
    const adjustments = new AdminAdjustmentsPage(page);
    let reference;

    await test.step('Open Shift Adjustment and filter only Posting Failed', async () => {
      await home.goto();
      const tab = page.getByRole('tab', { name: 'Shift Adjustment', exact: true });
      await tab.click();
      await expect(tab).toHaveAttribute('aria-selected', 'true');
      await expect(page).toHaveURL(url => url.pathname === '/shift-adjustments');
      await expect(page.getByRole('heading', { name: /Shift Adjustments \(\d+\)/ }))
        .toBeVisible({ timeout: 60_000 });
      await adjustments.clearFilters();
      await page.getByRole('textbox', { name: 'Search', exact: true }).clear();
      await adjustments.selectStatus('Posting Failed');
      await expect(page.locator('#status-filter ui5-mcb-item[selected]')).toHaveCount(1);
      await expect(page.locator('#status-filter ui5-mcb-item[selected]'))
        .toHaveAttribute('text', 'Posting Failed');
    });

    await test.step('Select one Posting Failed adjustment and retain its reference', async () => {
      reference = await adjustments.openFirstFilteredAdjustment(['Posting Failed']);
      testInfo.annotations.push({ type: 'adjustment', description: reference });
    });

    await test.step('Confirm Close Record (No Action) for the selected adjustment', async () => {
      await adjustments.closeAdjustment();
    });

    await test.step('Verify the same reference is saved as Closed Record (No Action)', async () => {
      await adjustments.expectClosedAdjustment(reference);
    });
  });
});
