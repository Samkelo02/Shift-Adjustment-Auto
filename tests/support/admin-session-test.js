import { test as base, expect } from '@playwright/test';

// The parent runner owns this browser so worker restarts preserve the login.
export const test = process.env.REGRESSION_SESSION_ENDPOINT ? base.extend({
  browser: [async ({ playwright }, use) => {
    const browser = await playwright.chromium.connectOverCDP(process.env.REGRESSION_SESSION_ENDPOINT);
    try { await use(browser); } finally { await browser.close(); }
  }, { scope: 'worker' }],
  context: async ({ browser }, use) => {
    const context = browser.contexts().find(context => context.pages().length > 0);
    if (!context) throw new Error('The shared admin login session is unavailable.');
    await use(context);
  },
  page: async ({ context, viewport, actionTimeout, navigationTimeout, baseURL }, use, info) => {
    const page = context.pages()[0];
    if (!page || page.isClosed()) throw new Error('The shared admin tab was closed.');
    if (!page.__adminSessionNavigation) {
      const goto = page.goto.bind(page);
      page.goto = (url, options) => goto(new URL(url, baseURL).href, options);
      page.__adminSessionNavigation = true;
    }
    const listeners = new Map(page.eventNames().map(name => [name, new Set(page.listeners(name))]));
    page.setDefaultTimeout(actionTimeout);
    page.setDefaultNavigationTimeout(navigationTimeout);
    if (viewport) await page.setViewportSize(viewport);
    info.annotations.push({ type: 'session', description: 'One authenticated browser context and tab, retained across tests and worker restarts.' });
    try { await use(page); } finally {
      for (const name of page.eventNames()) {
        for (const listener of page.listeners(name)) {
          if (!listeners.get(name)?.has(listener)) page.removeListener(name, listener);
        }
      }
    }
  },
}) : base;
export { expect };
