import { expect } from '@playwright/test';

export class AdminAdjustmentsPage {
  constructor(page) {
    this.page = page;
  }

  async selectStatus(status) {
    const statusFilter = this.page.locator('ui5-multi-combobox').first();
    await statusFilter.locator('.inputIcon').click();
    const escapedStatus = Array.from(status, character =>
      '.*+?^$()|[]{}'.includes(character) || character.charCodeAt(0) === 92
        ? String.fromCharCode(92) + character : character,
    ).join('');
    const option = this.page.getByRole('option', {
      name: new RegExp('Multiple Selection Mode ' + escapedStatus + '$', 'i'),
    });
    await expect(option).toBeVisible();
    const checkbox = option.getByRole('checkbox');
    if (!(await checkbox.isChecked())) await checkbox.click();
    await expect(checkbox).toBeChecked();
    await this.page.keyboard.press('Escape');
    await expect(statusFilter).toContainText(status);
  }

  async expectSubmittedAdjustments() {
    return this.expectFilteredAdjustments(['Submitted']);
  }

  async expectFilteredAdjustments(statuses) {
    const rows = this.page.locator('[role="rowgroup"]:visible [role="row"]');
    await expect.poll(async () => {
      const texts = await rows.allInnerTexts();
      return texts.length > 0 && texts.every(text =>
        text.split('\n').some(line => statuses.includes(line.trim())),
      );
    }, {
      timeout: 60_000,
      message: 'Expected at least one adjustment and only the selected statuses: ' + statuses.join(', '),
    }).toBe(true);
    return rows;
  }

  async openFirstSubmittedAdjustment() {
    return this.openFirstFilteredAdjustment(['Submitted']);
  }

  async openFirstFilteredAdjustment(statuses) {
    const rows = await this.expectFilteredAdjustments(statuses);
    const row = rows.first();
    const reference = (await row.innerText()).match(/SA-ADJ-\d{4}-\d+/)?.[0];
    expect(reference, 'The selected adjustment must have a reference number').toBeTruthy();
    const selectedRow = rows.filter({
      has: this.page.getByRole('gridcell', { name: reference, exact: true }),
    });
    await expect(selectedRow).toHaveCount(1, { timeout: 60_000 });
    await selectedRow.click();
    await expect(this.page).toHaveURL(/\/shift-adjustments\/[^/?]+$/, { timeout: 60_000 });
    await expect(this.page.locator('body')).toContainText(reference, { timeout: 60_000 });
    return reference;
  }

  async approveAdjustment() {
    await this.page.locator('ui5-button:visible').filter({ hasText: /^Approve$/ })
      .getByRole('button').click();
    const dialog = this.page.locator('ui5-dialog[open][id^="approve-adjustment-"]');
    await expect(dialog.getByText('Are you sure you want to approve this shift adjustment?', {
      exact: true,
    })).toBeVisible();
    await dialog.locator('ui5-button[id$="-confirm-button"]').getByRole('button').click();

    // The header mentions approval before the request runs; Close appears after completion.
    const close = dialog.locator('ui5-button:visible').filter({ hasText: /^Close$/ })
      .getByRole('button');
    await expect(close).toBeEnabled({ timeout: 90_000 });
    await expect(dialog).not.toContainText(/Posting Failed|Error Occurred/i);
    await expect(dialog.getByRole('heading', {
      name: 'Shift Adjustment Approved and Posted to SAP', exact: true,
    }).first()).toBeVisible();
    await close.click();
    await expect(this.page).toHaveURL(url => url.pathname === '/shift-adjustments', {
      timeout: 60_000,
    });
  }

  async expectApprovedAdjustment(reference) {
    await this.clearFilters();
    await this.selectStatus('Approved');
    await this.page.getByRole('textbox', { name: 'Search', exact: true }).fill(reference);
    const row = this.page.locator('[role="rowgroup"]:visible [role="row"]').filter({
      has: this.page.getByRole('gridcell', { name: reference, exact: true }),
    });
    await expect(row).toHaveCount(1, { timeout: 60_000 });
    await expect(row).toContainText(/\bApproved\b/, { timeout: 60_000 });
  }

