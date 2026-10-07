import { test, expect } from '@playwright/test';
import { HomePage } from '../../pages/home.page.js';
import { FaqPage, matchingFaqs } from '../../pages/faq.page.js';

async function expectHelpCentre(page) {
  await expect(page).toHaveURL(url => url.pathname === '/help-center');
  await expect(page.getByRole('heading', { name: 'Help Center', exact: true })).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/Something went wrong|Internal Server Error/i);
}

async function openSection(page, section) {
  await page.getByRole('button', { name: section, exact: true }).click();
  await expectHelpCentre(page);
  if (section === 'FAQ') {
    await expect(page.getByRole('heading', { name: 'Frequently Asked Questions', exact: true }))
      .toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Search frequently asked questions...', exact: true }))
      .toBeVisible();
    await expect(page.getByRole('heading', { name: 'Contact Information', exact: true })).toBeHidden();
  } else if (section === 'Guides') {
    for (const role of ['Administrator', 'Initiator', 'Approver', 'Employee Benefits']) {
      const guide = page.getByRole('heading', {
        name: new RegExp('^Shift Adjustment.*' + role + ' Guide$'),
      });
      await guide.scrollIntoViewIfNeeded();
      await expect(guide).toBeVisible();
    }
    await expect(page.getByRole('heading', { name: 'Frequently Asked Questions', exact: true }))
      .toBeHidden();
    await expect(page.getByRole('heading', { name: 'Contact Information', exact: true })).toBeHidden();
  } else {
    for (const title of ['Contact Information', 'Business Hours Response']) {
      const heading = page.getByRole('heading', { name: title, exact: true });
      await heading.scrollIntoViewIfNeeded();
      await expect(heading).toBeVisible();
    }
    await expect(page.getByRole('heading', { name: 'Frequently Asked Questions', exact: true }))
      .toBeHidden();
  }
}

test('Help Centre Navigation', async ({ page }) => {
  test.setTimeout(180_000);
  page.setDefaultTimeout(60_000);
  const home = new HomePage(page);

  await test.step('Open Help Centre from Home', async () => {
    await home.goto();
    await page.getByRole('button', { name: 'Help', exact: true }).click();
    await expectHelpCentre(page);
    await expect(page.getByRole('heading', { name: 'Frequently Asked Questions', exact: true }))
      .toBeVisible({ timeout: 60_000 });
  });

  for (const section of ['FAQ', 'Guides', 'Contact']) {
    await test.step('Navigate to ' + section, async () => {
      await openSection(page, section);
    });
  }

  await test.step('Navigate back through Guides and FAQ', async () => {
    await openSection(page, 'Guides');
    await openSection(page, 'FAQ');
  });

  await test.step('Return to Home', async () => {
    await home.returnHome();
    await expect(page).toHaveURL(url => url.pathname === '/home');
    await expect(home.homeTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: 'Help Center', exact: true })).toBeHidden();
  });
});


