import path from 'node:path';
import process from 'node:process';
import { mkdir } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { chromium } from '@playwright/test';

const baseURL =
  process.env.SHIFT_ADJUSTMENT_BASE_URL ||
  'https://shift-adjustment-test.cfapps.eu10-005.hana.ondemand.com';
const authFile = path.resolve('playwright/.auth/user.json');

await mkdir(path.dirname(authFile), { recursive: true });

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();

try {
  await page.goto(baseURL);

  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  await prompt.question(
    'Sign in and navigate to the Home screen, then press Enter here to save the session.\n',
  );
  prompt.close();

  await context.storageState({ path: authFile });
  console.log(`Authentication state saved to ${authFile}`);
} finally {
  await browser.close();
}
