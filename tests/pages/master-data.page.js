import { stat } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

export class MasterDataPage {
  constructor(page) {
    this.page = page;
    this.search = page.getByRole('textbox', { name: 'Search', exact: true });
    this.rows = page.locator('[role="rowgroup"]:visible [role="row"]');
    // UI5 puts the dialog role inside its shadow root; controls are light-DOM siblings.
    this.dialog = page.locator('ui5-dialog[open]');
    this.noResults = page.getByRole('heading', { name: /^No (?:search )?results found$/i });
  }

  button(text, scope = this.page) {
    // Accessible button names expose the localized design (Emphasized/Emphasised).
    return scope.locator('ui5-button:visible').filter({ hasText: text }).getByRole('button');
  }

  async open(tab, option) {
    this.referenceSection = { tab, option };
    await this.page.goto('/admin/reference', { waitUntil: 'domcontentloaded' });
    await expect(this.page.getByRole('tab', { name: 'Reference Data', exact: true }))
      .toHaveAttribute('aria-selected', 'true');
    await this.selectTab(tab);
    if (option) await this.selectOption(option);
    await this.waitForTable();
  }

  async selectTab(name) {
    const tab = this.page.getByRole('tab', { name, exact: true });
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
  }

  async selectOption(name) {
    const option = this.page.getByRole('option', { name, exact: true });
    await option.click();
    await expect(option).toHaveAttribute('aria-selected', 'true');
  }

  async waitForTable() {
    await expect(this.search).toBeVisible();
    await expect(this.page.getByRole('grid')).toBeVisible();
  }

  row(value) {
    return this.rows.filter({ has: this.page.getByRole('gridcell', { name: value, exact: true }) });
  }

  async setSearch(query) {
    await this.search.fill(query);
    await this.search.press('Enter');
    await expect(this.search).toHaveValue(query);
  }

  async searchFor(query) {
    await this.setSearch(query);
    await expect.poll(async () => {
      const texts = await this.rows.allTextContents();
      return texts.length > 0 && texts.every(text => text.toLowerCase().includes(query.toLowerCase()));
    }, { message: `All search results should match "${query}"` }).toBe(true);
  }

  async selectFilter(id, label) {
    const filter = this.page.locator(`[id="${id}"]:visible`);
    await expect(filter.getByRole('combobox')).toBeEnabled();
    await filter.click();
    await this.page.getByRole('option', { name: label, exact: true }).click();
    await expect(filter.getByRole('combobox')).toMatchAriaSnapshot(`- combobox: ${JSON.stringify(label)}`);
  }

  async openForm(addLabel, title) {
    await this.button(addLabel).click();
    await expect(this.dialog).toBeVisible();
    await expect(this.dialog.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(this.button(/^Add$/, this.dialog)).toBeDisabled();
  }

  async fill(fields) {
    for (const [label, value] of Object.entries(fields)) {
      await this.dialog.getByRole('textbox', { name: label, exact: true }).fill(value);
    }
  }

  async closeForm() {
    await this.button(/^Close$/, this.dialog).click();
    await expect(this.dialog).toHaveCount(0);
  }

  async verifyDownloads() {
    for (const [label, extension] of [['CSV', /\.csv$/i], ['Excel', /\.xlsx?$/i]]) {
      await test.step(`Verify ${label} export`, async () => {
        await this.page.getByRole('button', { name: 'Download', exact: true }).click();
        await expect(this.page.getByRole('dialog', { name: 'Download Options' })).toBeVisible();
        const [download] = await Promise.all([
          this.page.waitForEvent('download'),
          label === 'CSV'
            ? this.page.getByRole('listitem', { name: 'CSV Is Active', exact: true }).dblclick()
            : this.page.getByRole('listitem', { name: 'Excel Is Active', exact: true }).click(),
        ]);
        expect(download.suggestedFilename()).toMatch(extension);
        expect(await download.failure()).toBeNull();
        const downloadPath = await download.path();
        expect(downloadPath).not.toBeNull();
        expect((await stat(downloadPath)).size, 'Export should contain data').toBeGreaterThan(0);
      });
    }
  }

  async verifyRecordLifecycle({ key, name, addLabel, title, fields, prepare, confirmation }) {
    const { tab, option } = this.referenceSection;
    await this.setSearch(key);
    await expect(this.noResults).toBeVisible();
    await expect(this.row(key)).toHaveCount(0);
    await this.openForm(addLabel, title);
    await this.fill(fields);
    if (prepare) await prepare();
    const save = this.button(/^Add$/, this.dialog);
    await expect(save).toBeEnabled();

    // Cleanup also runs when a post-save assertion fails. Only this run's exact key is deleted.
    try {
      await test.step(`Create and verify ${name}`, async () => {
        await save.click();
        await expect(this.dialog).toHaveCount(0);
        await this.searchFor(key);
        await expect(this.row(key)).toHaveCount(1);
        await expect(this.row(key)).toContainText(name);
        await this.open(tab, option);
        await this.searchFor(key);
        await expect(this.row(key)).toHaveCount(1);
        await expect(this.row(key)).toContainText(name);
        await this.row(key).locator('ui5-button[icon="edit"]').click();
        await expect(this.dialog).toBeVisible();
        for (const [label, value] of Object.entries(fields)) {
          await expect(this.dialog.getByRole('textbox', { name: label, exact: true })).toHaveValue(value);
        }
        await this.closeForm();
      });
    } finally {
      await test.step(`Delete test record ${key}`, async () => {
        await this.open(tab, option);
        await this.setSearch(key);
        await expect.poll(async () =>
          await this.row(key).count() > 0 || await this.noResults.isVisible(),
        ).toBe(true);
        const row = this.row(key);
        if (await row.count()) {
          await expect(row).toHaveCount(1);
          await row.locator('ui5-button[icon="delete"]').click();
          await this.page.locator(`#${confirmation}`).click();
          await expect(row).toHaveCount(0);
          await this.open(tab, option);
          await this.setSearch(key);
          await expect(this.noResults).toBeVisible();
          await expect(row).toHaveCount(0);
        }
      });
    }
  }
}
