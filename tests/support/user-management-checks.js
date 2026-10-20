import { randomUUID } from 'node:crypto';
import { test, expect } from './regression-test.js';

const usersPath = '/api/v1/master-data/user/Users';
const filters = [
  { id: 'role-filter', field: 'roleName', values: ['Administrator', 'Employee Benefits', 'Initiator', 'Approver', 'Viewer'] },
  { id: 'source-filter', field: 'source', values: ['Local Accounts', 'Active Directory'] },
  { id: 'department-filter', field: 'department', values: ['App Dev', 'Delivery', 'Global IM', 'IT'] },
];

export async function verifyUserManagementQueries(master) {
  const page = master.page;
  let records = [];
  let total = 0;

  const query = async (action, { append = false } = {}) => {
    const [response] = await Promise.all([
      page.waitForResponse(response => {
        const url = new URL(response.url());
        return response.request().method() === 'GET' && url.pathname === usersPath
          && url.searchParams.get('$count') === 'true';
      }, { timeout: 60_000 }),
      action(),
    ]);
    expect(response.ok(), `User list returned HTTP ${response.status()}`).toBe(true);
    const data = await response.json();
    expect(Array.isArray(data.value), 'User list must contain records').toBe(true);
    records = append ? [...records, ...data.value] : data.value;
    total = Number(data['@odata.count']);
    // The analytical table virtualizes rows beyond the viewport.
    await expect(page.getByRole('grid')).toHaveAttribute('aria-rowcount', String(records.length), { timeout: 60_000 });
    if (!append) await expect(master.rows).toHaveCount(records.length, { timeout: 60_000 });
    if (append) {
      const body = page.locator('[data-component-name="AnalyticalTableBody"]:visible');
      try {
        for (const [index, user] of records.entries()) {
          await body.evaluate((element, position) => {
            element.scrollTop = position.index * element.scrollHeight / position.count;
          }, { index, count: records.length });
          await expect(master.rows.filter({ hasText: user.email })).toHaveCount(1, { timeout: 60_000 });
        }
      } finally {
        await body.evaluate(element => { element.scrollTop = 0; });
      }
    }
    if (!records.length) {
      await expect(master.noResults).toBeVisible();
    } else {
      await expect.poll(async () => {
        const texts = await master.rows.allInnerTexts();
        return texts.length > 0 && texts.every(text => records.some(user => text.toLowerCase().includes(user.email.toLowerCase())))
          && (append || records.every(user => texts.some(text => text.toLowerCase().includes(user.email.toLowerCase()))));
      }, { timeout: 60_000, message: 'Rendered users must match the completed list response' }).toBe(true);
    }
    return records;
  };

  await test.step('opens User Management and verifies the initial active users', async () => {
    await query(async () => {
      await master.openSection('Settings', '/admin/settings');
      await master.openSection('User Management', '/admin/user-management');
      await master.waitForTable();
    });
    for (const filter of filters) {
      await expect(page.locator(`[id="${filter.id}"]`).getByRole('combobox')).toMatchAriaSnapshot('- combobox: All');
    }
    expect(records.every(user => user.isActive === true)).toBe(true);
  });
  const sample = records[0];

  for (const active of [true, false]) {
    await test.step(`checks ${active ? 'Active' : 'Inactive'} results and every user filter`, async () => {
      if (!active) {
        await query(() => page.getByRole('option', { name: /^Inactive \(\d+\)$/ }).click());
      }
      expect(records.every(user => user.isActive === active)).toBe(true);
      for (const filter of filters) {
        for (const value of filter.values) {
          await test.step(`${active ? 'Active' : 'Inactive'} ${filter.id}: ${value}`, async () => {
            await query(() => master.selectFilter(filter.id, value));
            expect(records.every(user => user.isActive === active)).toBe(true);
            for (const user of records) {
              if (value === 'Local Accounts') expect(user.source).toMatch(/^Local(?: Accounts?)?$/i);
              else expect(user[filter.field], `${filter.id} returned an unrelated user`).toBe(value);
            }
            const headers = await page.getByRole('columnheader').allInnerTexts();
            const heading = { roleName: 'Role', source: 'Source', department: 'Department' }[filter.field];
            const column = headers.indexOf(heading);
            expect(column, `The ${heading} column must be available for result validation`).toBeGreaterThanOrEqual(0);
            for (const row of await master.rows.all()) {
              const text = (await row.getByRole('gridcell').nth(column).innerText()).trim();
              if (value === 'Local Accounts') expect(text).toMatch(/^Local(?: Accounts?)?$/i);
              else expect(text.split('\n')[0].trim()).toBe(value);
            }
          });
        }
        await query(() => master.selectFilter(filter.id, 'All'));
      }
    });
  }

  await test.step('combines user filters with an email search and resets them', async () => {
    await query(() => page.getByRole('option', { name: /^Active \(\d+\)$/ }).click());
    expect(sample, 'A real active user is required for matching searches').toBeTruthy();
    const values = [sample.roleName, sample.source.startsWith('Local') ? 'Local Accounts' : sample.source, sample.department];
    for (let index = 0; index < filters.length; index++) {
      expect(filters[index].values).toContain(values[index]);
      await query(() => master.selectFilter(filters[index].id, values[index]));
    }
    await query(() => master.setSearch(sample.email));
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ id: sample.id, email: sample.email, isActive: true });
    for (const filter of filters) await query(() => master.selectFilter(filter.id, 'All'));
    await query(() => master.setSearch(''));
    for (const filter of filters) {
      await expect(page.locator(`[id="${filter.id}"]`).getByRole('combobox')).toMatchAriaSnapshot('- combobox: All');
    }
    await expect(master.search).toHaveValue('');
  });

  await test.step('checks name, email, case-insensitive, partial, and no-match searches', async () => {
    const searches = [sample.fullName, sample.email.toUpperCase(), sample.email.split('@')[0]];
    for (const search of searches) {
      await query(() => master.setSearch(search));
      expect(records.some(user => user.id === sample.id), `Search ${search} must include the selected user`).toBe(true);
      for (const user of records) {
        expect(`${user.fullName} ${user.email}`.toLowerCase()).toContain(search.toLowerCase());
      }
    }
    await query(() => master.setSearch(`no-user-${randomUUID()}`));
    expect(records).toHaveLength(0);
    await expect(master.noResults).toBeVisible();
    await query(() => master.setSearch(''));
    await expect(master.rows.first()).toBeVisible();
  });

  await test.step('loads more users without replacing or duplicating the first page', async () => {
    if (total <= records.length) {
      test.info().annotations.push({ type: 'coverage', description: 'All users fit on one page; no Load More action is needed.' });
      return;
    }
    const previousIds = records.map(user => user.id);
    await query(() => page.getByRole('button', { name: 'Load More', exact: true }).click(), { append: true });
    expect(records.length).toBeGreaterThan(previousIds.length);
    expect(new Set(records.map(user => user.id)).size).toBe(records.length);
    expect(records.map(user => user.id)).toEqual(expect.arrayContaining(previousIds));
  });
}

