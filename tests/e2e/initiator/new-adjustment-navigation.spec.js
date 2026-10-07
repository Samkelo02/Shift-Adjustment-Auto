import { test, expect } from '@playwright/test';
import { HomePage } from '../../pages/home.page.js';
import { AdminAdjustmentsPage as ShiftAdjustmentsPage } from '../../pages/admin-adjustments.page.js';

async function expectHome(page) {
  await expect(page).toHaveURL(url => url.pathname === '/home');
  await expect(page.getByRole('tab', { name: 'Home', exact: true }))
    .toHaveAttribute('aria-selected', 'true');
  await expect(new HomePage(page).newAdjustmentButton).toBeEnabled();
}

async function expectAdjustments(page) {
  await expect(page).toHaveURL(url => url.pathname === '/shift-adjustments');
  await expect(page.getByRole('tab', { name: 'Shift Adjustment', exact: true }))
    .toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: /Shift Adjustments \(\d+\)/ })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Search', exact: true })).toBeVisible();
  await expect(page.locator('ui5-busy-indicator[active]:visible')).toHaveCount(0);
}

test.describe('Initiator workflows', () => {
  // Share the page without refreshing; stop after failure to avoid carrying broken UI state.
  test.describe.configure({ mode: 'serial', retries: 0 });
  let context;
  let page;
  let home;
  let adjustments;

  test.beforeAll(async ({ browser }, testInfo) => {
    expect(testInfo.project.name, 'Run with npm run test:initiator').toBe('initiator');
    test.setTimeout(120_000);
    const options = testInfo.project.use;
    context = await browser.newContext({
      baseURL: options.baseURL,
      storageState: options.storageState,
      viewport: options.viewport,
    });
    page = await context.newPage();
    page.setDefaultTimeout(60_000);
    page.setDefaultNavigationTimeout(30_000);
    home = new HomePage(page);
    adjustments = new ShiftAdjustmentsPage(page);
    await home.goto();
    await expectHome(page);
  });

  test.beforeEach(async () => {
    test.setTimeout(240_000);
    if (new URL(page.url()).pathname !== '/home') await home.returnHome();
    await expectHome(page);
  });

  test.afterEach(async ({}, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
      if (!page.isClosed()) {
        await testInfo.attach('failure screenshot', {
          body: await page.screenshot(),
          contentType: 'image/png',
        });
      }

    }
  });

  test.afterAll(async () => {
    await context?.close();
  });
  test('opens a new adjustment and returns without submitting', async () => {
    await new HomePage(page).startNewAdjustment();
    await expect(page.getByRole('heading', { name: 'New Shift Adjustment', exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Search by employee number or' })).toBeEditable();
    await page.getByRole('button', { name: 'Navigate Back', exact: true }).click();
    await expectHome(page);
  });
});
