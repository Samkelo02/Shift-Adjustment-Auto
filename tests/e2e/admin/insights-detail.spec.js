import { stat } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

const periods = {
  'This Month': 'this-month',
  'This Year': 'this-year',
};

function activeDataRows(page) {
  return page.locator('[role="rowgroup"]:visible [role="row"]:visible');
}

async function selectPeriod(page, label) {
  const periodFilter = page.locator('#period-filter:visible');
  await periodFilter.click();
  await page.locator(`ui5-option[value="${periods[label]}"]`).last().click();
  await expect(periodFilter).toHaveAttribute('value', periods[label]);
}

async function selectPersonnelArea(page, area) {
  const areaFilter = page.getByRole('combobox', { name: 'Filter by Personnel Area' });
  await areaFilter.click();
  await page.keyboard.type(area);
  const escapedArea = area.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matchingOption = page.getByRole('option', { name: new RegExp(`${escapedArea}$`, 'i') }).last();
  await expect(matchingOption).toBeVisible();
  await matchingOption.click();
}

async function searchAndExpectRows(page, query, expectedText = query, { soft = false } = {}) {
  const search = page.getByRole('textbox', { name: 'Search' });
  await search.fill(query);

  if (soft) {
    await page.waitForTimeout(1_000);
    const rowTexts = await activeDataRows(page).allInnerTexts();
    expect.soft(rowTexts, `Search for "${query}" should return a matching record`).toEqual(
      expect.arrayContaining([expect.stringMatching(new RegExp(expectedText, 'i'))]),
    );
    for (const rowText of rowTexts) {
      expect.soft(rowText, `Search for "${query}" returned an unrelated record`).toMatch(
        new RegExp(expectedText, 'i'),
      );
    }
    return;
  }

  await expect
    .poll(async () => activeDataRows(page).allInnerTexts())
    .toEqual(expect.arrayContaining([expect.stringMatching(new RegExp(expectedText, 'i'))]));

  for (const rowText of await activeDataRows(page).allInnerTexts()) {
    expect(rowText).toMatch(new RegExp(expectedText, 'i'));
  }
}

async function searchUsingFirstRowOrVerifyEmpty(page, options) {
  const rows = activeDataRows(page);
  await page.waitForTimeout(750);

  if (await rows.count()) {
    const query = (await rows.first().innerText()).trim().split(/\s+/)[0];
    await searchAndExpectRows(page, query, query, options);
    return query;
  }

  await page.getByRole('textbox', { name: 'Search' }).fill('no-matching-record-12345');
  await expect(rows).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /No Data Found/i }).first()).toBeVisible();
  return null;
}

async function verifyDownload(page, expectedName, exportLabel) {
  if (await activeDataRows(page).count() === 0) {
    await expect(page.getByRole('heading', { name: /No Data Found/i }).first()).toBeVisible();
    return;
  }

  await page.getByRole('button', { name: 'Download' }).click();
  const dialog = page.getByRole('dialog', { name: 'Download Options' });
  await expect(dialog).toBeVisible();

  const downloadPromise = page.waitForEvent('download', { timeout: 5_000 }).catch(() => null);
  await page.getByRole('listitem', { name: /Excel Is Active/i }).click();
  const download = await downloadPromise;

  expect.soft(download, `${exportLabel} should start a browser download`).not.toBeNull();
  if (!download) {
    if (await dialog.isVisible()) await dialog.getByRole('button', { name: 'Cancel' }).click();
    return;
  }

  expect(download.suggestedFilename()).toMatch(expectedName);
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  expect((await stat(downloadPath)).size).toBeGreaterThan(0);
}

async function selectInsightsPanel(page, panelName) {
  const panel = page.getByRole('tab', { name: panelName, exact: true });
  await panel.click();
  await expect(panel).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('body')).not.toContainText(/Something went wrong|Internal Server Error/i);
}