export async function verifyUserManagementColumns(master) {
  const page = master.page;
  const header = page.getByRole('columnheader', { name: 'Last Login', exact: true });
  await expect(header).toBeVisible();
  const openSettings = async () => {
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const dialog = page.locator('ui5-dialog[open][accessible-name="Column Settings"]');
    await expect(dialog).toBeVisible();
    return dialog;
  };
  const checkbox = dialog => dialog.locator('ui5-li[text="Last Login"]')
    .getByRole('checkbox', { name: 'Multiple Selection Mode', exact: true });

  await test.step('cancels an unsaved User Management column change', async () => {
    const dialog = await openSettings();
    await expect(checkbox(dialog)).toBeChecked();
    await checkbox(dialog).uncheck();
    await master.button(/^Cancel$/, dialog).click();
    await expect(dialog).toBeHidden();
    await expect(header).toBeVisible();
  });

  await test.step('hides Last Login and verifies column defaults after navigation', async () => {
    try {
      const dialog = await openSettings();
      await checkbox(dialog).uncheck();
      await master.button(/^Select$/, dialog).click();
      await expect(header).toBeHidden();
      const savedSettings = await openSettings();
      await expect(checkbox(savedSettings)).not.toBeChecked();
      await master.button(/^Cancel$/, savedSettings).click();
      await expect(header).toBeHidden();
      await master.openSection('Settings', '/admin/settings');
      await master.openSection('User Management', '/admin/user-management');
      await master.waitForTable();
      // Column choices apply to the mounted table; navigating back restores defaults.
      await expect(header).toBeVisible();
    } finally {
      const openDialog = page.locator('ui5-dialog[open][accessible-name="Column Settings"]');
      if (await openDialog.isVisible()) await master.button(/^Cancel$/, openDialog).click();
      if (!(await header.isVisible())) {
        const dialog = await openSettings();
        await checkbox(dialog).check();
        await master.button(/^Select$/, dialog).click();
      }
      await expect(header).toBeVisible();
    }
  });
}

