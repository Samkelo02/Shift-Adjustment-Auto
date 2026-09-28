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

  async selectDates(startDate, endDate) {
    const dateInputs = this.page.getByRole('textbox', { name: 'yyyy-MM-dd' });
    await expect(dateInputs).toHaveCount(2);

    for (const [index, date] of [startDate, endDate].entries()) {
      await dateInputs.nth(index).fill(date);
      await dateInputs.nth(index).press('Tab');
    }
  }

  async selectComboBoxOption(fieldSelector, optionName) {
    const field = fieldSelector
      ? this.page.locator(fieldSelector)
      : this.page.locator('ui5-combobox').first();

    await field.locator('.inputIcon').click();
    await this.page.getByText(optionName, { exact: true }).last().click();
  }

  async selectPractitioner(searchText) {
    const practitionerInput = this.page.getByRole('textbox', { name: 'Doctor Information' });
    await practitionerInput.evaluate((element) => element.scrollIntoView({ block: 'center' }));
    await practitionerInput.fill('');
    await practitionerInput.pressSequentially(searchText, { delay: 50 });
    const suggestions = this.page.getByRole('dialog', { name: 'Available Values' });
    await expect(suggestions).toBeVisible();
    await this.page.getByRole('option').first().click();
  }

  async complete(data) {
    await this.uploadAttachment(data.attachmentPath);
    await this.selectDates(data.startDate, data.endDate);
    await this.selectComboBoxOption(undefined, data.adjustmentType);
    await this.selectComboBoxOption('#new-shift-adjustment-absenceTypeId', data.absenceType);
    await this.selectComboBoxOption('#new-shift-adjustment-locationTypeId', data.location);
    await this.selectComboBoxOption(
      '#new-shift-adjustment-medicalPractitionerTypeId',
      data.practitionerType,
    );
    await this.selectPractitioner(data.practitionerSearch);
  }

  async verifyDetails(data) {
    const dateInputs = this.page.getByRole('textbox', { name: 'yyyy-MM-dd' });
    await expect(dateInputs.nth(0)).toHaveValue(data.startDate);
    await expect(dateInputs.nth(1)).toHaveValue(data.endDate);
    await expect(
      this.page.getByText(data.practitionerOption, { exact: false }).filter({ visible: true }).first(),
    ).toBeVisible();
  }

  async submit() {
    await this.page.getByText('Submit for Approval', { exact: true }).first().click();
    await this.page
      .locator('#confirm-submit-action-modal-confirm-button')
      .getByRole('button', { name: 'Emphasized' })
      .click();

    const duplicateMessage = this.page
      .getByText(/A shift adjustment for this employee and date range already exists/i)
      .first();
    const failureHeading = this.page
      .getByRole('heading', { name: /shift adjustment submission failed/i })
      .first();
    const successHeading = this.page
      .getByRole('heading', { name: /shift adjustment submitted successfully/i })
      .first();
    const keepEditingButton = this.page.getByRole('button', { name: 'Keep Editing' }).first();
    const closeButton = this.page.getByRole('button', { name: 'Close' }).first();
    let outcome = 'pending';
    let candidate = 'pending';
    let candidateSince = Date.now();

    await expect.poll(async () => {
      let current = 'pending';
      if (await successHeading.isVisible() && await closeButton.isVisible()) {
        current = 'submitted';
      } else if (await keepEditingButton.isVisible()) {
        if (await duplicateMessage.isVisible()) current = 'duplicate';
        else if (await failureHeading.isVisible()) current = 'failed';
      }
      if (current !== candidate) {
        candidate = current;
        candidateSince = Date.now();
      }
      outcome = current === 'submitted' ||
        (current !== 'pending' && Date.now() - candidateSince >= 2_000)
        ? current : 'pending';
      return outcome;
    }, { timeout: 40_000 }).not.toBe('pending');

    if (outcome === 'duplicate') return outcome;
    if (outcome === 'failed') {
      throw new Error('Shift adjustment submission failed; inspect the Playwright report.');
    }

    await closeButton.click();
    return outcome;
  }
}