test.describe('Detailed Insights coverage', () => {
  test('tests every Insights tab without refreshing the page', async ({ page }) => {
    test.setTimeout(240_000);
    await page.goto('/insights');

    for (const panelName of ['Overview', 'Absences', 'Ageing']) {
      await test.step(`Open ${panelName}`, async () => {
        await selectInsightsPanel(page, panelName);
      });
    }

    await test.step('Employees: filter and export Employees Overview', async () => {
      await selectInsightsPanel(page, 'Employees');
      await page.getByRole('button', { name: 'Clear' }).click();
      await expect(page.getByRole('option', { name: 'Employees Overview', exact: true })).toHaveAttribute('aria-selected', 'true');
      await searchAndExpectRows(page, 'Thomas');
      await page.getByRole('button', { name: 'Clear' }).click();

      await selectPeriod(page, 'This Year');
      await selectPersonnelArea(page, 'Dishaba Shaft');
      await expect.poll(async () => activeDataRows(page).allInnerTexts()).toEqual(
        expect.arrayContaining([expect.stringMatching(/Dishaba Shaft/i)]),
      );
      for (const rowText of await activeDataRows(page).allInnerTexts()) {
        expect(rowText).toMatch(/Dishaba Shaft/i);
      }

      await verifyDownload(
        page,
        /employees.*overview.*\.(csv|xlsx)$/i,
        'Employees Overview export',
      );
    });

    await test.step('Employees: filter and export Long Term Sick Leave', async () => {
      await page.getByRole('button', { name: 'Clear' }).click();
      await page.getByRole('option', { name: 'Long Term Sick Leave', exact: true }).click();
      await expect(page.getByRole('option', { name: 'Long Term Sick Leave', exact: true })).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByRole('heading', { name: /Long Term Sick Leave \(\d+\)/ })).toBeVisible();

      await selectPeriod(page, 'This Year');
      await searchUsingFirstRowOrVerifyEmpty(page);
      await page.getByRole('textbox', { name: 'Search' }).fill('');
      await selectPersonnelArea(page, 'Dishaba Shaft');
      for (const rowText of await activeDataRows(page).allInnerTexts()) {
        expect(rowText).toMatch(/Dishaba Shaft/i);
      }

      await verifyDownload(
        page,
        /long.*term.*sick.*leave.*\.(csv|xlsx)$/i,
        'Long Term Sick Leave export',
      );
    });

    await test.step('User Analytics: filters and role drill-downs', async () => {
      await selectInsightsPanel(page, 'User Analytics');
      await page.getByRole('button', { name: 'Clear' }).click();
      await selectPeriod(page, 'This Month');
      await selectPersonnelArea(page, 'Mogalakwena Mining');
      await page.getByRole('textbox', { name: 'Search' }).fill('Samukelisiwe');

      for (const performance of [
        'Initiator Performance',
        'Approver Performance',
        'Employee Benefits Performance',
      ]) {
        await page.getByText(performance, { exact: true }).click();
        const trends = page.getByText(`${performance} Trends`, { exact: true });
        await expect(trends).toBeVisible();
        await expect(page.locator('body')).not.toContainText(/Something went wrong|Internal Server Error/i);
        await page.getByText(performance, { exact: true }).click();
        await expect(trends).toBeHidden();
      }
    });

    await test.step('User Analytics: User Adoption', async () => {
      await page.getByRole('button', { name: 'Clear' }).click();
      await page.getByRole('option', { name: 'User Adoption', exact: true }).click();
      await expect(page.getByRole('option', { name: 'User Adoption', exact: true })).toHaveAttribute('aria-selected', 'true');
      await selectPeriod(page, 'This Month');
      await selectPersonnelArea(page, 'Mogalakwena Mining');
      await searchAndExpectRows(page, 'Initiator', 'Initiator', { soft: true });
      for (const rowText of await activeDataRows(page).allInnerTexts()) {
        expect(rowText).toMatch(/Mogalakwena Mining/i);
      }
    });

    for (const panelName of ['Organizational', 'Medical']) {
      await test.step(`Open ${panelName}`, async () => {
        await selectInsightsPanel(page, panelName);
      });
    }

    await test.step('Exceptions: exercise Reason Codes search and period', async () => {
      await selectInsightsPanel(page, 'Exceptions');
      await page.getByRole('button', { name: 'Clear' }).click();
      await expect(page.getByRole('option', { name: 'Reason Codes', exact: true })).toHaveAttribute('aria-selected', 'true');
      await selectPeriod(page, 'This Year');
      await searchUsingFirstRowOrVerifyEmpty(page, { soft: true });
      await expect(page.locator('body')).not.toContainText(/Something went wrong|Internal Server Error/i);
    });

    await test.step('Exceptions: filter Posting Failures', async () => {
      await page.getByRole('button', { name: 'Clear' }).click();
      await page.getByRole('option', { name: 'Posting Failures', exact: true }).click();
      await expect(page.getByRole('option', { name: 'Posting Failures', exact: true })).toHaveAttribute('aria-selected', 'true');
      await selectPeriod(page, 'This Month');
      await searchAndExpectRows(page, '014');
      await expect(page.getByRole('row', { name: /014 Quota Insufficient/i })).toBeVisible();
    });

    await test.step('Open Data Export', async () => {
      await selectInsightsPanel(page, 'Data Export');
    });
  });
});
