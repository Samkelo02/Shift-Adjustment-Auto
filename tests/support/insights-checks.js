import { expect } from './regression-test.js';

export function activeDataRows(page) {
  return page.locator('[role="rowgroup"]:visible [role="row"]:visible');
}

export async function searchAndExpectRows(page, query, expectedText = query, { soft = false, timeout = 15_000 } = {}) {
  await page.getByRole('textbox', { name: 'Search' }).fill(query);
  const matches = text => text.toLowerCase().includes(expectedText.toLowerCase());
  const assertion = soft ? expect.soft : expect;

  // An existing matching row does not mean a debounced search has completed.
  // Check a non-empty result and every row together, using the same snapshot.
  await assertion.poll(async () => {
    const rows = await activeDataRows(page).allInnerTexts();
    return {
      matches: rows.filter(matches),
      unrelated: rows.filter(text => !matches(text)),
    };
  }, { timeout, message: 'Search for "' + query + '" must return matching rows without unrelated records' })
    .toEqual({ matches: expect.arrayContaining([expect.any(String)]), unrelated: [] });
}
