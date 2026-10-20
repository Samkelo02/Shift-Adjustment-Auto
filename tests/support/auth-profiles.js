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
  'employee-benefits': {
    file: path.resolve('playwright/.auth/employee-benefits.json'),
    secret: 'PLAYWRIGHT_EMPLOYEE_BENEFITS_AUTH_STATE',
    command: 'npm run auth:employee-benefits',
  },
  initiator: {
    file: path.resolve('playwright/.auth/initiator.json'),
    secret: 'PLAYWRIGHT_INITIATOR_AUTH_STATE',
    command: 'npm run auth:initiator',
  },
};

export function authProfile(role = 'admin') {
  if (!Object.hasOwn(profiles, role)) {
    throw new Error(`Unsupported authentication role: ${role}. Use admin, initiator, approver, or employee-benefits.`);
  }
  return profiles[role];
}
