import { test, expect } from '../../support/regression-test.js';
import { HomePage } from '../../pages/home.page.js';

const roles = {
  admin: {
    label: 'Administrator',
    dashboardHeadings: ['Recent Activities', "Today's New Submissions"],
    dashboardLabels: ['Total Pending Approval', 'Total Posting Failed', 'Total Recapture Requested'],
    queueCards: ['Total Pending Approval', 'Total Posting Failed', 'Total Recapture Requested'],
    canCreateAdjustment: true,
  },
  approver: {
    label: 'Approver',
    dashboardHeadings: [],
    dashboardLabels: [
      'My Total Submissions Reviewed', 'My Approval Rate', 'My Approval Time',
      'Pending My Review', 'My Recent Reviews',
    ],
    queueCards: [],
    canCreateAdjustment: false,
  },
  'employee-benefits': {
    label: 'Employee Benefits',
    // Dashboard labels and creation permission await confirmation.
    dashboardHeadings: [],
    dashboardLabels: [],
    queueCards: [],
    canCreateAdjustment: null,
  },
};

async function expectHealthyPage(page, route) {
  await expect(page).toHaveURL(url => url.pathname === route);
  await expect(page.locator('ui5-busy-indicator[active]:visible')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(/Something went wrong|Internal Server Error/i);
}

async function expectNoDocumentOverflow(page) {
  await expect.poll(() => page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )).toBeLessThanOrEqual(2);
}

async function expectHome(page, role) {
  await expectHealthyPage(page, '/home');
  const home = new HomePage(page);
  await expect(home.homeTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: /^Good .*!$/ })).toBeVisible();
  for (const name of ['Shift Adjustment', 'Insights']) {
    await expect(page.getByRole('tab', { name, exact: true })).toBeVisible();
  }
  for (const name of role.dashboardHeadings) {
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  }
  for (const title of role.dashboardLabels) {
    await expect(page.getByText(title, { exact: true })).toBeVisible();
  }
  if (role.canCreateAdjustment === true) {
    await expect(home.newAdjustmentButton).toBeEnabled();
  } else if (role.canCreateAdjustment === false) {
    await expect(home.newAdjustmentButton).toBeHidden();
  }
}

async function expectAdjustments(page) {
  await expectHealthyPage(page, '/shift-adjustments');
  await expect(page.getByRole('tab', { name: 'Shift Adjustment', exact: true }))
    .toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: /Shift Adjustments \(\d+\)/ })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Search', exact: true })).toBeVisible();
}

async function expectInsights(page) {
  await expectHealthyPage(page, '/insights');
  await expect(new HomePage(page).insightsTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: 'Overview', exact: true })).toBeVisible();
}

