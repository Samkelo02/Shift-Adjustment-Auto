import { expect } from '@playwright/test';

export class NewShiftAdjustmentPage {
  constructor(page) {
    this.page = page;
    this.employeeSearch = page.getByRole('textbox', {
      name: 'Search by employee number or',
    });
    this.form = page.locator('.p-2.sm\\:p-4');
    this.fileInput = page.locator('input[type="file"]');
  }

  async selectEmployee(searchText, employeeOption) {
    await this.employeeSearch.fill(searchText);
    await this.page
      .locator('#employee-selection-accordion')
      .getByRole('button', { name: 'Emphasized' })
      .click();

    const employee = this.page.getByText(employeeOption, { exact: true }).first();
    await expect(employee).toBeVisible();
    await employee.click();
    await expect(this.form).toBeVisible();
  }

  async uploadAttachment(filePath) {
    await this.fileInput.setInputFiles(filePath);
  }

  async selectDates(dateAccessibleName) {
    const datePickers = this.page.locator('ui5-date-picker');
    await expect(datePickers).toHaveCount(2);

    for (const index of [0, 1]) {
      await datePickers.nth(index).locator('.inputIcon').click();
      await this.page
        .getByRole('gridcell', { name: dateAccessibleName })
        .getByText(/\d+/)
        .click();
    }
  }

  async selectComboBoxOption(fieldSelector, optionName) {
    const field = fieldSelector
      ? this.page.locator(fieldSelector)
      : this.page.locator('ui5-combobox').first();

    await field.locator('.inputIcon').click();
    await this.page.getByText(optionName, { exact: true }).last().click();
  }

  async selectPractitioner(searchText, optionName) {
    await this.page
      .locator('#new-shift-adjustment-doctor-medicalPractitionerId-user-search .inputIcon')
      .click();
    const practitionerInput = this.page.getByRole('textbox', { name: 'Doctor Information' });
    await practitionerInput.fill(searchText);
    await this.page.getByRole('option', { name: optionName }).click();
  }

  async complete(data) {
    await this.uploadAttachment(data.attachmentPath);
    await this.selectDates(data.dateAccessibleName);
    await this.selectComboBoxOption(undefined, data.adjustmentType);
    await this.selectComboBoxOption('#new-shift-adjustment-absenceTypeId', data.absenceType);
    await this.selectComboBoxOption('#new-shift-adjustment-locationTypeId', data.location);
    await this.selectComboBoxOption(
      '#new-shift-adjustment-medicalPractitionerTypeId',
      data.practitionerType,
    );
    await this.selectPractitioner(data.practitionerSearch, data.practitionerOption);
  }

  async submit() {
    await this.form.getByRole('button', { name: 'Emphasized' }).last().click();
    await this.page
      .locator('#confirm-submit-action-modal-confirm-button')
      .getByRole('button', { name: 'Emphasized' })
      .click();

    const successMessage = this.page.locator(
      '.modal-crossfade-panel--inner ui5-illustrated-message',
    );
    await expect(successMessage).toBeVisible();
    await this.page.getByRole('button', { name: 'Close' }).click();
  }
}
