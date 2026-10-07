import { test, expect } from '@playwright/test';
import { MasterDataPage } from '../../pages/master-data.page.js';

const email = 'hendrick.makhomisane@valterraplatinum.com';
const name = 'Hendrick Makhomisane';
const usersPath = '/api/v1/master-data/user/Users';

test.describe('User Management lifecycle', () => {
  // Deactivation retains the account, so repeating creation is not safe.
  test.describe.configure({ retries: 0 });

  test('adds a directory user, verifies persistence, and removes active access', async ({ page }) => {
    test.setTimeout(300_000);
    page.setDefaultTimeout(60_000);
    const master = new MasterDataPage(page);
    const row = master.rows.filter({ hasText: email });
    let createdId;

    const readUser = async () => {
      // Match the application's encoding: this endpoint rejects '+' for spaces.
      const query = `$filter=${encodeURIComponent(`email eq '${email}'`)}&$expand=personnelAreas%2Cinsights&$top=2`;
      const response = await page.request.get(new URL(`${usersPath}?${query}`, page.url()).href);
      expect(response.ok(), `User lookup returned HTTP ${response.status()}`).toBe(true);
      const data = await response.json();
      expect(Array.isArray(data.value), 'User lookup must return a record list').toBe(true);
      return data.value;
    };

    const reopenUsers = async () => {
      if (await master.dialog.count()) await master.closeForm();
      await master.openSection('Settings', '/admin/settings');
      await master.openSection('User Management', '/admin/user-management');
      await master.waitForTable();
      await master.clearFilters();
      await master.setSearch(email);
    };

    await test.step('opens User Management and checks both active and inactive accounts', async () => {
      const [response] = await Promise.all([
        page.waitForResponse(response => new URL(response.url()).pathname === usersPath
          && response.request().method() === 'GET', { timeout: 60_000 }),
        page.goto('/home', { waitUntil: 'domcontentloaded' }),
      ]);
      expect(response.ok()).toBe(true);
      await expect(page.getByRole('heading', { name: 'Recent Activities', exact: true }))
        .toBeVisible({ timeout: 60_000 });
      await page.getByRole('button', { name: 'switch', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Switch to Configuration', exact: true })).toBeVisible();
      await page.locator('#switch-confirmations-confirm-button').click();
      await master.openSection('User Management', '/admin/user-management');
      await master.waitForTable();
      await master.clearFilters();
      expect(await readUser(), `${email} already exists; existing accounts must not be changed`).toHaveLength(0);
      await master.setSearch(email);
      await expect(master.noResults).toBeVisible();
      await expect(row).toHaveCount(0);
    });

    // Remember ownership as soon as the server confirms creation, even if later assertions fail.
    const rememberCreation = response => {
      if (new URL(response.url()).pathname !== usersPath
        || response.request().method() !== 'POST' || !response.ok()) return;
      const body = response.request().postDataJSON();
      if (body?.email?.toLowerCase() === email) createdId = body.id;
    };
    page.on('response', rememberCreation);
    try {
      await test.step('selects the directory user and saves Viewer access for one personnel area', async () => {
        await master.openForm(/^Add User$/, 'Add New User');
        await master.dialog.getByRole('textbox', { name: 'Search Microsoft Entra Directory:', exact: true }).fill(email);
        await page.getByRole('option', { name: `${name} ${email}`, exact: true }).click();
        await expect(master.dialog.getByRole('textbox', { name: 'First Name First Name', exact: true })).toHaveValue('Hendrick');
        await expect(master.dialog.getByRole('textbox', { name: 'Last Name Last Name', exact: true })).toHaveValue('Makhomisane');
        const role = master.dialog.locator('ui5-select').getByRole('combobox');
        await role.click();
        await page.getByRole('option', { name: 'Viewer', exact: true }).click();
        await expect(role).toMatchAriaSnapshot('- combobox: Viewer');
        const areas = master.dialog.locator('ui5-multi-combobox');
        await areas.getByLabel('Select Options').click();
        await page.getByRole('option', { name: /^Multiple Selection Mode (?!All$).+/ }).first().click();
        await page.keyboard.press('Tab');
        await expect(areas.locator('ui5-token')).toHaveCount(1);
        const save = master.button(/^Save$/, master.dialog);
        await expect(save).toBeEnabled();
        const [response] = await Promise.all([
          page.waitForResponse(response => new URL(response.url()).pathname === usersPath
            && response.request().method() === 'POST'
            && response.request().postDataJSON()?.email?.toLowerCase() === email),
          save.click(),
        ]);
        expect(response.ok(), `Create user returned HTTP ${response.status()}`).toBe(true);
        expect(response.request().postDataJSON().personnelAreas).toHaveLength(1);
        expect(createdId, 'Creation must identify the account owned by this run').toBeTruthy();
        test.info().annotations.push({ type: 'user', description: `${email} (${createdId})` });
        await expect(master.dialog).toHaveCount(0);
      });

      await test.step('verifies the saved account after reopening User Management', async () => {
        await reopenUsers();
        await expect(row).toHaveCount(1);
        await expect(row).toContainText(name);
        await expect(row).toContainText('Viewer');
        await expect(row.getByRole('gridcell', { name: 'true', exact: true })).toBeVisible();
        const users = await readUser();
        expect(users).toHaveLength(1);
        expect(users[0]).toMatchObject({ id: createdId, email, isActive: true, roleName: 'Viewer' });
      });
    } finally {
      page.off('response', rememberCreation);
      if (createdId) {
        await test.step('uses the delete icon and confirms deactivation of this run\'s account', async () => {
          // The UI delete icon performs a PUT with isActive=false, rather than permanent deletion.
          await reopenUsers();
          const users = await readUser();
          expect(users).toHaveLength(1);
          expect(users[0].id, 'Cleanup must only change the account created by this run').toBe(createdId);
          await expect(row).toHaveCount(1);
          await row.locator('ui5-button[icon="delete"]').click();
          await expect(master.dialog.getByRole('heading', { name: 'Deactivate User', exact: true })).toBeVisible();
          const [response] = await Promise.all([
            page.waitForResponse(response => new URL(response.url()).pathname === `${usersPath}/${createdId}`
              && response.request().method() === 'PUT'
              && response.request().postDataJSON()?.isActive === false),
            page.locator('#user-confirmation-modal-confirm-button').click(),
          ]);
          expect(response.ok(), `Deactivate user returned HTTP ${response.status()}`).toBe(true);
          await expect(master.dialog).toHaveCount(0);
          await expect(row).toHaveCount(0);
        });

        await test.step('verifies removal from Active and persistence under Inactive', async () => {
          await reopenUsers();
          await expect(master.noResults).toBeVisible();
          await expect(row).toHaveCount(0);
          await page.getByRole('option', { name: /^Inactive \(\d+\)$/ }).click();
          await expect(row).toHaveCount(1);
          await expect(row).toContainText(name);
          await expect(row.getByRole('gridcell', { name: 'false', exact: true })).toBeVisible();
          const users = await readUser();
          expect(users).toHaveLength(1);
          expect(users[0]).toMatchObject({ id: createdId, email, isActive: false });
        });
      }
    }
  });
});
