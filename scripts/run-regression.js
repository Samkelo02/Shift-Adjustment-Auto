import path from 'node:path';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { authProfile } from '../tests/support/auth-profiles.js';

const args = process.argv.slice(2);
let role = 'admin';
const roleIndex = args.indexOf('--role');
if (roleIndex !== -1) {
  role = args[roleIndex + 1];
  if (!role || role.startsWith('--')) throw new Error('--role requires a role name.');
  args.splice(roleIndex, 2);
}
authProfile(role);
if (args.some(arg => /^--(config|reporter|list|ui|debug|help|version)(=|$)/.test(arg) || ['-c', '-h', '-v'].includes(arg))) {
  throw new Error('The regression runner selects its configuration and reporter. Use test filenames, --grep, or --headed to select a run.');
}
const config = role === 'admin' ? 'playwright.config.js' : 'playwright.' + role + '.config.js';
const runId = new Date().toISOString().replace(/[:.]/g, '-') + '-' + role + '-' + process.pid;
const outputDir = path.resolve('regression-reports', runId);
await mkdir(outputDir, { recursive: true });
console.log('Regression report folder: ' + outputDir);
const child = spawn(process.execPath, [
  path.resolve('node_modules/@playwright/test/cli.js'), 'test', '--config=' + config,
  '--reporter=list,./scripts/regression-reporter.js', ...args,
], {
  stdio: 'inherit',
  env: { ...process.env, REGRESSION_REPORT: '1', REGRESSION_OUTPUT_DIR: outputDir },
});
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
