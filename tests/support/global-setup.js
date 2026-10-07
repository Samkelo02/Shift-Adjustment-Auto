import path from 'node:path';
import process from 'node:process';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { authProfile } from './auth-profiles.js';

export default async function globalSetup(config) {
  const role = config.metadata.authRole ?? 'admin';
  const profile = authProfile(role);
  const secret = process.env[profile.secret];

  if (secret) {
    let authState;
    try {
      authState = JSON.parse(secret);
      if (!Array.isArray(authState?.cookies) || !Array.isArray(authState?.origins)) {
        throw new Error('Invalid storage state');
      }
    } catch {
      throw new Error(`${profile.secret} must contain valid Playwright storage-state JSON with cookies and origins arrays.`);
    }
    await mkdir(path.dirname(profile.file), { recursive: true });
    await writeFile(profile.file, `${JSON.stringify(authState, null, 2)}\n`, 'utf8');
  }

  try {
    await access(profile.file);
  } catch {
    throw new Error(
      `No saved ${role} login was found. Run "${profile.command}" locally, or set ${profile.secret} in CI.`,
    );
  }
}
