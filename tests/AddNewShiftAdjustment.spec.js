import { test, expect } from '@playwright/test';

test.use({
  storageState: 'playwright/.auth/user.json'
});

test('test', async ({ page }) => {
  await page.goto('https://shift-adjustment-test.cfapps.eu10-005.hana.ondemand.com/home');
  await page.getByRole('button', { name: 'Emphasized' }).click();
  await page.getByRole('textbox', { name: 'Search by employee number or' }).click();
  await page.getByRole('textbox', { name: 'Search by employee number or' }).fill('Thomas');
  await page.locator('#employee-selection-accordion').getByRole('button', { name: 'Emphasized' }).click();
  await expect(page.locator('.p-2.sm\\:p-4')).toBeVisible();
  await page.locator('#ui5wc_145-content').click();
  await page.getByTitle('Upload File').setInputFiles('Sick note.png');
  await page.locator('#ui5wc_128-value-help').click();
  await page.getByRole('gridcell', { name: 'September 10,' }).getByText('10').click();
  await page.locator('#ui5wc_130-value-help').click();
  await page.getByRole('gridcell', { name: 'September 10,' }).getByText('10').click();
  await page.locator('.ui5-combobox-root > .inputIcon').click();
  await page.locator('div').filter({ hasText: /^Sick Leave - SICK$/ }).nth(1).click();
  await page.locator('#new-shift-adjustment-absenceTypeId > .ui5-combobox-root > .inputIcon').click();
  await page.getByText('Sick leave Paid').click();
  await page.locator('#new-shift-adjustment-locationTypeId > .ui5-combobox-root > .inputIcon').click();
  await page.locator('div').filter({ hasText: /^Mogalakwena$/ }).nth(1).click();
  await page.locator('#new-shift-adjustment-medicalPractitionerTypeId > .ui5-combobox-root > .inputIcon').click();
  await page.locator('div').filter({ hasText: /^Doctor$/ }).first().click();
  await page.locator('#new-shift-adjustment-doctor-medicalPractitionerId-user-search > .ui5-input-root > .ui5-input-content > .ui5-input-icon-root').click();
  await page.getByRole('textbox', { name: 'Doctor Information' }).click();
  await page.getByRole('textbox', { name: 'Doctor Information' }).fill('Dr');
  await page.getByRole('option', { name: 'Dr fourie 00002678 null •' }).click();
  await page.getByRole('button', { name: 'Emphasized' }).click();
  await page.locator('#confirm-submit-action-modal-confirm-button').getByRole('button', { name: 'Emphasized' }).click();
  await expect(page.locator('.modal-crossfade-panel--inner > .flex > ui5-illustrated-message > .ui5-illustrated-message-root > .ui5-illustrated-message-inner')).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await page.goto('https://shift-adjustment-test.cfapps.eu10-005.hana.ondemand.com/shift-adjustments');
  await page.getByRole('row', { name: 'SA-ADJ-2026-0168 133f9cc2-' }).getByLabel('133f9cc2-38ee-401f-9736-').click();
  await page.getByRole('button', { name: 'Navigate Back' }).click();
});