  async rejectAdjustment(reason, comment) {
    await this.page.locator('ui5-button:visible').filter({ hasText: /^Reject$/ })
      .getByRole('button').click();
    const dialog = this.page.locator('ui5-dialog[open][id^="reject-adjustment-"]');
    await expect(dialog.getByText(
      'Please provide a reason for rejecting this shift adjustment. This will be communicated to the initiator.',
      { exact: true },
    )).toBeVisible();

    const reasons = dialog.locator('#reject-reasons');
    await expect.poll(async () => reasons.locator('ui5-option').evaluateAll(options =>
      options.filter(option => option.getAttribute('value')).map(option => option.textContent.trim()),
    ), { timeout: 60_000, message: 'Waiting for the configured rejection reason' })
      .toContain(reason);
    await reasons.click();
    await this.page.getByRole('option', { name: reason, exact: true }).last().click();
    const comments = dialog.locator('#confirmation-comment-box').getByRole('textbox');
    await comments.fill(comment);
    await expect(comments).toHaveValue(comment);

    const confirm = dialog.locator('ui5-button[id$="-confirm-button"]').getByRole('button');
    await expect(confirm).toBeEnabled();
    await confirm.click();

    // The initial header also says Rejected; wait for the completed result first.
    const close = dialog.locator('ui5-button:visible').filter({ hasText: /^Close$/ })
      .getByRole('button');
    await expect(close).toBeEnabled({ timeout: 60_000 });
    await expect(dialog).not.toContainText(/Posting Failed|Error Occurred/i);
    await expect(dialog.getByRole('heading', {
      name: 'Shift Adjustment Rejected', exact: true,
    }).first()).toBeVisible();
    await close.click();
    await expect(this.page).toHaveURL(url => url.pathname === '/shift-adjustments', {
      timeout: 60_000,
    });
  }

  async expectRejectedAdjustment(reference) {
    await this.clearFilters();
    await this.selectStatus('Rejected');
    await this.page.getByRole('textbox', { name: 'Search', exact: true }).fill(reference);
    const row = this.page.locator('[role="rowgroup"]:visible [role="row"]').filter({
      has: this.page.getByRole('gridcell', { name: reference, exact: true }),
    });
    await expect(row).toHaveCount(1, { timeout: 60_000 });
    await expect(row).toContainText(/\bRejected\b/, { timeout: 60_000, useInnerText: true });
  }

  async requestRecaptureAdjustment(reason, comment) {
    await this.page.locator('ui5-button:visible').filter({ hasText: /^Request Recapture$/ })
      .getByRole('button').click();
    const dialog = this.page.locator('ui5-dialog[open][id^="recapture-adjustment-"]');
    await expect(dialog.getByText(
      'Please provide a reason for requesting recapture. This will be communicated to the initiator.',
      { exact: true },
    )).toBeVisible();

    const reasons = dialog.locator('#recapture-reasons');
    await expect.poll(async () => reasons.locator('ui5-option').evaluateAll(options =>
      options.filter(option => option.getAttribute('value')).map(option => option.textContent.trim()),
    ), { timeout: 60_000, message: 'Waiting for the configured recapture reason' })
      .toContain(reason);
    await reasons.click();
    await this.page.getByRole('option', { name: reason, exact: true }).last().click();
    const comments = dialog.locator('#confirmation-comment-box').getByRole('textbox');
    await comments.fill(comment);
    await expect(comments).toHaveValue(comment);

    const confirm = dialog.locator('ui5-button[id$="-confirm-button"]').getByRole('button');
    await expect(confirm).toBeEnabled();
    await confirm.click();

    // The initial header also mentions recapture; wait for the completed result first.
    const close = dialog.locator('ui5-button:visible').filter({ hasText: /^Close$/ })
      .getByRole('button');
    await expect(close).toBeEnabled({ timeout: 60_000 });
    await expect(dialog).not.toContainText(/Posting Failed|Error Occurred/i);
    await expect(dialog.getByRole('heading', {
      name: 'Returned to Initiator for Recapture', exact: true,
    }).first()).toBeVisible();
    await close.click();
    await expect(this.page).toHaveURL(url => url.pathname === '/shift-adjustments', {
      timeout: 60_000,
    });
  }

