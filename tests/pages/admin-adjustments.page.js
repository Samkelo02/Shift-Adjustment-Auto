import { expect } from '@playwright/test';

export class AdminAdjustmentsPage {
  constructor(page) {
    this.page = page;
  }

  async selectStatus(status) {
    const statusFilter = this.page.locator('ui5-multi-combobox').first();
    await statusFilter.locator('.inputIcon').click();

    const option = this.page.getByRole('option', {
      name: new RegExp(`Multiple Selection Mode ${status}`, 'i'),
    });
    await expect(option).toBeVisible();
    const checkbox = option.getByRole('checkbox');
    if (!(await checkbox.isChecked())) await checkbox.click();
    await expect(checkbox).toBeChecked();
    await this.page.keyboard.press('Escape');
    await expect(statusFilter).toContainText(status);
  }

  async selectAbsenceType(absenceType) {
    const filter = this.page.locator('[id="absence type-filter"]');
    await filter.locator('.inputIcon').click();

    const option = this.page.getByRole('option', {
      name: new RegExp(`Multiple Selection Mode ${absenceType}`, 'i'),
    });
    await expect(option).toBeVisible();
    const checkbox = option.getByRole('checkbox');
    if (!(await checkbox.isChecked())) await checkbox.click();
    await expect(checkbox).toBeChecked();
    await this.page.keyboard.press('Escape');
    await expect(filter).toContainText(absenceType);
  }

  async exerciseSearch(searchText) {
    const search = this.page.getByRole('textbox', { name: 'Search' });
    await search.fill(searchText);
    await expect(search).toHaveValue(searchText);
    await search.clear();
    await expect(search).toHaveValue('');
  }

  async clearFilters() {
    const clearButton = this.page.getByRole('button', { name: 'Clear' });
    await expect(clearButton).toBeEnabled();
    await clearButton.click();
  }
}
