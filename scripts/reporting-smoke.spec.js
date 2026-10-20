import { test, expect } from '../tests/support/regression-test.js';

test('captures identity, intermediate screens and step descriptions', async ({ page }) => {
  test.info().annotations.push({ type: 'prerequisite', description: 'The local sample screen is loaded.' });
  await page.goto('data:text/html,<h1>Good morning, Regression Tester!</h1><div id="assigned-role">Administrator</div><button onclick="document.querySelector(\'h1\').textContent=\'Second screen\'">Next</button>');
  await test.step('Visit the second screen', async () => {
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('heading')).toHaveText('Second screen');
  }, { params: { expectedResult: 'The second screen displays the heading ?Second screen?.' } });
});
test('retains screenshots and errors on failure', async ({ page }) => {
  await page.goto('data:text/html,<h1>Good morning, Regression Tester!</h1><div id="assigned-role">Administrator</div>');
  await test.step('Intentional regression failure', async () => {
    expect(1, 'Smoke validation failure').toBe(2);
  });
});
test('documents skipped scenarios', async () => { test.skip(true, 'Smoke validation skip'); });
test.describe('shared browser context', () => {
  let context;
  let page;
  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await page.goto('data:text/html,<h1>Good morning, Shared Tester!</h1><div id="assigned-role">Approver</div><button onclick="document.querySelector(\'h1\').textContent=\'Shared screen\'">Next</button>');
  });
  test.afterAll(async () => { await context.close(); });
  test('captures pages created in beforeAll', async () => {
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('heading')).toHaveText('Shared screen');
  });
});

test('reports identity gaps explicitly', async ({ page }) => {
  await page.goto('data:text/html,<h1>Screen without user profile</h1>');
  await expect(page.getByRole('heading')).toHaveText('Screen without user profile');
});
test('captures identity inside UI5-style shadow DOM', async ({ page }) => {
  const html = '<user-title>Good evening, Shadow Tester!</user-title><div id="assigned-role">Approver</div><script>customElements.define("user-title", class extends HTMLElement { constructor() { super(); this.attachShadow({mode:"open"}).innerHTML="<h3><slot></slot></h3>"; } });</script>';
  await page.goto('data:text/html,' + encodeURIComponent(html));
  await expect(page.getByRole('heading', { name: 'Good evening, Shadow Tester!' })).toBeVisible();
});


test('reports successful polling by its final assertion result', async ({ page }) => {
  await page.goto('data:text/html,<h1>Polling sample</h1>');
  await test.step('Wait for a value after unsuccessful polling attempts', async () => {
    let attempts = 0;
    await expect.poll(() => ++attempts, { intervals: [10], timeout: 2000 }).toBeGreaterThanOrEqual(3);
  });
});

test('preserves a polling assertion failure after timeout', async ({ page }) => {
  await page.goto('data:text/html,<h1>Polling failure sample</h1>');
  await test.step('Polling remains unsuccessful', async () => {
    await expect.poll(() => 0, { intervals: [10], timeout: 100 }).toBe(1);
  });
});
