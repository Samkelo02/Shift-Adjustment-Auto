import path from 'node:path';

const profiles = {
  admin: {
    file: path.resolve('playwright/.auth/user.json'),
    secret: 'PLAYWRIGHT_AUTH_STATE',
    command: 'npm run auth',
  },
  approver: {
    file: path.resolve('playwright/.auth/approver.json'),
    secret: 'PLAYWRIGHT_APPROVER_AUTH_STATE',
    command: 'npm run auth:approver',
  },
  initiator: {
    file: path.resolve('playwright/.auth/initiator.json'),
    secret: 'PLAYWRIGHT_INITIATOR_AUTH_STATE',
    command: 'npm run auth:initiator',
  },
};

export function authProfile(role = 'admin') {
  if (!Object.hasOwn(profiles, role)) {
    throw new Error(`Unsupported authentication role: ${role}. Use admin, initiator, or approver.`);
  }
  return profiles[role];
}
