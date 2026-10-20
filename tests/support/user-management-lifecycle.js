import { test, expect } from './regression-test.js';
import { verifyUserManagementEditing } from './user-management-checks.js';

const email = 'hendrick.makhomisane@valterraplatinum.com';
const name = 'Hendrick Makhomisane';
const usersPath = '/api/v1/master-data/user/Users';

export async function verifyUserManagementLifecycle(master) {
  const page = master.page;
  const row = master.rows.filter({ hasText: email });
  let userId;

  const readUser = async () => {
    // Match the application's encoding: this endpoint rejects '+' for spaces.
    const query = `$filter=${encodeURIComponent(`email eq '${email}'`)}&$expand=personnelAreas%2Cinsights&$top=2`;
    const response = await page.request.get(new URL(`${usersPath}?${query}`, page.url()).href, { timeout: 60_000 });
    expect(response.ok(), `User lookup returned HTTP ${response.status()}`).toBe(true);
    const data = await response.json();
    expect(Array.isArray(data.value), 'User lookup must return a record list').toBe(true);
    expect(data.value, `Expected one existing account for ${email}; no account will be created`).toHaveLength(1);
    const user = data.value[0];
    expect(user.email.toLowerCase()).toBe(email);
    if (userId) expect(user.id, 'Only the selected existing account may be changed').toBe(userId);
    return user;
  };

  const showStatus = async active => {
    if (await master.dialog.count()) await master.closeForm();
    await master.openSection('Settings', '/admin/settings');
    await master.openSection('User Management', '/admin/user-management');
    await master.waitForTable();
    await master.clearFilters();
    const status = page.getByRole('option', {
      name: active ? /^Active \(\d+\)$/ : /^Inactive \(\d+\)$/,
    });
    await status.click();
    await expect(status).toHaveAttribute('aria-selected', 'true');
    await master.setSearch(email);
  };

  const expectAccount = async active => {
    await showStatus(active);
    await expect(row).toHaveCount(1, { timeout: 60_000 });
    await expect(row).toContainText(name);
    await expect(row.getByRole('gridcell', { name: String(active), exact: true })).toBeVisible();
    expect(await readUser()).toMatchObject({ id: userId, email, isActive: active });
  };

  const setActive = async active => {
    const current = await readUser();
    await expectAccount(current.isActive);
    const action = active
      ? row.getByRole('button', { name: /^(Activate(?: User)?|Reactivate(?: User)?|Positive Action)$/i })
        .or(row.locator('ui5-button[icon="accept"], ui5-button[icon="undo"], ui5-button[icon="activate"], ui5-button[tooltip*="activate" i]')
          .getByRole('button')).first()
      : row.locator('ui5-button[icon="delete"]').getByRole('button');
    await action.click();
    await expect(master.dialog.getByRole('heading', {
      name: active ? /^(Activate|Reactivate) User$/ : 'Deactivate User',
      exact: true,
    })).toBeVisible();
    const [response] = await Promise.all([
      page.waitForResponse(response =>
        new URL(response.url()).pathname === `${usersPath}/${userId}`
        && response.request().method() === 'PUT'
        && response.request().postDataJSON()?.isActive === active,
      { timeout: 60_000 }),
      page.locator('#user-confirmation-modal-confirm-button').click(),
    ]);
    expect(response.ok(), `${active ? 'Activate' : 'Deactivate'} user returned HTTP ${response.status()}`).toBe(true);
    await expect(master.dialog).toHaveCount(0);
    await expect.poll(async () => (await readUser()).isActive, { timeout: 60_000 }).toBe(active);
  };

  await test.step('searches for Hendrick existing under Active or Inactive', async () => {
    await master.openSection('User Management', '/admin/user-management');
    await master.waitForTable();
    await master.clearFilters();
    const user = await readUser();
    expect(user.id, 'The existing account must have an ID').toBeTruthy();
    userId = user.id;
    test.info().annotations.push({ type: 'user', description: `${email} (${userId})` });
    await expectAccount(user.isActive);
  });

  try {
    await test.step('activates the existing account and verifies it under Active', async () => {
      if (!(await readUser()).isActive) {
        await setActive(true);
      } else {
        test.info().annotations.push({ type: 'user state', description: 'The account was already active; verified its active state.' });
      }
      await expectAccount(true);
      await showStatus(false);
      await expect(row).toHaveCount(0);
      await expect(master.noResults).toBeVisible();
    });
    await verifyUserManagementEditing(master, { readUser, expectAccount });
  } finally {
    await test.step('deactivates the existing account and verifies it under Inactive', async () => {
      if ((await readUser()).isActive) await setActive(false);
      await showStatus(true);
      await expect(row).toHaveCount(0);
      await expect(master.noResults).toBeVisible();
      await expectAccount(false);
    });
  }
}
