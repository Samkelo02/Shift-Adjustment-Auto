import { randomInt, randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { MasterDataPage } from '../../pages/master-data.page.js';

const referenceCases = [
  {
    title: 'organizational units', tab: 'Organizational Structure',
    addLabel: /^Add Unit$/, formTitle: 'Add Organizational Units',
    confirmation: 'delete-org-unit-confirmation-confirm-button',
    fields: (key, name) => ({ Code: key, Name: name }),
  },
  {
    title: 'absence categories', tab: 'Absence Management', option: 'Absence Categories',
    addLabel: /^Add Category$/, formTitle: 'Add Absence Categories',
    confirmation: 'absence-category-confirmation-modal-confirm-button',
    fields: (key, name) => ({ Code: key, Name: name }),
  },
  {
    title: 'absence reasons', tab: 'Absence Management', option: 'Absence Reasons',
    addLabel: /^Add Absence Reason$/, formTitle: 'Add Absence Reason',
    confirmation: 'absence-reason-confirmation-modal-confirm-button',
    fields: (key, name) => ({ 'Code:': key, 'Name:': name }),
    prepare: async master => {
      const type = master.dialog.getByRole('combobox', { name: 'Absence Type:', exact: true });
      await type.fill('Study Leave');
      // Several absence-type codes share this label; either is valid for this test record.
      await master.page.getByRole('option', { name: 'Study Leave', exact: true }).first().click();
      await expect(type).toHaveValue('Study Leave');
      const groupFilter = master.page.locator('[id="navigation-tabs--personnelSubAreaGroupId"]:visible');
      await groupFilter.click();
      const availableGroup = groupFilter.getByRole('option', { name: /^\d+$/ }).first();
      await expect(availableGroup).toBeVisible();
      await availableGroup.click();
    },
  },
  {
    title: 'location types', tab: 'Absence Management', option: 'Location Types',
    addLabel: /^Add Location$/, formTitle: 'Add Location Type',
    confirmation: 'location-type-confirmation-modal-confirm-button',
    fields: (key, name) => ({ 'Code:': key, 'Name:': name }),
    prepare: master => master.selectFilter('navigation-tabs--absenceCategoryId', 'Sick Leave'),
  },
  {
    title: 'medical practitioners', tab: 'Medical Practitioner',
    addLabel: /^Add Doctor$/, formTitle: 'Add Medical Practitioner',
    confirmation: 'delete-medical-practitioner-confirmation-confirm-button',
    fields: (key, name) => ({
      'Doctor Name': name, 'Practice Number': key, Address: 'Automation Test Street',
      Email: 'master-data@example.test', 'Phone Number': '27821234567',
    }),
  },
  {
    title: 'error codes', tab: 'Reason & System Codes', option: 'Error Codes',
    addLabel: /^Add Error Code$/, formTitle: 'Add Code',
    confirmation: 'error-code-confirmation-modal-confirm-button',
    fields: (key, name) => ({ 'Code:': key, 'System Message:': name, 'Business Message:': 'Automation test message' }),
    prepare: master => master.selectFilter('navigation-tabs--severityId', 'Warning'),
  },
  {
    title: 'action reasons', tab: 'Reason & System Codes', option: 'Action Reasons',
    addLabel: /^Add Action Reason$/, formTitle: 'Add Action Reason',
    confirmation: 'action-reason-confirmation-modal-confirm-button',
    fields: (key, name) => ({ Code: key, Name: name }),
    prepare: master => master.selectFilter('navigation-tabs--actionTypeId', 'Reject'),
  },
];

test.describe('Master data', () => {
  test('checks master data in one browser session', async ({ page }) => {
    test.setTimeout(600_000);
    const master = new MasterDataPage(page);
    await test.step('loads Home and waits for the authenticated user', async () => {
      // Home remains blank until the user master-data request completes.
      // Register the response wait before navigation so fast responses are captured too.
      const [userResponse] = await Promise.all([
        page.waitForResponse(response =>
          new URL(response.url()).pathname === '/api/v1/master-data/user/Users'
          && response.request().method() === 'GET',
        { timeout: 60_000 }),
        page.goto('/home', { waitUntil: 'domcontentloaded' }),
      ]);
      expect(userResponse.ok(), `User master-data request returned HTTP ${userResponse.status()}`).toBe(true);
      await expect(page.getByRole('heading', { name: 'Recent Activities', exact: true }))
        .toBeVisible({ timeout: 30_000 });
    });

    await test.step('checks help, notifications, profile, and configuration navigation', async () => {
      await page.getByRole('button', { name: /Notifications/ }).click();
      await expect(master.dialog).toBeVisible();
      await master.closeForm();
      await page.getByRole('button', { name: 'Help', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Help Center', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Guides', exact: true }).click();
      await expect(page.getByRole('heading', { name: /Shift Adjustment.*Initiator/ })).toBeVisible();
      await page.getByRole('button', { name: 'Contact', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Contact Information', exact: true })).toBeVisible();
      await page.getByRole('banner', { name: 'Shell Bar' }).getByRole('button', { name: /Avatar/ }).click();
      await expect(page.getByRole('dialog', { name: /^User menu for/ })).toBeVisible();
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'switch', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Switch to Configuration', exact: true })).toBeVisible();
      await page.locator('#switch-confirmations-confirm-button').click();
      await expect(page).toHaveURL(/\/admin\/reference(?:\?|$)/);
      await expect(page.getByRole('tab', { name: 'Reference Data', exact: true })).toHaveAttribute('aria-selected', 'true');
    });

    for (const scenario of referenceCases) {
      await test.step(`creates, verifies, and deletes ${scenario.title}`, async () => {
        const key = String(randomInt(10_000_000, 100_000_000));
        const name = `Auto ${scenario.title} ${key}`;
        await master.open(scenario.tab, scenario.option);
        await master.verifyRecordLifecycle({
          key, name, addLabel: scenario.addLabel, title: scenario.formTitle,
          fields: scenario.fields(key, name), confirmation: scenario.confirmation,
          prepare: scenario.prepare ? () => scenario.prepare(master) : undefined,
        });
      });
    }

    for (const [tab, option] of [
      ['Absence Management', 'Absence Categories'],
      ['Absence Management', 'Absence Reasons'],
      ['Medical Practitioner', undefined],
      ['Reason & System Codes', 'Error Codes'],
    ]) {
      await test.step(`exports ${option ?? tab} as CSV and Excel`, async () => {
        await master.open(tab, option);
        await master.verifyDownloads();
      });
    }

    await test.step('searches organizational units, filters status, and loads more rows', async () => {
      await master.open('Organizational Structure');
      await master.searchFor('felm');
      await expect(master.row('FELM')).toHaveCount(1);
      await master.row('FELM').locator('ui5-button[icon="edit"]').click();
      await expect(master.dialog.getByRole('textbox', { name: 'Code', exact: true })).toHaveValue('FELM');
      await master.closeForm();
      await master.setSearch('');
      await expect.poll(() => master.rows.count()).toBeGreaterThan(1);
      const before = await master.rows.count();
      await page.getByRole('button', { name: 'Load More', exact: true }).click();
      await expect.poll(() => master.rows.count()).toBeGreaterThan(before);
      await master.selectFilter('status-filter', 'Active');
      await expect.poll(async () => {
        const texts = await master.rows.allTextContents();
        return texts.length > 0 && texts.every(text => text.includes('Active') && !text.includes('Inactive'));
      }).toBe(true);
      await master.selectFilter('status-filter', 'All');
    });

    await test.step('filters absence types by category and verifies clearing search', async () => {
      await master.open('Absence Management', 'Absence Types');
      const filter = page.locator('[id="absence category-filter"]');
      await filter.getByLabel('Select Options').click();
      await page.getByRole('option', { name: 'Multiple Selection Mode Sick Leave', exact: true }).click();
      await expect(filter.locator('ui5-token')).toHaveAttribute('text', 'Sick Leave');
      await page.keyboard.press('Escape');
      await master.searchFor('sick');
      await expect.poll(async () => {
        const texts = await master.rows.allTextContents();
        return texts.length > 0 && texts.every(text => /Sick Leave/i.test(text));
      }).toBe(true);
      await master.setSearch(`missing-${randomUUID()}`);
      await expect(master.noResults).toBeVisible();
      await expect(master.rows).toHaveCount(0);
      await master.setSearch('');
      await expect(master.rows.first()).toBeVisible();
    });

    await test.step('opens upload and restores column settings', async () => {
      await master.open('Absence Management', 'Absence Categories');
      await page.getByRole('button', { name: 'Upload', exact: true }).click();
      await expect(master.dialog).toBeVisible();
      await expect(master.button(/^Browse Files$/, master.dialog)).toBeVisible();
      await master.closeForm();
      const codeHeader = page.getByRole('columnheader', { name: 'Code', exact: true });
      await expect(codeHeader).toBeVisible();
      try {
        await page.getByRole('button', { name: 'Settings', exact: true }).click();
        await page.getByRole('listitem', { name: 'Code Is Active', exact: true }).getByLabel('Multiple Selection Mode').click();
        await master.button(/^Save$|^Apply$|^Select$/, master.dialog).click();
        await expect(codeHeader).toBeHidden();
      } finally {
        if (await master.dialog.count()) await master.closeForm();
        if (!await codeHeader.isVisible()) {
          await page.getByRole('button', { name: 'Settings', exact: true }).click();
          await page.getByRole('listitem', { name: 'Code Is Active', exact: true }).getByLabel('Multiple Selection Mode').click();
          await master.button(/^Save$|^Apply$|^Select$/, master.dialog).click();
        }
        await expect(codeHeader).toBeVisible();
      }
    });

    await test.step('checks user filters and the add-user form', async () => {
      await master.openSection('User Management', '/admin/user-management');
      await master.waitForTable();
      for (const [id, values] of [
        ['role-filter', ['Administrator', 'Employee Benefits', 'Initiator', 'Approver', 'Viewer']],
        ['source-filter', ['Local Accounts', 'Active Directory']],
        ['department-filter', ['App Dev', 'Delivery', 'Global IM', 'IT']],
      ]) {
        for (const value of values) await master.selectFilter(id, value);
        await master.selectFilter(id, 'All');
      }
      await master.openForm(/^Add User$/, 'Add New User');
      await expect(master.dialog.getByRole('textbox', { name: 'Search Microsoft Entra Directory:', exact: true })).toBeVisible();
      await expect(master.dialog.getByRole('heading', { name: 'Add an employee or contractor' })).toBeVisible();
      await master.closeForm();
    });

    await test.step('checks integrations and validates the system notification form', async () => {
      await master.openSection('Settings', '/admin/settings');
      await master.selectOption('Integrations');
      await master.selectOption('External APIs');
      await page.getByRole('button', { name: /^View All \(\d+\)$/ }).click();
      await expect(page.getByRole('button', { name: 'View Less', exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Available Endpoints', exact: true })).toBeVisible();
      await master.selectOption('System');
      await master.openForm(/^System Notification$/, 'Add System Notification');
      await master.fill({ Title: 'Automated test', 'Status Message Message': 'Auto test notification' });
      await master.selectFilter('navigation-tabs--severityId', 'Warning');
      const target = master.dialog.locator('ui5-multi-combobox');
      await target.getByLabel('Select Options').click();
      await page.getByRole('option', { name: 'Multiple Selection Mode Administrator', exact: true }).click();
      await expect(target.locator('ui5-token')).toHaveAttribute('text', 'Administrator');
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const date = [tomorrow.getFullYear(), String(tomorrow.getMonth() + 1).padStart(2, '0'), String(tomorrow.getDate()).padStart(2, '0')].join('-');
      const endDate = master.dialog.getByRole('textbox', { name: 'yyyy-MM-dd', exact: true }).nth(1);
      await endDate.fill(date);
      await endDate.press('Tab');
      await expect(endDate).toHaveValue(date);
      await expect(master.button(/^Add$/, master.dialog)).toBeEnabled();
      // Validate the form without broadcasting a notification to administrators.
      await master.closeForm();
    });

    await test.step('filters audit categories, severity, and dates', async () => {
      await master.openSection('Audit Logs', '/admin/audit-logs');
      await master.waitForTable();
      for (const [id, label] of [['category-filter', 'Authentication'], ['status-filter', 'Warning']]) {
        const filter = page.locator(`#${id}`);
        await filter.getByLabel('Select Options').click();
        await page.getByRole('option', { name: `Multiple Selection Mode ${label}`, exact: true }).click();
        await page.keyboard.press('Escape');
        await expect(filter.locator('ui5-token')).toHaveAttribute('text', label);
      }
      await master.selectFilter('date-filter', 'Yesterday');
      await master.selectFilter('date-filter', 'Last 7 Days');
      await page.getByRole('button', { name: 'Clear', exact: true }).click();
      await expect(page.locator('#category-filter ui5-token, #status-filter ui5-token')).toHaveCount(0);
      await expect(page.locator('#date-filter').getByRole('combobox')).toMatchAriaSnapshot('- combobox: All');
    });
  });
});
