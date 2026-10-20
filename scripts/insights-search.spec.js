import { test, expect } from '@playwright/test';
import { searchAndExpectRows } from '../tests/support/insights-checks.js';

async function table(page, rows) {
  await page.setContent('<input aria-label="Search"><div role="rowgroup"></div>');
  await page.evaluate(rows => {
    document.querySelector('[role="rowgroup"]').innerHTML = rows.map(text => '<div role="row">' + text + '</div>').join('');
  }, rows);
}

test('waits past an existing match until unrelated rows disappear', async ({ page }) => {
  await table(page, ['Thomas Example', 'Galaletsang Cavan Masango']);
  await page.evaluate(() => {
    document.querySelector('input').addEventListener('input', () => {
      setTimeout(() => {
        document.querySelector('[role="rowgroup"]').innerHTML = '<div role="row">Thomas Example</div>';
        window.searchComplete = true;
      }, 1200);
    });
  });
  await searchAndExpectRows(page, 'Thomas');
  expect(await page.evaluate(() => window.searchComplete)).toBe(true);
});

test('fails when an unrelated result remains', async ({ page }) => {
  await table(page, ['Thomas Example', 'Galaletsang Cavan Masango']);
  await expect(searchAndExpectRows(page, 'Thomas', 'Thomas', { timeout: 500 }))
    .rejects.toThrow('without unrelated records');
});

test('soft search also waits for filtering and matches literal punctuation', async ({ page }) => {
  await table(page, ['Doctor (A)', 'Doctor A']);
  await page.evaluate(() => {
    document.querySelector('input').addEventListener('input', () => {
      setTimeout(() => {
        document.querySelector('[role="rowgroup"]').innerHTML = '<div role="row">Doctor (A)</div>';
        window.searchComplete = true;
      }, 1200);
    });
  });
  await searchAndExpectRows(page, 'Doctor (A)', 'Doctor (A)', { soft: true });
  expect(await page.evaluate(() => window.searchComplete)).toBe(true);
});
