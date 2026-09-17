import { test, expect } from '@playwright/test';

test.use({
  storageState: 'playwright/.auth/user.json'
});

test('test', async ({ page }) => {
  await page.goto('https://shift-adjustment-test.cfapps.eu10-005.hana.ondemand.com/home');
  await page.locator('div').filter({ hasText: /^Total Pending Approval0across all users$/ }).nth(2).click();
  await page.getByRole('tab', { name: 'Home' }).click();
  await page.locator('div').filter({ hasText: /^Total Posting Failed36across all users$/ }).nth(2).click();
  await page.locator('.inputIcon').first().click();
  await page.getByRole('option', { name: 'Multiple Selection Mode Approved' }).getByLabel('Multiple Selection Mode').click();
  await page.locator('ui5-mcb-item:nth-child(8) > .ui5-li-root > ui5-checkbox > .ui5-checkbox-root').first().click();
  await page.locator('ui5-mcb-item:nth-child(10) > .ui5-li-root > ui5-checkbox > .ui5-checkbox-root').first().click();
  await page.locator('[id="absence type-filter"] > .ui5-multi-combobox-root > .inputIcon').click();
  await page.getByRole('option', { name: 'Multiple Selection Mode Accumulated Leave CD' }).getByRole('checkbox').click();
  await page.getByRole('option', { name: 'Multiple Selection Mode Accumulated Leave CD' }).getByRole('checkbox').click();
  await page.locator('[id="absence type-filter"] > ui5-mcb-item:nth-child(8) > .ui5-li-root > ui5-checkbox > .ui5-checkbox-root').click();
  await page.locator('[id="absence type-filter"] > ui5-mcb-item:nth-child(8) > .ui5-li-root > ui5-checkbox > .ui5-checkbox-root').click();
  await page.locator('[id="personnel area-filter"] > .ui5-multi-combobox-root > .inputIcon').click();
  //await page.locator('[id="personnel area-filter"] > ui5-mcb-item:nth-child(13) > .ui5-li-root > ui5-checkbox > .ui5-checkbox-root').click();
  //await page.locator('[id="personnel area-filter"] > ui5-mcb-item:nth-child(13) > .ui5-li-root > ui5-checkbox > .ui5-checkbox-root').click();
  await page.getByRole('tab', { name: 'Insights' }).click();
  //await page.locator('.inputIcon > .ui5-icon-root').click();
  //await page.locator('#ui5wc_1534-content > .ui5-li-text-wrapper').click();
});