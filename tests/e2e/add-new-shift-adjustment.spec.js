import { test } from '@playwright/test';
import { adjustmentData } from '../fixtures/test-data.js';
import { HomePage } from '../pages/home.page.js';
import { NewShiftAdjustmentPage } from '../pages/new-shift-adjustment.page.js';

test.describe('Shift adjustment submission', () => {
  test.skip(
    !adjustmentData.attachmentPath,
    'Set TEST_ATTACHMENT_PATH to run this data-changing test.',
  );

  test('submits a paid sick-leave adjustment', async ({ page }) => {
    const homePage = new HomePage(page);
    const adjustmentPage = new NewShiftAdjustmentPage(page);

    await test.step('Open a new adjustment for the employee', async () => {
      await homePage.goto();
      await homePage.startNewAdjustment();
      await adjustmentPage.selectEmployee(
        adjustmentData.employeeSearch,
        adjustmentData.employeeOption,
      );
    });

    await test.step('Complete the adjustment details', async () => {
      await adjustmentPage.complete(adjustmentData);
    });

    await test.step('Submit and verify success', async () => {
      await adjustmentPage.submit();
    });
  });
});
