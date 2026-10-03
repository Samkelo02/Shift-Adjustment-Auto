import { expect } from '@playwright/test';

export class HomePage {
  constructor(page, { timeout = 60_000 } = {}) {
    this.page = page;
    this.timeout = timeout;
    this.newAdjustmentButton = page
      .locator('ui5-button')
      .filter({ hasText: /^New Shift Adjustment$/ })
      .getByRole('button');
    this.homeTab = page.getByRole('tab', { name: 'Home', exact: true });
    this.insightsTab = page.getByRole('tab', { name: 'Insights', exact: true });
  }

  async goto() {
    await this.page.goto('/home');
    await expect(this.page).toHaveURL(/\/home/, { timeout: this.timeout });
  }

  async startNewAdjustment() {
    await expect(this.page.locator('ui5-busy-indicator[active]:visible'))
      .toHaveCount(0, { timeout: this.timeout });
    await this.newAdjustmentButton.click({ timeout: this.timeout });
  }

  dashboardCard(title) {
    return this.page
      .locator('div')
      .filter({ hasText: new RegExp(`${title}.*across all users`, 'i') })
      .last();
  }

  async openPendingApprovals() {
    await this.dashboardCard('Total Pending Approval').click();
  }

  async returnHome() {
    await expect(this.homeTab).toBeVisible();
    await this.homeTab.click();
  }

  async openPostingFailures() {
    await this.dashboardCard('Total Posting Failed').click();
  }

  async openInsights() {
    await expect(this.insightsTab).toBeVisible();
    await this.insightsTab.click();
  }
}
