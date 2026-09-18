import { test, expect } from '@playwright/test';
import { adminFilterData } from '../fixtures/test-data.js';
import { AdminAdjustmentsPage } from '../pages/admin-adjustments.page.js';
import { HomePage } from '../pages/home.page.js';

const insightsPanels = [
  'Overview',
  'Absences',
  'Ageing',
  'Employees',
  'User Analytics',
  'Organizational',
  'Medical',
  'Exceptions',
  'Data Export',
];

async function expectHealthyPage(page, route) {
  await expect(page).toHaveURL(new RegExp(`${route}(?:\\?.*)?$`));
  await expect(page.locator('body')).not.toContainText(/Something went wrong|Internal Server Error/i);
}

async function expectNoDocumentOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));

  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 2);
}

test.describe('Shift adjustment administration smoke tour', () => {
  test('navigates pages, exercises filters, and checks responsive layout', async ({ page }) => {
    test.setTimeout(90_000);

    const pageErrors = [];
    const serverErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('response', (response) => {
      if (response.url().startsWith('https://shift-adjustment-test') && response.status() >= 500) {
        serverErrors.push(`${response.status()} ${response.url()}`);
      }
    });

    const homePage = new HomePage(page);
    const adminPage = new AdminAdjustmentsPage(page);

    await test.step('Verify the Home dashboard and its queue links', async () => {
      await homePage.goto();
      await expect(page.getByRole('heading', { name: /Good .*Samukelisiwe!/ })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Recent Activities' })).toBeVisible();
      await expectNoDocumentOverflow(page);

      await homePage.openPendingApprovals();
      await expectHealthyPage(page, '/shift-adjustments');
      await homePage.returnHome();
      await expectHealthyPage(page, '/home');

      await homePage.openPostingFailures();
      await expectHealthyPage(page, '/shift-adjustments');
    });

    await test.step('Exercise list search and administration filters', async () => {
      await expect(page.getByRole('heading', { name: /Shift Adjustments \(\d+\)/ })).toBeVisible();
      await adminPage.exerciseSearch('SA-ADJ');
      await adminPage.selectStatus(adminFilterData.status);
      await adminPage.selectAbsenceType(adminFilterData.absenceType);
      await adminPage.clearFilters();
    });

    await test.step('Visit every Insights panel', async () => {
      await homePage.openInsights();
      await expectHealthyPage(page, '/insights');

      for (const panelName of insightsPanels) {
        const panelTab = page.getByRole('tab', { name: panelName, exact: true });
        await panelTab.click();
        await expect(panelTab).toHaveAttribute('aria-selected', 'true');
        await expect(page.locator('body')).not.toContainText(
          /Something went wrong|Internal Server Error/i,
        );
      }
    });

    await test.step('Check core pages at tablet width', async () => {
      await page.setViewportSize({ width: 768, height: 900 });

      for (const [route, visibleControl] of [
        ['/home', page.getByRole('tab', { name: 'Home' })],
        ['/shift-adjustments', page.getByRole('textbox', { name: 'Search' })],
        ['/insights', page.getByRole('tab', { name: 'Overview' })],
      ]) {
        await page.goto(route);
        await expect(visibleControl).toBeVisible();
        await expectHealthyPage(page, route);
        await expectNoDocumentOverflow(page);
      }
    });

    expect(pageErrors, `Browser errors:\n${pageErrors.join('\n')}`).toEqual([]);
    expect(serverErrors, `Server errors:\n${serverErrors.join('\n')}`).toEqual([]);
  });
});
