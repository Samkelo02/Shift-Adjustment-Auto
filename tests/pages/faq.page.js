import { expect } from '@playwright/test';

export class FaqPage {
  constructor(page) {
    this.page = page;
    this.root = page.getByRole('heading', { name: 'Frequently Asked Questions', exact: true })
      .locator('..').locator('..');
    this.search = page.getByRole('textbox', { name: 'Search frequently asked questions...', exact: true });
    this.questions = this.root.locator('button[type="button"]');
    this.answers = this.root.locator('button[type="button"] + div.border-t');
    this.empty = this.root.getByText('No questions match your search', { exact: true });
  }

  async waitReady() {
    await expect(this.root).toBeVisible();
    await expect.poll(() => this.questions.count(), { timeout: 60_000 }).toBeGreaterThan(0);
    await expect(this.root.locator('ui5-busy-indicator[active]:visible')).toHaveCount(0);
    await expect(this.search).toHaveValue('');
  }

  async options(kind) {
    return this.page.locator('#' + kind + '-filter').locator('ui5-option').evaluateAll(options =>
      options.map(option => ({ value: option.getAttribute('value'), label: option.textContent.trim() })),
    );
  }

  async select(kind, label) {
    const field = this.page.locator('#' + kind + '-filter');
    const option = (await this.options(kind)).find(option => option.label === label);
    expect(option, 'Expected available ' + kind + ' filter: ' + label).toBeTruthy();
    await field.click();
    await this.page.getByRole('option', { name: label, exact: true }).last().click();
    await expect.poll(() => field.evaluate(element => element.selectedOption?.value ?? ''))
      .toBe(option.value);
  }

  async expectResults(expected) {
    const questions = expected.map(record => record.question).sort();
    await expect.poll(() => this.questions.evaluateAll(buttons =>
      buttons.map(button => button.querySelector('p').textContent.trim()).sort(),
    ), { timeout: 15_000, message: 'FAQ results must exactly match the active search and filters' })
      .toEqual(questions);
    await expect(this.root.getByText(expected.length + (expected.length === 1 ? ' question found' : ' questions found'), { exact: true }))
      .toBeVisible();
    if (expected.length === 0) await expect(this.empty).toBeVisible();
    else await expect(this.empty).toBeHidden();
  }

  async searchFor(query, expected) {
    await this.search.fill(query);
    await expect(this.search).toHaveValue(query);
    await this.expectResults(expected);
    await expect(this.answers).toHaveCount(0);
  }

  async clearSearch(expected) {
    await this.page.locator('#questions-search [part="clear-icon-wrapper"]').click();
    await expect(this.search).toHaveValue('');
    await this.expectResults(expected);
  }

  question(text) {
    return this.questions.filter({ has: this.page.getByText(text, { exact: true }) });
  }

  answer(text) {
    return this.question(text).locator('..').locator(':scope > div.border-t > p');
  }

  async readQuestionMetadata() {
    return this.questions.evaluateAll(buttons => buttons.map(button => {
      const badges = [...button.querySelectorAll('span')].map(span => span.textContent.trim());
      return { question: button.querySelector('p').textContent.trim(), category: badges[0], roles: badges.slice(1) };
    }));
  }

  async checkAnswer(record) {
    const button = this.question(record.question);
    const answer = this.answer(record.question);
    await expect(answer).toHaveCount(0);
    await button.click();
    await expect(answer).toBeVisible();
    await expect(this.answers).toHaveCount(1);
    record.answer = (await answer.innerText()).trim();
    expect(record.answer, 'FAQ answer must not be empty: ' + record.question).not.toBe('');
    await button.click();
    await expect(answer).toHaveCount(0);
    // Reopening must show the same answer.
    await button.click();
    await expect(answer).toHaveText(record.answer);
    await button.click();
    await expect(this.answers).toHaveCount(0);
  }
}

export function matchingFaqs(records, { query = '', role = 'All Roles', category = 'All Categories' } = {}) {
  const search = query.toLowerCase();
  return records.filter(record =>
    (role === 'All Roles' || record.roles.includes(role)) &&
    (category === 'All Categories' || record.category === category) &&
    (record.question.toLowerCase().includes(search) || record.answer.toLowerCase().includes(search)),
  );
}