test('FAQ answers, search, and filters', async ({ page, baseURL }) => {
  test.setTimeout(600_000);
  page.setDefaultTimeout(60_000);
  const home = new HomePage(page);
  const faq = new FaqPage(page);
  const errors = [];
  const serverErrors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (new URL(response.url()).origin === new URL(baseURL).origin && response.status() >= 500) {
      serverErrors.push(response.status() + ' ' + response.url());
    }
  });
  let records;
  let roles;
  let categories;
  const expected = filters => matchingFaqs(records, filters);

  try {
    await test.step('Load FAQs and verify the default results and filter options', async () => {
      await home.goto();
      await page.getByRole('button', { name: 'Help', exact: true }).click();
      await expectHelpCentre(page);
      await faq.waitReady();
      records = await faq.readQuestionMetadata();
      roles = (await faq.options('role')).map(option => option.label);
      categories = (await faq.options('category')).map(option => option.label);
      expect(roles).toContain('All Roles');
      expect(categories).toContain('All Categories');
      expect(roles.length).toBeGreaterThan(1);
      expect(categories.length).toBeGreaterThan(1);
      expect(new Set(roles).size).toBe(roles.length);
      expect(new Set(categories).size).toBe(categories.length);
      expect(new Set(records.map(record => record.question)).size).toBe(records.length);
      for (const record of records) {
        expect(record.question).not.toBe('');
        expect(categories).toContain(record.category);
        expect(record.roles.length).toBeGreaterThan(0);
        for (const role of record.roles) expect(roles).toContain(role);
      }
      await faq.expectResults(records);
      await expect(faq.answers).toHaveCount(0);
      test.info().annotations.push({ type: 'FAQ coverage', description:
        records.length + ' questions, ' + (roles.length - 1) + ' roles, ' + (categories.length - 1) + ' categories, ' + ((roles.length - 1) * (categories.length - 1)) + ' role/category combinations' });
    });

    for (const record of records) {
      await test.step('Expand, collapse, and reopen: ' + record.question, async () => {
        await faq.checkAnswer(record);
      });
    }

    await test.step('Verify keyboard operation and only one answer open at a time', async () => {
      expect(records.length).toBeGreaterThan(1);
      const first = faq.question(records[0].question);
      await first.focus();
      await first.press('Enter');
      await expect(faq.answer(records[0].question)).toBeVisible();
      const second = faq.question(records[1].question);
      await second.focus();
      await second.press('Space');
      await expect(faq.answer(records[1].question)).toBeVisible();
      await expect(faq.answer(records[0].question)).toHaveCount(0);
      await expect(faq.answers).toHaveCount(1);
      await second.press('Enter');
      await expect(faq.answers).toHaveCount(0);
    });

    for (const record of records) {
      await test.step('Search a valid complete question: ' + record.question, async () => {
        await faq.searchFor(record.question, expected({ query: record.question }));
        await faq.question(record.question).click();
        await expect(faq.answer(record.question)).toHaveText(record.answer);
        await faq.clearSearch(records);
        await expect(faq.answers).toHaveCount(0);
      });
    }

    await test.step('Search full questions, partial text, mixed case, answers, and punctuation', async () => {
      const query = records[0].question;
      for (const value of [query, query.toUpperCase(), query.toLowerCase(), query.slice(0, Math.max(8, Math.floor(query.length / 2)))]) {
        await faq.searchFor(value, expected({ query: value }));
      }
      const answerOnlyWord = records.flatMap(record => record.answer.match(/[A-Za-z]{6,}/g) ?? [])
        .find(word => !records.some(record => record.question.toLowerCase().includes(word.toLowerCase())));
      expect(answerOnlyWord, 'Expected a searchable term found in answers but not questions').toBeTruthy();
      await faq.searchFor(answerOnlyWord, expected({ query: answerOnlyWord }));
      expect(await faq.questions.count()).toBeGreaterThan(0);
      for (const value of ['no-matching-faq-987654321', '[]()^$.*+?\\', '98765432109876543210', '<script>alert(1)</script>', '不存在的问题-987654321', 'x'.repeat(512)]) {
        await faq.searchFor(value, []);
        await faq.clearSearch(records);
      }
      await faq.question(records[0].question).click();
      await faq.searchFor(records[1].question, expected({ query: records[1].question }));
      await faq.clearSearch(records);
    });

    for (const role of roles.filter(role => role !== 'All Roles')) {
      await test.step('Filter by role: ' + role, async () => {
        await faq.select('role', role);
        await faq.expectResults(expected({ role }));
        await faq.select('role', 'All Roles');
        await faq.expectResults(records);
      });
    }
    for (const category of categories.filter(category => category !== 'All Categories')) {
      await test.step('Filter by category: ' + category, async () => {
        await faq.select('category', category);
        await faq.expectResults(expected({ category }));
        await faq.select('category', 'All Categories');
        await faq.expectResults(records);
      });
    }

    for (const role of roles.filter(role => role !== 'All Roles')) {
      await faq.select('role', role);
      for (const category of categories.filter(category => category !== 'All Categories')) {
        await test.step('Combine role ' + role + ' with category ' + category, async () => {
          await faq.select('category', category);
          const filtered = expected({ role, category });
          await faq.expectResults(filtered);
          if (filtered.length > 0) {
            const query = filtered[0].question;
            await faq.searchFor(query, expected({ role, category, query }));
            await faq.clearSearch(filtered);
          }
          await faq.searchFor('no-matching-faq-987654321', []);
          await faq.clearSearch(filtered);
        });
      }
      await faq.select('category', 'All Categories');
      await faq.expectResults(expected({ role }));
    }
    await faq.select('role', 'All Roles');
    await faq.expectResults(records);

    await test.step('Combine search and both filters; clear search without resetting filters', async () => {
      const record = records[0];
      const role = record.roles[0];
      const category = record.category;
      await faq.question(record.question).click();
      await faq.select('category', category);
      await expect(faq.answers).toHaveCount(0);
      await faq.select('role', role);
      await faq.searchFor(record.question.toUpperCase(), expected({ role, category, query: record.question }));
      await faq.searchFor('no-matching-faq-987654321', []);
      await faq.clearSearch(expected({ role, category }));
      await faq.question(record.question).click();
      await faq.select('role', 'All Roles');
      await expect(faq.answers).toHaveCount(0);
      await faq.expectResults(expected({ category }));
      await faq.select('category', 'All Categories');
      await faq.expectResults(records);
    });

    await test.step('Keep search and filters when visiting Guides and Contact and returning to FAQ', async () => {
      const record = records[0];
      await faq.select('role', record.roles[0]);
      await faq.select('category', record.category);
      await faq.searchFor(record.question, [record]);
      await openSection(page, 'Guides');
      await openSection(page, 'Contact');
      await openSection(page, 'FAQ');
      await expect(faq.search).toHaveValue(record.question);
      await faq.expectResults([record]);
      await faq.clearSearch(expected({ role: record.roles[0], category: record.category }));
      await faq.select('role', 'All Roles');
      await faq.select('category', 'All Categories');
      await faq.expectResults(records);
    });

    await test.step('Use the FAQ search, filters, and answers at tablet width', async () => {
      await page.setViewportSize({ width: 768, height: 900 });
      await expectHelpCentre(page);
      const record = records[0];
      await faq.select('role', record.roles[0]);
      await faq.select('category', record.category);
      await faq.searchFor(record.question, [record]);
      await faq.question(record.question).click();
      await expect(faq.answer(record.question)).toBeVisible();
      await expect.soft.poll(() => page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )).toBeLessThanOrEqual(2);
      await faq.clearSearch(expected({ role: record.roles[0], category: record.category }));
      await faq.select('role', 'All Roles');
      await faq.select('category', 'All Categories');
      await faq.expectResults(records);
    });

    await home.returnHome();
    await expect(page).toHaveURL(url => url.pathname === '/home');
  } finally {
    expect.soft(errors, 'Browser errors during FAQ testing').toEqual([]);
    expect.soft(serverErrors, 'Server errors during FAQ testing').toEqual([]);
  }
});