export async function verifyUserManagementEditing(master, { readUser, expectAccount }) {
  const page = master.page;
  const original = await readUser();
  const row = master.rows.filter({ hasText: original.email });
  const alternateRole = original.roleName === 'Viewer' ? 'Approver' : 'Viewer';
  const access = user => ({
    id: user.id, email: user.email, isActive: user.isActive,
    personnelAreas: user.personnelAreas.map(area => area.personnelAreaId ?? area.id).sort(),
    insights: user.insights.map(insight => insight.insightAccessId ?? insight.id).sort(),
  });
  const openEdit = async () => {
    await expectAccount(true);
    await row.locator('ui5-button[icon="edit"]:visible').click();
    await expect(page.getByRole('dialog', { name: 'Edit User', exact: true })).toBeVisible();
    await expect(master.dialog.locator('#firstName').getByRole('textbox')).toHaveValue(original.firstName);
    return master.dialog.locator('#navigation-tabs--roleId').getByRole('combobox');
  };
  const chooseRole = async (role, roleName) => {
    await role.click();
    await page.getByRole('option', { name: roleName, exact: true }).click();
    await expect(role).toMatchAriaSnapshot(`- combobox: ${JSON.stringify(roleName)}`);
  };
  const saveRole = async roleName => {
    const role = await openEdit();
    await chooseRole(role, roleName);
    // The app clears personnel areas when switching to a non-admin role.
    // Restore only this account's existing assignments before saving.
    if (roleName !== 'Administrator') {
      const areas = master.dialog.locator('ui5-multi-combobox:visible');
      await expect(areas).toHaveCount(1);
      await expect(areas.getByRole('combobox')).toBeEnabled();
      const items = areas.locator('ui5-mcb-item');
      const availableNames = await items.evaluateAll(elements => elements.map(element => element.getAttribute('text')));
      const assignedNames = original.personnelAreas.map(area => area.name);
      expect(assignedNames.length, 'A non-admin role requires the existing personnel areas').toBeGreaterThan(0);
      for (const name of assignedNames) expect(availableNames).toContain(name);
      await areas.getByLabel('Select Options').click();
      const allNames = availableNames.filter(name => name !== 'All');
      if (JSON.stringify([...allNames].sort()) === JSON.stringify([...assignedNames].sort())) {
        await page.getByRole('option', { name: 'Multiple Selection Mode All', exact: true }).click();
      } else {
        expect(new Set(assignedNames).size, 'Selecting a subset by name requires unique names; never guess between duplicate areas').toBe(assignedNames.length);
        for (const name of assignedNames) {
          await page.getByRole('option', { name: 'Multiple Selection Mode ' + name, exact: true }).click();
        }
      }
      // All can close the picker itself; Escape would then close the edit dialog.
      await master.dialog.locator('#firstName').getByRole('textbox').click();
    }
    const save = master.button(/^Save$/, master.dialog);
    await expect(save).toBeEnabled();
    const [response] = await Promise.all([
      page.waitForResponse(response => new URL(response.url()).pathname === `${usersPath}/${original.id}`
        && response.request().method() === 'PUT', { timeout: 60_000 }),
      save.click(),
    ]);
    expect(response.ok(), `Saving role returned HTTP ${response.status()}`).toBe(true);
    await expect(master.dialog).toHaveCount(0);
    await expect.poll(async () => (await readUser()).roleName, { timeout: 60_000 }).toBe(roleName);
    await expectAccount(true);
    await expect(row.getByRole('gridcell', { name: roleName, exact: true })).toBeVisible();
  };

  await test.step('verifies saved edit-form details and cancels an unsaved role change', async () => {
    const writes = [];
    const recordWrite = request => {
      if (new URL(request.url()).pathname.startsWith(usersPath) && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) {
        writes.push(request.method() + ' ' + new URL(request.url()).pathname);
      }
    };
    page.on('request', recordWrite);
    try {
      const role = await openEdit();
      for (const field of ['firstName', 'lastName', 'department', 'jobTitle', 'mobileNumber', 'manager']) {
        const host = master.dialog.locator(`#${field}`);
        await expect(host).toHaveAttribute('readonly', '');
        await expect(host.getByRole('textbox')).toHaveValue(String(original[field] ?? ''));
      }
      await expect(role).toMatchAriaSnapshot(`- combobox: ${JSON.stringify(original.roleName)}`);
      await expect(master.dialog.getByRole('switch')).toBeChecked();
      await chooseRole(role, alternateRole);
      await master.closeForm();
      const unchanged = await readUser();
      expect(unchanged).toMatchObject({ roleId: original.roleId, roleName: original.roleName });
      expect(access(unchanged)).toEqual(access(original));
      expect(writes, 'Closing the edit form must not save user changes').toEqual([]);
      await openEdit();
      await expect(master.dialog.locator('#navigation-tabs--roleId').getByRole('combobox'))
        .toMatchAriaSnapshot(`- combobox: ${JSON.stringify(original.roleName)}`);
      await master.closeForm();
    } finally {
      page.off('request', recordWrite);
      if (await master.dialog.count()) await master.closeForm();
    }
  });

  await test.step('saves a temporary role change, verifies persistence, and restores the original role', async () => {
    try {
      await saveRole(alternateRole);
      const updated = await readUser();
      expect(updated.roleId).not.toBe(original.roleId);
      expect(access(updated), 'A role-only update must preserve existing personnel areas and Insights selections')
        .toEqual(access(original));
      await openEdit();
      await expect(master.dialog.locator('#navigation-tabs--roleId').getByRole('combobox'))
        .toMatchAriaSnapshot(`- combobox: ${JSON.stringify(alternateRole)}`);
      await master.closeForm();
    } finally {
      if (await master.dialog.count()) await master.closeForm();
      if ((await readUser()).roleId !== original.roleId) await saveRole(original.roleName);
      const restored = await readUser();
      expect(restored).toMatchObject({ roleId: original.roleId, roleName: original.roleName });
      expect(access(restored)).toEqual(access(original));
    }
  });
}
