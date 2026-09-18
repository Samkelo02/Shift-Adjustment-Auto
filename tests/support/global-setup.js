import path from 'node:path';
import process from 'node:process';
import { access, mkdir, writeFile } from 'node:fs/promises';

const authFile = path.resolve('playwright/.auth/user.json');

export default async function globalSetup() {
  if (process.env.PLAYWRIGHT_AUTH_STATE) {
    let authState;

    try {
      authState = JSON.parse(process.env.PLAYWRIGHT_AUTH_STATE);
    } catch {
      throw new Error('PLAYWRIGHT_AUTH_STATE must contain valid Playwright storage-state JSON.');
    }

    await mkdir(path.dirname(authFile), { recursive: true });
    await writeFile(authFile, `${JSON.stringify(authState, null, 2)}\n`, 'utf8');
  }

  try {
    await access(authFile);
  } catch {
    throw new Error(
      'No saved login was found. Run "npm run auth" locally, or set PLAYWRIGHT_AUTH_STATE in CI.',
    );
  }
}