  async expectRecaptureRequestedAdjustment(reference) {
    await this.clearFilters();
    await this.selectStatus('Recapture Requested');
    await this.page.getByRole('textbox', { name: 'Search', exact: true }).fill(reference);
    const row = this.page.locator('[role="rowgroup"]:visible [role="row"]').filter({
      has: this.page.getByRole('gridcell', { name: reference, exact: true }),
    });
    await expect(row).toHaveCount(1, { timeout: 60_000 });
    await expect(row).toContainText(/\bRecapture Requested\b/, { timeout: 60_000, useInnerText: true });
  }

  async recallFromSubmission() {
    await this.page.getByRole('button', { name: 'Recall From Submission', exact: true }).click();
    const dialog = this.page.locator('ui5-dialog[open][id^="recall-adjustment-"]');
    await expect(dialog.getByText(
      'Are you sure you want to recall this shift adjustment and move it back to draft mode?',
      { exact: true },
    )).toBeVisible();
    const confirm = dialog.locator('ui5-button[id$="-confirm-button"]').getByRole('button');
    await expect(confirm).toBeEnabled();
    await confirm.click();

    // Recall switches to edit mode and changes the dialog's identifier.
    const successHeading = this.page.getByRole('heading', {
      name: 'Shift Adjustment recalled from submission successfully.', exact: true,
    });
    const result = this.page.locator('ui5-dialog[open]').filter({ has: successHeading });
    await expect(result).toBeVisible({ timeout: 60_000 });
    const close = result.locator('ui5-button:visible').filter({ hasText: /^Close$/ })
      .getByRole('button');
    await expect(close).toBeEnabled();
    await close.click();
    await expect(this.page).toHaveURL(url => url.pathname === '/shift-adjustments', {
      timeout: 60_000,
    });
  }

  async expectRecalledAdjustment(reference) {
    await this.clearFilters();
    await this.selectStatus('Recalled');
    await this.page.getByRole('textbox', { name: 'Search', exact: true }).fill(reference);
    const row = this.page.locator('[role="rowgroup"]:visible [role="row"]').filter({
      has: this.page.getByRole('gridcell', { name: reference, exact: true }),
    });
    await expect(row).toHaveCount(1, { timeout: 60_000 });
    await expect(row).toContainText(/\bRecalled\b/, { timeout: 60_000, useInnerText: true });
  }

  async openFirstDraftAdjustment() {
    const rows = await this.expectFilteredAdjustments(['Draft']);
    const row = rows.first();
    const reference = (await row.innerText()).match(/SA-ADJ-\d{4}-\d+/)?.[0];
    expect(reference, 'The selected draft must have a reference number').toBeTruthy();
    const selectedRow = rows.filter({
      has: this.page.getByRole('gridcell', { name: reference, exact: true }),
    });
    await expect(selectedRow).toHaveCount(1, { timeout: 60_000 });
    await selectedRow.click();
    await expect(this.page).toHaveURL(url =>
      url.pathname === '/shift-adjustments/create' && Boolean(url.searchParams.get('id')),
    { timeout: 60_000 });
    const id = new URL(this.page.url()).searchParams.get('id');
    await expect(this.page.locator('ui5-button:visible').filter({ hasText: /^Delete$/ })
      .getByRole('button')).toBeEnabled({ timeout: 60_000 });
    return { reference, id };
  }

