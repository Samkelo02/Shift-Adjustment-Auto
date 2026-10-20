import { test, expect } from '../../support/regression-test.js';
import { HomePage } from '../../pages/home.page.js';

async function openPanel(page, name) {
  const tab = page.getByRole('tab', { name, exact: true });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
  await expect(page).toHaveURL(url => url.pathname === '/insights');
  await expect(page.locator('body')).not.toContainText(/Something went wrong|Internal Server Error/i);
}

async function selectPeriod(page, value) {
  const filter = page.locator('#period-filter:visible');
  await filter.click();
  await page.locator(`ui5-option[value="${value}"]`).filter({ visible: true }).last().click();
  await expect(filter).toHaveAttribute('value', value);
}

async function checkEmptySearch(page, query = 'no-matching-insights-record-987654321') {
  const search = page.getByRole('textbox', { name: 'Search', exact: true });
  await search.fill(query);
  await search.press('Enter');
  await expect(page.getByRole('heading', { name: /No Data Found/i }).first()).toBeVisible();
  await expect(page.locator('[role="rowgroup"]:visible [role="row"]:visible')).toHaveCount(0);
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(search).toHaveValue('');
  await expect(page.locator('#period-filter:visible')).toHaveAttribute('value', 'this-month');
}

async function checkPostingFailuresSearch(page) {
  const rows = page.locator('[role="rowgroup"]:visible [role="row"]:visible');
  const firstCode = rows.first().getByRole('gridcell').first();
  await expect(firstCode).toBeVisible();
  const query = (await firstCode.innerText()).trim();
  expect(query, 'Posting Failures must have a valid error code to search').not.toBe('');

  const search = page.getByRole('textbox', { name: 'Search', exact: true });
  await search.fill(query);
  await search.press('Enter');
  await expect.poll(async () => {
    const codes = await rows.getByRole('gridcell').allInnerTexts();
    return codes.includes(query);
  }).toBe(true);
  await expect.poll(async () => {
    const texts = await rows.allInnerTexts();
    return texts.length > 0 && texts.every(text => text.includes(query));
  }, { message: 'Valid Posting Failures search should return only matching rows' }).toBe(true);

  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(search).toHaveValue('');
  await checkEmptySearch(page, 'xyz');
}

test('Insights Navigation', async ({ page, baseURL }, testInfo) => {
  test.setTimeout(240_000);
  page.setDefaultTimeout(30_000);
  expect(['approver', 'employee-benefits']).toContain(testInfo.project.name);
  const browserErrors = [];
  const serverErrors = [];
  page.on('pageerror', error => browserErrors.push(error.message));
  page.on('response', response => {
    if (new URL(response.url()).origin === new URL(baseURL).origin && response.status() >= 500) {
      serverErrors.push(response.status() + ' ' + new URL(response.url()).pathname);
    }
  });
  const home = new HomePage(page);
  try {
    await test.step('Open Insights from Home', async () => {
      await home.goto();
      await home.openInsights();
      await openPanel(page, 'Overview');
      await expect(page.getByText('Total Submissions', { exact: true })).toBeVisible();
      await expect(page.getByText('Submission Outcomes', { exact: true })).toBeVisible();
      await expect(page.getByText('Status Distribution', { exact: true })).toBeVisible();
    });

    await test.step('Change every Overview period and reset the filter', async () => {
      for (const value of ['last-month', 'last-3-months', 'last-6-months', 'this-year', 'last-year', 'this-month']) {
        await selectPeriod(page, value);
      }
      await page.getByRole('button', { name: 'Clear', exact: true }).click();
      await expect(page.locator('#period-filter:visible')).toHaveAttribute('value', 'this-month');
    });

    for (const panel of ['Absences', 'Ageing']) {
      await test.step('Navigate to ' + panel, async () => { await openPanel(page, panel); });
    }

    await test.step('Employees: Overview and Long Term Sick Leave searches', async () => {
      await openPanel(page, 'Employees');
      await expect(page.getByRole('heading', { name: /Employees Overview \(\d+\)/ })).toBeVisible();
      await checkEmptySearch(page);
      const sickLeave = page.getByRole('option', { name: 'Long Term Sick Leave', exact: true });
      await sickLeave.click();
      await expect(sickLeave).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByRole('heading', { name: /Long Term Sick Leave \(\d+\)/ })).toBeVisible();
      await selectPeriod(page, 'this-year');
      await checkEmptySearch(page);
    });

    await test.step('User Analytics: expand and collapse performance trends', async () => {
      await openPanel(page, 'User Analytics');
      for (const name of ['Initiator Performance', 'Approver Performance', 'Employee Benefits Performance']) {
        await page.getByText(name, { exact: true }).click();
        const trends = page.getByText(name + ' Trends', { exact: true });
        await expect(trends).toBeVisible();
        await page.getByText(name, { exact: true }).click();
        await expect(trends).toBeHidden();
      }
      const adoption = page.getByRole('option', { name: 'User Adoption', exact: true });
      await adoption.click();
      await expect(adoption).toHaveAttribute('aria-selected', 'true');
      await checkEmptySearch(page);
    });

    for (const panel of ['Organizational', 'Medical']) {
      await test.step('Navigate to ' + panel, async () => { await openPanel(page, panel); });
    }

    await test.step('Exceptions: Reason Codes and Posting Failures searches', async () => {
      await openPanel(page, 'Exceptions');
      const reasons = page.getByRole('option', { name: 'Reason Codes', exact: true });
      await expect(reasons).toHaveAttribute('aria-selected', 'true');
      await checkEmptySearch(page);
      const failures = page.getByRole('option', { name: 'Posting Failures', exact: true });
      await failures.click();
      await expect(failures).toHaveAttribute('aria-selected', 'true');
      await checkPostingFailuresSearch(page);
    });

    await test.step('Visit Data Export and return Home', async () => {
      await openPanel(page, 'Data Export');
      await home.returnHome();
      await expect(page).toHaveURL(url => url.pathname === '/home');
      await expect(home.homeTab).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByRole('heading', { name: /^Good .*!$/ })).toBeVisible();
      if (testInfo.project.name === 'approver') {
        await expect(page.getByText('Pending My Review', { exact: true })).toBeVisible();
      }
    });
  } finally {
    expect.soft(browserErrors, 'Browser errors during Insights testing').toEqual([]);
    expect.soft(serverErrors, 'Server errors during Insights testing').toEqual([]);
  }
});
