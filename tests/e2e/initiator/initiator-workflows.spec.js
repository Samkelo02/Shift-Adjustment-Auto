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
  test('navigates between Home and Shift Adjustment using tabs and browser history', async () => {
    const home = new HomePage(page);
    await page.getByRole('tab', { name: 'Shift Adjustment', exact: true }).click();
    await expectAdjustments(page);
    await home.returnHome();
    await expectHome(page);
    await page.goBack();
    await expectAdjustments(page);
    await page.goForward();
    await expectHome(page);
  });

  test('opens a new adjustment and returns without submitting', async () => {
    await new HomePage(page).startNewAdjustment();
    await expect(page.getByRole('heading', { name: 'New Shift Adjustment', exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Search by employee number or' })).toBeEditable();
    await page.getByRole('button', { name: 'Navigate Back', exact: true }).click();
    await expectHome(page);
  });

  test('searches for an absent reference and restores the adjustment list', async () => {
    await page.getByRole('tab', { name: 'Shift Adjustment', exact: true }).click();
    await expectAdjustments(page);
    const search = page.getByRole('textbox', { name: 'Search', exact: true });
    const rows = page.locator('[role="rowgroup"]:visible [role="row"]');
    const initialCount = await rows.count();
    const query = `initiator-no-match-${Date.now()}`;
    await search.fill(query);
    await expect(search).toHaveValue(query);
    await expect(rows).toHaveCount(0, { timeout: 60_000 });
    await search.clear();
    await expect(search).toHaveValue('');
    await expect(rows).toHaveCount(initialCount, { timeout: 60_000 });
    await new HomePage(page).returnHome();
    await expectHome(page);
  });

  test('visits FAQ, the Initiator guide, and Contact', async () => {
    await page.getByRole('button', { name: 'Help', exact: true }).click();
    await expect(page).toHaveURL(url => url.pathname === '/help-center');
    await expect(page.getByRole('heading', { name: 'Help Center', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'FAQ', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Frequently Asked Questions', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Guides', exact: true }).click();
    const guide = page.getByRole('heading', { name: /^Shift Adjustment.*Initiator Guide$/ });
    await guide.scrollIntoViewIfNeeded();
    await expect(guide).toBeVisible();
    await page.getByRole('button', { name: 'Contact', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Contact Information', exact: true })).toBeVisible();
    await new HomePage(page).returnHome();
    await expectHome(page);
  });

  async function openAdjustmentList() {
    await page.getByRole('tab', { name: 'Shift Adjustment', exact: true }).click();
    await expectAdjustments(page);
    await adjustments.clearFilters();
    await page.getByRole('textbox', { name: 'Search', exact: true }).clear();
  }

  test('tests shift adjustment status and absence-type filters', async ({}, testInfo) => {
    await openAdjustmentList();
    await adjustments.exerciseSearch('SA-ADJ');
    await adjustments.selectStatus('Submitted');
    await adjustments.expectSubmittedAdjustments();
    await adjustments.selectStatus('Posting Failed');
    await adjustments.expectFilteredAdjustments(['Submitted', 'Posting Failed']);
    await adjustments.selectAbsenceType(
      process.env.TEST_INITIATOR_ABSENCE_TYPE ?? 'Sick leave Paid',
    );
    await adjustments.clearFilters();
    await expect(page.locator('#status-filter ui5-mcb-item[selected]')).toHaveCount(0);
    await expect(page.locator('[id="absence type-filter"] ui5-mcb-item[selected]')).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: 'Search', exact: true })).toHaveValue('');
    await home.returnHome();
    await expectHome(page);
  });

  test('views Audit Trail and Notifications for an adjustment', async ({}, testInfo) => {
    await openAdjustmentList();
    const statuses = await adjustments.selectAllStatusesExceptPending();
    await adjustments.expectFilteredAdjustments(statuses);
    const reference = await adjustments.openFirstAdjustmentWithHistory(statuses);
    testInfo.annotations.push({ type: 'history adjustment', description: reference });
    for (const section of ['Audit Trail', 'Notifications']) {
      await test.step('Open, navigate, and close ' + section, async () => {
        const count = await adjustments.navigateAdjustmentHistory(section, reference);
        testInfo.annotations.push({ type: section, description: count + ' timeline entries' });
      });
    }
    await home.returnHome();
    await expectHome(page);
  });

  test('recalls a shift adjustment from submission', async ({}, testInfo) => {
    await openAdjustmentList();
    await adjustments.selectStatus('Submitted');
    await adjustments.expectSubmittedAdjustments();
    const reference = await adjustments.openFirstSubmittedAdjustment();
    testInfo.annotations.push({ type: 'recalled adjustment', description: reference });
    await adjustments.recallFromSubmission();
    await adjustments.expectRecalledAdjustment(reference);
    await home.returnHome();
    await expectHome(page);
  });

  test('deletes a draft shift adjustment', async ({}, testInfo) => {
    await openAdjustmentList();
    await adjustments.selectStatus('Draft');
    await adjustments.expectFilteredAdjustments(['Draft']);
    const draft = await adjustments.openFirstDraftAdjustment();
    testInfo.annotations.push({ type: 'deleted adjustment', description: draft.reference });
    await adjustments.deleteDraftAdjustment(draft.id);
    await adjustments.expectDraftDeleted(draft.reference);
    await home.returnHome();
    await expectHome(page);
  });

  test('cancels a submitted or posting failed shift adjustment', async ({}, testInfo) => {
    await openAdjustmentList();
    await adjustments.selectStatus('Posting Failed');
    await adjustments.selectStatus('Submitted');
    await adjustments.expectFilteredAdjustments(['Posting Failed', 'Submitted']);
    const reference = await adjustments.openFirstFilteredAdjustment(['Posting Failed', 'Submitted']);
    testInfo.annotations.push({ type: 'cancelled adjustment', description: reference });
    await adjustments.cancelAdjustment(
      process.env.TEST_CANCELLATION_REASON ?? 'Initiator Cancellation',
      process.env.TEST_CANCELLATION_COMMENT ??
        'Cancelled during automated cancellation workflow validation.',
    );
    await adjustments.expectCancelledAdjustment(reference);
    await home.returnHome();
    await expectHome(page);
  });
});