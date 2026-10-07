import { test, expect } from '@playwright/test';
import { HomePage } from '../../pages/home.page.js';

async function expectHome(page) {
  await expect(page).toHaveURL(url => url.pathname === '/home');
  await expect(page.getByRole('tab', { name: 'Home', exact: true }))
    .toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: /^Good .*!$/ })).toBeVisible();
  for (const title of [
    'My Total Submissions Reviewed', 'My Approval Rate', 'My Approval Time',
    'Pending My Review', 'My Recent Reviews',
  ]) {
    await expect(page.getByText(title, { exact: true })).toBeVisible();
  }
}

async function expectAdjustments(page) {
  await expect(page).toHaveURL(url => url.pathname === '/shift-adjustments');
  await expect(page.getByRole('tab', { name: 'Shift Adjustment', exact: true }))
    .toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: /Shift Adjustments \(\d+\)/ })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Search', exact: true })).toBeVisible();
  await expect(page.locator('ui5-busy-indicator[active]:visible')).toHaveCount(0);
}

test('Approver Home Page Navigation', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  page.setDefaultTimeout(60_000);
  expect(testInfo.project.name, 'Run with npm run test:approver').toBe('approver');
  const home = new HomePage(page);

  await test.step('Open Home and check the approver dashboard', async () => {
    await home.goto();
    await expectHome(page);
  });

  await test.step('Navigate to Shift Adjustment and return to Home', async () => {
    await page.getByRole('tab', { name: 'Shift Adjustment', exact: true }).click();
    await expectAdjustments(page);
    await home.returnHome();
    await expectHome(page);
  });

  await test.step('Use browser back and forward between Shift Adjustment and Home', async () => {
    await page.goBack();
    await expectAdjustments(page);
    await page.goForward();
    await expectHome(page);
  });
});
