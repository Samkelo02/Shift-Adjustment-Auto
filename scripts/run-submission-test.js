import path from 'node:path';
import process from 'node:process';
import { access } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const attachmentArgument = process.argv[2]?.replace(/^(["'])(.*)\1$/, '$2');

if (!attachmentArgument) {
  console.error('Usage: npm run test:submission -- <attachment-path>');
  process.exit(1);
}

const attachmentPath = path.resolve(attachmentArgument);

try {
  await access(attachmentPath);
} catch {
  console.error(`Attachment not found: ${attachmentPath}`);
  process.exit(1);
}

const playwrightCli = path.resolve('node_modules/@playwright/test/cli.js');
const child = spawn(
  process.execPath,
  [playwrightCli, 'test', 'add-new-shift-adjustment.spec.js', '--headed'],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      TEST_ATTACHMENT_PATH: attachmentPath,
    },
  },
);

child.on('error', (error) => {
  console.error(`Unable to start Playwright: ${error.message}`);
  process.exitCode = 1;
});

child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
