import { test as base, expect } from './admin-session-test.js';
import { createHash } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
const stepScope = new AsyncLocalStorage();

let active;
const instrumented = new WeakSet();
const locatorPrototypes = new WeakSet();
const identities = new WeakMap();

async function identity(page, info) {
  const previous = identities.get(page) || {};
  const visibleText = async selector => {
    if (!selector) return '';
    const field = page.locator(selector).filter({ visible: true }).first();
    return await field.count() ? (await field.textContent())?.trim() || '' : '';
  };
  const menu = page.getByRole('dialog', { name: /^User menu for/i }).filter({ visible: true }).first();
  const menuOpen = Boolean(await menu.count());
  const greetingField = page.getByRole('heading', { name: /^Good .*!$/ }).first();
  const greetingSnapshot = await greetingField.count() ? await greetingField.ariaSnapshot() : '';
  const headingName = greetingSnapshot.match(/^- heading ("(?:\\.|[^"\\])*")/m)?.[1];
  const greeting = headingName ? JSON.parse(headingName) : '';
  const menuSnapshot = menuOpen ? await menu.ariaSnapshot() : '';
  const dialogName = menuSnapshot.match(/^- dialog ("(?:\\.|[^"\\])*")/m)?.[1];
  // Playwright locators pierce UI5 shadow roots; document.querySelector does not.
  const menuName = dialogName ? JSON.parse(dialogName).replace(/^User menu for\s*/i, '').trim() : '';
  const observed = {
    name: await visibleText(process.env.REGRESSION_USER_SELECTOR) || menuName ||
      greeting?.replace(/^Good\s+(morning|afternoon|evening|day)[,\s]*/i, '').replace(/!$/, '').trim(),
    role: await visibleText(process.env.REGRESSION_ROLE_SELECTOR) ||
      (menuOpen ? menuSnapshot.match(/\b(Administrator|Employee Benefits|Approver|Initiator|Admin)\b/)?.[1] : ''),
  };
  const value = {
    name: observed.name || previous.name || process.env.REGRESSION_USER_NAME || 'Not detected',
    nameSource: observed.name ? 'Application UI' : previous.nameSource || (process.env.REGRESSION_USER_NAME ? 'Operator supplied' : 'Unavailable'),
    role: observed.role || previous.role || process.env.REGRESSION_USER_ROLE || info.project.name,
    roleSource: observed.role ? 'Application UI' : previous.roleSource || (process.env.REGRESSION_USER_ROLE ? 'Operator supplied' : 'Configured test role (not verified in application)'),
  };
  identities.set(page, value);
  return value;
}

async function capture(page, description, outcome = 'observed', force = false) {
  const state = active;
  if (!state || state.capturing || page.isClosed() || page.url() === 'about:blank') return;
  state.capturing = true;
  const record = { description, outcome, timestamp: new Date().toISOString(), url: page.url(), stepPath: stepScope.getStore()?.path || [] };
  try {
    Object.assign(record, await identity(page, state.info));
    // Wait briefly for busy indicators and rendering without making evidence a test assertion.
    await page.locator('ui5-busy-indicator[active]:visible').waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {});
    const buffer = await page.screenshot({ animations: 'disabled', timeout: 5000 });
    const hash = createHash('sha256').update(buffer).digest('hex');
    if (!force && state.lastHash === hash) return;
    state.lastHash = hash;
    record.screenshot = 'regression-screen-' + (state.records.length + 1);
    await state.info.attach(record.screenshot, { body: buffer, contentType: 'image/png' });
  } catch (error) {
    record.captureError = error.message;
  } finally {
    state.capturing = false;
  }
  state.records.push(record);
}

function wrapAction(target, method, getPage, label) {
  const original = target[method];
  if (typeof original !== 'function') return;
  target[method] = async function (...args) {
    const page = getPage(this);
    const description = label(this, method);
    await capture(page, 'Before ' + description);
    let outcome = 'completed';
    try {
      return await original.apply(this, args);
    } catch (error) {
      outcome = 'failed';
      throw error;
    } finally {
      await capture(page, 'After ' + description, outcome);
    }
  };
}

function instrumentPage(page) {
  if (instrumented.has(page)) return;
  instrumented.add(page);
  for (const method of ['goto', 'goBack', 'goForward', 'reload', 'setContent', 'click', 'dblclick', 'fill', 'check', 'uncheck', 'selectOption', 'press']) {
    wrapAction(page, method, value => value, (_, name) => 'page.' + name);
  }
  for (const method of ['press', 'type', 'insertText']) {
    wrapAction(page.keyboard, method, () => page, (_, name) => 'keyboard.' + name);
  }
  const prototype = Object.getPrototypeOf(page.locator('body'));
  if (!locatorPrototypes.has(prototype)) {
    locatorPrototypes.add(prototype);
    for (const method of ['click', 'dblclick', 'fill', 'check', 'uncheck', 'setChecked', 'selectOption', 'press', 'hover', 'scrollIntoViewIfNeeded', 'setInputFiles']) {
      // Do not include entered values, file paths, or credentials in action descriptions.
      wrapAction(prototype, method, locator => locator.page(), (locator, name) => name + ' on ' + locator.toString());
    }
  }
}

export const test = base.extend({
  browser: [async ({ browser }, use) => {
    if (process.env.REGRESSION_REPORT !== '1') return use(browser);
    workerBrowser = browser;
    const original = browser.newContext;
    browser.newContext = async function (...args) {
      const context = await original.apply(this, args);
      context.on('page', instrumentPage);
      const closeContext = context.close;
      context.close = async function (...closeArgs) {
        for (const page of context.pages()) await capture(page, 'Screen before browser context closes', active?.info.status || 'observed', true);
        return closeContext.apply(this, closeArgs);
      };
      return context;
    };
    try { await use(browser); } finally { browser.newContext = original; }
  }, { scope: 'worker' }],
  regressionEvidence: [async ({ browser }, use, info) => {
    if (process.env.REGRESSION_REPORT !== '1') return use();
    active = { info, records: [], capturing: false };
    try {
      for (const context of browser.contexts()) {
        for (const page of context.pages()) {
          instrumentPage(page);
          await capture(page, 'Screen at test start', 'observed', true);
        }
      }
      await use();
    } finally {
      for (const context of browser.contexts()) {
        for (const page of context.pages()) await capture(page, 'Final screen: ' + info.status, info.status, true);
      }
      const records = active.records;
      active = undefined;
      await info.attach('regression-evidence', {
        body: Buffer.from(JSON.stringify(records)), contentType: 'application/json',
      });
    }
  }, { auto: true }],
});

const originalStep = test.step;
test.step = function (title, body, options) {
  if (process.env.REGRESSION_REPORT !== '1') return originalStep.call(this, title, body, options);
  return originalStep.call(this, title, async step => {
    const parent = stepScope.getStore();
    return stepScope.run({ path: [...(parent?.path || []), title] }, async () => {
      let outcome = 'completed';
      try { return await body(step); }
      catch (error) { outcome = 'failed'; throw error; }
      finally {
        if (active) {
          for (const context of activeBrowserContexts()) {
            for (const page of context.pages()) await capture(page, title, outcome, true);
          }
        }
      }
    });
  }, options);
};

// The worker browser can include pages created in beforeAll and reused across tests.
let workerBrowser;
function activeBrowserContexts() { return workerBrowser?.contexts() || []; }
export { expect };
