import { test } from '@playwright/test';
import { adjustmentData, datesAreExplicit, randomTestDates } from '../fixtures/test-data.js';
import { HomePage } from '../pages/home.page.js';
import { NewShiftAdjustmentPage } from '../pages/new-shift-adjustment.page.js';

test.describe('Shift adjustment submission', () => {
  test.skip(
    !adjustmentData.attachmentPath,
    'Set TEST_ATTACHMENT_PATH to run this data-changing test.',
  );

  test('submits a paid sick-leave adjustment', async ({ page }) => {
    // Slow PCs wait for real UI readiness without a test or action deadline.
    test.setTimeout(0);
    page.setDefaultTimeout(0);
    page.setDefaultNavigationTimeout(0);
    const homePage = new HomePage(page, { timeout: 0 });
    const adjustmentPage = new NewShiftAdjustmentPage(page);
    const data = { ...adjustmentData };
    const triedDates = new Set();
    const maxAttempts = datesAreExplicit ? 1 : 5;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      triedDates.add(data.startDate);
      console.log(`Attempt ${attempt}: ${data.startDate} to ${data.endDate}`);

      await test.step(`Open a new adjustment (attempt ${attempt})`, async () => {
        await homePage.goto();
        await homePage.startNewAdjustment();
        await adjustmentPage.selectEmployee(data.employeeSearch, data.employeeOption);
      });

      await test.step('Complete and verify adjustment details', async () => {
        await adjustmentPage.complete(data);
        await adjustmentPage.verifyDetails(data);
      });

      const outcome = await test.step('Submit and verify result', async () => adjustmentPage.submit());
      if (outcome === 'submitted') return;
      console.log(`Date range ${data.startDate} to ${data.endDate} already exists.`);
      if (datesAreExplicit) {
        throw new Error(`An adjustment already exists for ${data.startDate} to ${data.endDate}.`);
      }
      if (attempt === maxAttempts) {
        throw new Error(`All ${maxAttempts} date ranges already have adjustments.`);
      }
      Object.assign(data, randomTestDates(triedDates));
    }
  });
});
