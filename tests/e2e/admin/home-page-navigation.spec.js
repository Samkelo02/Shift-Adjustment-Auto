import { test, expect } from '@playwright/test';
import { adminFilterData } from '../../fixtures/test-data.js';
import { AdminAdjustmentsPage } from '../../pages/admin-adjustments.page.js';
import { HomePage } from '../../pages/home.page.js';

const insightsPanels = [
  'Overview', 'Absences', 'Ageing', 'Employees', 'User Analytics',
  'Organizational', 'Medical', 'Exceptions', 'Data Export',
];
const queueCards = [
  'Total Pending Approval', 'Total Posting Failed', 'Total Recapture Requested',
];

async function expectHealthyPage(page, route) {
  await expect(page).toHaveURL(url => url.pathname === route);
  await expect(page.locator('body')).not.toContainText(/Something went wrong|Internal Server Error/i);
}

async function expectNoDocumentOverflow(page) {
  await expect.poll(() => page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )).toBeLessThanOrEqual(2);
}

async function expectHome(page) {
  await expectHealthyPage(page, '/home');
  await expect(page.getByRole('tab', { name: 'Home', exact: true }))
    .toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: /^Good .*!$/ })).toBeVisible();
  for (const title of ['Recent Activities', "Today's New Submissions"]) {
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  }
  for (const title of queueCards) {
    await expect(page.getByText(title, { exact: true })).toBeVisible();
  }
  await expect(new HomePage(page).newAdjustmentButton).toBeEnabled();
}

async function closeDialog(page) {
  const dialog = page.locator('ui5-dialog[open]');
  await expect(dialog).toBeVisible();
  await dialog.locator('ui5-button:visible').filter({ hasText: /^(Close|Cancel)$/ })
    .getByRole('button').click();
  await expect(dialog).toHaveCount(0);
}