  async deleteDraftAdjustment(id) {
    await this.page.locator('ui5-button:visible').filter({ hasText: /^Delete$/ })
      .getByRole('button').click();
    const dialog = this.page.locator('ui5-dialog[open]#delete-draft-modal');
    await expect(dialog.getByText(
      'Are you sure you want to delete this shift adjustment? This action cannot be undone.',
      { exact: true },
    )).toBeVisible();
    const [response] = await Promise.all([
      this.page.waitForResponse(response =>
        response.request().method() === 'DELETE' &&
        new URL(response.url()).pathname.endsWith('/' + id),
      { timeout: 60_000 }),
      dialog.locator('#delete-draft-modal-confirm-button').getByRole('button').click(),
    ]);
    await response.finished();
    expect(response.ok(), 'Deleting the selected draft returned HTTP ' + response.status()).toBe(true);
    this.adjustmentsApiPath = new URL(response.url()).pathname.replace(/\/[^/]+$/, '');
    await expect(this.page).toHaveURL(url => url.pathname === '/shift-adjustments', {
      timeout: 60_000,
    });
  }

  async expectDraftDeleted(reference) {
    await this.clearFilters();
    await this.selectStatus('Draft');
    const [response] = await Promise.all([
      this.page.waitForResponse(response => {
        const url = new URL(response.url());
        return response.request().method() === 'GET' &&
          url.pathname === this.adjustmentsApiPath &&
          [...url.searchParams.values()].some(value => value.includes(reference));
      }, { timeout: 60_000 }),
      this.page.getByRole('textbox', { name: 'Search', exact: true }).fill(reference),
    ]);
    await response.finished();
    expect(response.ok(), 'Searching drafts returned HTTP ' + response.status()).toBe(true);
    await expect(this.page.getByRole('heading', { name: 'Shift Adjustments (0)', exact: true }))
      .toBeVisible({ timeout: 60_000 });
    await expect(this.page.locator('[role="rowgroup"]:visible [role="row"]')).toHaveCount(0);
  }

  async cancelAdjustment(reason, comment) {
    await this.page.getByRole('button', { name: 'More Actions', exact: true }).click();
    const menu = this.page.locator('.drop-down-button-action-sheet:visible');
    await menu.locator('ui5-button').filter({ hasText: /^Cancel$/ }).getByRole('button').click();
    const dialog = this.page.locator('ui5-dialog[open][id^="cancel-adjustment-"]');
    await expect(dialog.getByText(
      'Are you sure you want to cancel this shift adjustment? This action cannot be undone.',
      { exact: true },
    )).toBeVisible();

    const reasons = dialog.locator('#cancellation-reasons');
    await expect.poll(async () => reasons.locator('ui5-option').evaluateAll(options =>
      options.filter(option => option.getAttribute('value')).map(option => option.textContent.trim()),
    ), { timeout: 60_000, message: 'Waiting for the configured cancellation reason' })
      .toContain(reason);
    await reasons.click();
    await this.page.getByRole('option', { name: reason, exact: true }).last().click();
    const comments = dialog.locator('#confirmation-comment-box').getByRole('textbox');
    await comments.fill(comment);
    await expect(comments).toHaveValue(comment);

    const confirm = dialog.locator('ui5-button[id$="-confirm-button"]').getByRole('button');
    await expect(confirm).toBeEnabled();
    await confirm.click();

    const result = this.page.locator('ui5-dialog[open]').filter({
      has: this.page.getByRole('heading', { name: 'Shift Adjustment cancelled.', exact: true }),
    });
    await expect(result).toBeVisible({ timeout: 60_000 });
    const close = result.locator('ui5-button:visible').filter({ hasText: /^Close$/ })
      .getByRole('button');
    await expect(close).toBeEnabled();
    await close.click();
    await expect(this.page).toHaveURL(url => url.pathname === '/shift-adjustments', {
      timeout: 60_000,
    });
  }

  async expectCancelledAdjustment(reference) {
    await this.clearFilters();
    await this.selectStatus('Cancelled');
    await this.page.getByRole('textbox', { name: 'Search', exact: true }).fill(reference);
    const row = this.page.locator('[role="rowgroup"]:visible [role="row"]').filter({
      has: this.page.getByRole('gridcell', { name: reference, exact: true }),
    });
    await expect(row).toHaveCount(1, { timeout: 60_000 });
    await expect(row).toContainText(/\bCancelled\b/, { timeout: 60_000, useInnerText: true });
  }

