import { expect } from '@playwright/test';

export class HomePage {
  constructor(page) {
    this.page = page;
    this.newAdjustmentButton = page.getByRole('button', { name: 'Emphasized' }).first();
    this.homeTab = page.getByRole('tab', { name: 'Home' });
    this.insightsTab = page.getByRole('tab', { name: 'Insights' });
  }

  async goto() {
    await this.page.goto('/home');
    await expect(this.page).toHaveURL(/\/home/);
  }

  async startNewAdjustment() {
    await this.newAdjustmentButton.click();
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