test.describe('Home page navigation', () => {
  test('thoroughly navigates Home in one browser session', async ({ page, baseURL }) => {
    test.setTimeout(240_000);
    const pageErrors = [];
    const serverErrors = [];
    const origin = new URL(baseURL).origin;
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('response', response => {
      if (new URL(response.url()).origin === origin && response.status() >= 500) {
        serverErrors.push(response.status() + ' ' + response.url());
      }
    });

    try {
      // Load once, then keep the same page for every navigation step.
      await new HomePage(page).goto();
      await expectHome(page);

      await test.step('checks the complete Home dashboard', async () => {
        await expectNoDocumentOverflow(page);
        await expectHome(page);
        await expectNoDocumentOverflow(page);
      });

      for (const title of queueCards) {
        await test.step('opens ' + title + ' and returns to Home', async () => {
          const home = new HomePage(page);
          await home.dashboardCard(title).click();
          await expectHealthyPage(page, '/shift-adjustments');
          await expect(page.getByRole('heading', { name: /Shift Adjustments \(\d+\)/ })).toBeVisible();
          await expect(page.getByRole('textbox', { name: 'Search', exact: true })).toBeVisible();
          await expect(page.getByRole('tab', { name: 'Shift Adjustment', exact: true }))
            .toHaveAttribute('aria-selected', 'true');
          await home.returnHome();
          await expectHome(page);
        });
      }

      await test.step('navigates the main tabs and browser history from Home', async () => {
        const home = new HomePage(page);
        const adjustments = page.getByRole('tab', { name: 'Shift Adjustment', exact: true });
        await adjustments.click();
        await expectHealthyPage(page, '/shift-adjustments');
        await expect(adjustments).toHaveAttribute('aria-selected', 'true');
        await home.openInsights();
        await expectHealthyPage(page, '/insights');
        await expect(home.insightsTab).toHaveAttribute('aria-selected', 'true');
        await expect(page.getByRole('tab', { name: 'Overview', exact: true })).toBeVisible();
        await page.goBack();
        await expectHealthyPage(page, '/shift-adjustments');
        await expect(adjustments).toHaveAttribute('aria-selected', 'true');
        await page.goBack();
        await expectHome(page);
        await page.goForward();
        await expectHealthyPage(page, '/shift-adjustments');
        await home.homeTab.focus();
        await home.homeTab.press('Enter');
        await expectHome(page);
      });

      await test.step('opens New Shift Adjustment and returns without submitting', async () => {
        const home = new HomePage(page);
        await home.startNewAdjustment();
        await expect(page.getByRole('heading', { name: 'New Shift Adjustment', exact: true })).toBeVisible();
        await expect(page.getByRole('textbox', { name: 'Search by employee number or' })).toBeVisible();
        await page.getByRole('button', { name: 'Navigate Back', exact: true }).click();
        await expectHome(page);
      });

      await test.step('opens and dismisses notifications and the profile menu', async () => {
        await page.getByRole('button', { name: /Notifications/ }).click();
        await closeDialog(page);
        await expectHome(page);
        await page.getByRole('banner', { name: 'Shell Bar' })
          .getByRole('button', { name: /Avatar/ }).click();
        const menu = page.getByRole('dialog', { name: /^User menu for/ });
        await expect(menu).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(menu).toBeHidden();
        await expectHome(page);
      });

      await test.step('opens Help, visits Guides and Contact, and returns to Home', async () => {
        await page.getByRole('button', { name: 'Help', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Help Center', exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Guides', exact: true }).click();
        await expect(page.getByRole('heading', { name: /Shift Adjustment.*Initiator/ })).toBeVisible();
        await page.getByRole('button', { name: 'Contact', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Contact Information', exact: true })).toBeVisible();
        await new HomePage(page).returnHome();
        await expectHome(page);
      });

      await test.step('exercises adjustment filters after navigating from Home', async () => {
        const home = new HomePage(page);
        const admin = new AdminAdjustmentsPage(page);
        await home.openPendingApprovals();
        await expectHealthyPage(page, '/shift-adjustments');
        await admin.exerciseSearch('SA-ADJ');
        await admin.selectStatus(adminFilterData.status);
        await admin.selectAbsenceType(adminFilterData.absenceType);
        await admin.clearFilters();
        await home.returnHome();
        await expectHome(page);
      });

      await test.step('visits every Insights panel and returns to Home', async () => {
        const home = new HomePage(page);
        await home.openInsights();
        await expectHealthyPage(page, '/insights');
        for (const name of insightsPanels) {
          await test.step('Open ' + name, async () => {
            const tab = page.getByRole('tab', { name, exact: true });
            await tab.click();
            await expect(tab).toHaveAttribute('aria-selected', 'true');
            await expectHealthyPage(page, '/insights');
          });
        }
        await home.returnHome();
        await expectHome(page);
      });

      for (const width of [1440, 768]) {
        await test.step('navigates from Home at viewport width ' + width, async () => {
          const home = new HomePage(page);
          await page.setViewportSize({ width, height: 900 });
          await expectHome(page);
          await expectNoDocumentOverflow(page);
          await page.getByRole('tab', { name: 'Shift Adjustment', exact: true }).click();
          await expectHealthyPage(page, '/shift-adjustments');
          await expect(page.getByRole('textbox', { name: 'Search', exact: true })).toBeVisible();
          await expectNoDocumentOverflow(page);
          await home.returnHome();
          await expectHome(page);
          await home.openInsights();
          await expectHealthyPage(page, '/insights');
          await expect(page.getByRole('tab', { name: 'Overview', exact: true })).toBeVisible();
          await expectNoDocumentOverflow(page);
          await home.returnHome();
          await expectHome(page);
        });
      }

    } finally {
      expect.soft(pageErrors, 'Browser errors: ' + pageErrors.join('\n')).toEqual([]);
      expect.soft(serverErrors, 'Server errors: ' + serverErrors.join('\n')).toEqual([]);
    }
  });
});