test('Home Page Navigation', async ({ page, baseURL }, testInfo) => {
  test.setTimeout(300_000);
  page.setDefaultTimeout(30_000);
  expect(Object.keys(roles), 'Home navigation supports these role projects')
    .toContain(testInfo.project.name);
  const role = roles[testInfo.project.name];
  const home = new HomePage(page);
  const browserErrors = [];
  const serverErrors = [];
  const origin = new URL(baseURL).origin;
  const onPageError = error => browserErrors.push(error.message);
  const onResponse = response => {
    if (new URL(response.url()).origin === origin && response.status() >= 500) {
      serverErrors.push(response.status() + ' ' + new URL(response.url()).pathname);
    }
  };
  page.on('pageerror', onPageError);
  page.on('response', onResponse);
  const initialViewport = page.viewportSize();

  try {
    await test.step('Verify login and assigned role', async () => {
      // Load once and retain this page and session throughout navigation.
      await home.goto();
      await expect(page.getByRole('heading', { name: /^Good .*!$/ })).toBeVisible();
      await page.getByRole('banner', { name: 'Shell Bar' })
        .getByRole('button', { name: /Avatar/ }).click();
      const menu = page.getByRole('dialog', { name: /^User menu for/ });
      await expect(menu).toBeVisible();
      await expect.poll(() => menu.ariaSnapshot(), {
        message: 'The signed-in profile must show the configured role',
      }).toMatch(new RegExp('\\b' + role.label + '\\b'));
      await page.keyboard.press('Escape');
      await expect(menu).toBeHidden();
    }, { params: { expectedResult: 'The signed-in profile displays the ' + role.label + ' role.' } });

    await test.step('Check the role dashboard and permitted Home actions', async () => {
      await expectHome(page, role);
      await expectNoDocumentOverflow(page);
      if (role.canCreateAdjustment === null) {
        testInfo.annotations.push({
          type: 'coverage-gap',
          description: 'Employee Benefits dashboard cards and New Shift Adjustment permission await confirmation.',
        });
      }
    });

    for (const title of role.queueCards) {
      await test.step('Open ' + title + ' and return to Home', async () => {
        await home.dashboardCard(title).click();
        await expectAdjustments(page);
        await home.returnHome();
        await expectHome(page, role);
      });
    }

    await test.step('Navigate the main tabs and browser back and forward', async () => {
      await page.getByRole('tab', { name: 'Shift Adjustment', exact: true }).click();
      await expectAdjustments(page);
      await home.openInsights();
      await expectInsights(page);
      await page.goBack();
      await expectAdjustments(page);
      await page.goBack();
      await expectHome(page, role);
      await page.goForward();
      await expectAdjustments(page);
      await home.homeTab.focus();
      await home.homeTab.press('Enter');
      await expectHome(page, role);
    });

    if (role.canCreateAdjustment === true) {
      await test.step('Open New Shift Adjustment and return without submitting', async () => {
        await home.startNewAdjustment();
        await expect(page.getByRole('heading', { name: 'New Shift Adjustment', exact: true })).toBeVisible();
        await expect(page.getByRole('textbox', { name: 'Search by employee number or' })).toBeVisible();
        await page.getByRole('button', { name: 'Navigate Back', exact: true }).click();
        await expectHome(page, role);
      });
    }

    await test.step('Open and dismiss notifications', async () => {
      await page.getByRole('button', { name: /Notifications/ }).click();
      const notifications = page.locator('ui5-dialog[open]');
      await expect(notifications).toBeVisible();
      await notifications.locator('ui5-button:visible').filter({ hasText: /^(Close|Cancel)$/ })
        .getByRole('button').click();
      await expect(notifications).toHaveCount(0);
      await expectHome(page, role);
    });

    await test.step('Reopen and dismiss the profile menu', async () => {
      await page.getByRole('banner', { name: 'Shell Bar' })
        .getByRole('button', { name: /Avatar/ }).click();
      const menu = page.getByRole('dialog', { name: /^User menu for/ });
      // Record a profile failure while continuing independent Help and layout checks.
      await expect.soft(menu, 'The profile menu must reopen after dismissal').toBeVisible();
      await page.keyboard.press('Escape');
      await expect(menu).toBeHidden();
      await expectHome(page, role);
    });

    await test.step('Open Help, visit FAQ, Guides and Contact, and return Home', async () => {
      await page.getByRole('button', { name: 'Help', exact: true }).click();
      await expectHealthyPage(page, '/help-center');
      await expect(page.getByRole('heading', { name: 'Help Center', exact: true })).toBeVisible();
      for (const [section, heading] of [
        ['FAQ', 'Frequently Asked Questions'],
        ['Guides', new RegExp('^Shift Adjustment.*' + role.label + ' Guide$')],
        ['Contact', 'Contact Information'],
      ]) {
        await page.getByRole('button', { name: section, exact: true }).click();
        const title = page.getByRole('heading', { name: heading, exact: true });
        await title.scrollIntoViewIfNeeded();
        await expect(title).toBeVisible();
      }
      await home.returnHome();
      await expectHome(page, role);
    });

    for (const width of [1440, 768]) {
      await test.step('Navigate Home, Shift Adjustment and Insights at viewport width ' + width, async () => {
        await page.setViewportSize({ width, height: 900 });
        await expectHome(page, role);
        await expectNoDocumentOverflow(page);
        await page.getByRole('tab', { name: 'Shift Adjustment', exact: true }).click();
        await expectAdjustments(page);
        await expectNoDocumentOverflow(page);
        await home.returnHome();
        await expectHome(page, role);
        await home.openInsights();
        await expectInsights(page);
        await expectNoDocumentOverflow(page);
        await home.returnHome();
        await expectHome(page, role);
      });
    }
  } finally {
    page.off('pageerror', onPageError);
    page.off('response', onResponse);
    if (initialViewport && !page.isClosed()) await page.setViewportSize(initialViewport);
    expect.soft(browserErrors, 'Browser errors: ' + browserErrors.join('\n')).toEqual([]);
    expect.soft(serverErrors, 'Server errors: ' + serverErrors.join('\n')).toEqual([]);
  }
});

