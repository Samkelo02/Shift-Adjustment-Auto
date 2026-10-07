import path from 'node:path';
import process from 'node:process';
import { mkdir } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { chromium } from '@playwright/test';
import { authProfile } from '../tests/support/auth-profiles.js';

const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--role')) {
  throw new Error('Usage: npm run auth -- --role <admin|initiator|approver>');
}
const role = args[1] ?? 'admin';
const authFile = authProfile(role).file;
const baseURL =
  process.env.SHIFT_ADJUSTMENT_BASE_URL ||
  'https://shift-adjustment-test.cfapps.eu10-005.hana.ondemand.com';

await mkdir(path.dirname(authFile), { recursive: true });

const browser = await chromium.launch({ headless: false });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(baseURL);
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    await prompt.question(
      `Sign in as the ${role} user and navigate to Home, then press Enter here to save the session.\n`,
    );
  } finally {
    prompt.close();
  }
  if (new URL(page.url()).pathname !== '/home') {
    throw new Error('Session was not saved. Navigate to the Home screen after signing in and try again.');
  }
  await context.storageState({ path: authFile });
  console.log(`Authentication state saved to ${authFile}`);
} finally {
  await browser.close();
}