  async selectAllStatusesExceptPending() {
    const filter = this.page.locator('#status-filter');
    await expect.poll(() => filter.locator('ui5-mcb-item').count(), { timeout: 60_000 })
      .toBeGreaterThan(0);
    const statuses = (await filter.locator('ui5-mcb-item').evaluateAll(items =>
      items.map(item => item.getAttribute('text')),
    )).filter(status => status && status.toLowerCase() !== 'pending');
    expect(statuses.length, 'Expected selectable statuses other than Pending').toBeGreaterThan(0);
    for (const status of statuses) await this.selectStatus(status);
    const selected = await filter.locator('ui5-mcb-item[selected]').evaluateAll(items =>
      items.map(item => item.getAttribute('text')).sort(),
    );
    expect(selected).toEqual([...statuses].sort());
    return statuses;
  }

  async openFirstAdjustmentWithHistory(statuses) {
    const rows = await this.expectFilteredAdjustments(statuses);
    const texts = await rows.allInnerTexts();
    // Draft and Recalled records open the creation form, which has no history actions.
    const index = texts.findIndex(text => !text.split('\n').some(line =>
      ['Draft', 'Recalled', 'Pending'].includes(line.trim()),
    ));
    expect(index, 'Expected a record with history actions in the filtered list').toBeGreaterThanOrEqual(0);
    const reference = texts[index].match(/SA-ADJ-\d{4}-\d+/)?.[0];
    expect(reference, 'The selected adjustment must have a reference number').toBeTruthy();
    // Keep the selected identity when filtering updates or reorders the rows.
    const selectedRow = rows.filter({
      has: this.page.getByRole('gridcell', { name: reference, exact: true }),
    });
    await expect(selectedRow).toHaveCount(1, { timeout: 60_000 });
    await selectedRow.click();
    await expect(this.page).toHaveURL(url =>
      /^\/shift-adjustments\/[^/]+$/.test(url.pathname) && url.pathname !== '/shift-adjustments/create',
    { timeout: 60_000 });
    await expect(this.page.locator('body')).toContainText(reference, { timeout: 60_000 });
    return reference;
  }

  async navigateAdjustmentHistory(section, reference) {
    await this.page.getByRole('button', { name: 'More Actions', exact: true }).click();
    const menu = this.page.locator('.drop-down-button-action-sheet:visible');
    await menu.locator('ui5-button').filter({ hasText: section }).getByRole('button').click();
    const heading = this.page.getByRole('heading', { name: section + ' for ' + reference, exact: true });
    // Both histories use the same dialog ID; identify the open dialog by its heading.
    const dialog = this.page.locator('ui5-dialog[open]').filter({ has: heading });
    await expect(dialog).toBeVisible({ timeout: 60_000 });
    await expect(heading).toBeVisible();
    await expect(dialog.locator('ui5-busy-indicator[active]:visible')).toHaveCount(0, {
      timeout: 60_000,
    });
    await expect(dialog).not.toContainText(/Something went wrong|Internal Server Error/i);
    const items = dialog.getByRole('list', { name: 'Timeline', exact: true }).getByRole('listitem');
    if (section === 'Audit Trail') {
      await expect.poll(() => items.count(), { timeout: 60_000 }).toBeGreaterThan(0);
    }
    const count = await items.count();
    for (let index = 0; index < count; index++) {
      await items.nth(index).scrollIntoViewIfNeeded();
      await expect(items.nth(index)).toBeVisible();
    }
    await dialog.locator('ui5-button:visible').filter({ hasText: /^Close$/ })
      .getByRole('button').click();
    await expect(dialog).toHaveCount(0);
    await expect(this.page.locator('body')).toContainText(reference, { timeout: 60_000 });
    return count;
  }

  async selectAbsenceType(absenceType) {
    const filter = this.page.locator('[id="absence type-filter"]');
    await filter.locator('.inputIcon').click();

    const option = this.page.getByRole('option', {
      name: `Multiple Selection Mode ${absenceType}`, exact: true,
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
