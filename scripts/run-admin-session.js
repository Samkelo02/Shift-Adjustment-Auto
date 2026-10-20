import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import config from '../playwright.config.js';
import globalSetup from '../tests/support/global-setup.js';

const interactiveLogin = process.argv.includes('--login');
const runId = new Date().toISOString().replace(/[:.]/g, '-') + '-admin-single-session-' + process.pid;
const outputDir = path.resolve('regression-reports', runId);
await mkdir(outputDir, { recursive: true });
await globalSetup({ metadata: { authRole: 'admin' } });
const server = net.createServer();
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const port = server.address().port;
await new Promise(resolve => server.close(resolve));
let browser;
try {
  browser = await chromium.launch({ headless: !interactiveLogin, args: ['--remote-debugging-port=' + port, '--remote-debugging-address=127.0.0.1'] });
  const context = await browser.newContext({ ...config.use, headless: undefined, trace: undefined, screenshot: undefined, video: undefined, viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const endpoint = 'http://127.0.0.1:' + port;
  // Check authentication once before allowing workflows to change server data.
  await page.goto(config.use.baseURL + '/home', { waitUntil: 'domcontentloaded' });
  console.log('Authentication check: ' + new URL(page.url()).origin + new URL(page.url()).pathname);
  if (interactiveLogin) console.log('Please sign in as Administrator in the browser. Tests start automatically when Home is visible.');
  await page.getByRole('heading', { name: /^Good .*!$/ }).waitFor({ timeout: interactiveLogin ? 900000 : 60000 });
  await context.storageState({ path: config.use.storageState });
  console.log('Admin login confirmed. All selected admin tests will reuse this browser context and tab.');
  console.log('Regression report folder: ' + outputDir);
  await writeFile(path.join(outputDir, 'session.json'), JSON.stringify({ mode: 'single-login-session', role: 'admin', started: new Date().toISOString(), browserContexts: 1, tabs: 1, survivesWorkerRestart: true }, null, 2));
  const child = spawn(process.execPath, [path.resolve('node_modules/@playwright/test/cli.js'), 'test', '--config=playwright.config.js', '--project=admin', '--workers=1', '--retries=0', '--reporter=list,./scripts/regression-reporter.js'], {
    stdio: 'inherit', env: { ...process.env, REGRESSION_REPORT: '1', REGRESSION_OUTPUT_DIR: outputDir, REGRESSION_SESSION_ENDPOINT: endpoint },
  });
  process.exitCode = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', code => resolve(code ?? 1)); });
} finally {
  await browser?.close();
}
