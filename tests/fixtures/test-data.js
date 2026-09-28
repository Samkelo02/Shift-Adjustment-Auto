import path from 'node:path';
import { randomInt } from 'node:crypto';

export const datesAreExplicit = Boolean(process.env.TEST_START_DATE || process.env.TEST_END_DATE);

export function randomTestDates(excludedStarts = new Set()) {
  const today = new Date();
  const utcToday = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const availableOffsets = Array.from({ length: 21 }, (_, index) => index + 10)
    .filter((offset) => {
      const start = new Date(utcToday - offset * 86_400_000);
      return !excludedStarts.has(start.toISOString().slice(0, 10));
    });
  if (availableOffsets.length === 0) {
    throw new Error('No unused test date ranges remain.');
  }
  const start = new Date(utcToday - availableOffsets[randomInt(availableOffsets.length)] * 86_400_000);
  const end = new Date(start.getTime() + 2 * 86_400_000);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

function testDates() {
  if (datesAreExplicit) {
    if (!process.env.TEST_START_DATE || !process.env.TEST_END_DATE) {
      throw new Error('Set both TEST_START_DATE and TEST_END_DATE.');
    }
    return {
      startDate: process.env.TEST_START_DATE,
      endDate: process.env.TEST_END_DATE,
    };
  }

  return randomTestDates();
}

export const adjustmentData = {
  employeeSearch: process.env.TEST_EMPLOYEE ?? '80068191',
  employeeOption: process.env.TEST_EMPLOYEE_OPTION ?? 'Christiaan Van Den Berg',
  attachmentPath: process.env.TEST_ATTACHMENT_PATH
    ? path.resolve(process.env.TEST_ATTACHMENT_PATH)
    : undefined,
  ...testDates(),
  adjustmentType: process.env.TEST_ADJUSTMENT_TYPE ?? 'Sick Leave - SICK',
  absenceType: process.env.TEST_ABSENCE_TYPE ?? 'Sick leave Paid',
  location: process.env.TEST_LOCATION ?? 'Mogalakwena',
  practitionerType: process.env.TEST_PRACTITIONER_TYPE ?? 'Doctor',
  practitionerSearch: process.env.TEST_PRACTITIONER_SEARCH ?? 'Dr Samu Test',
  practitionerOption: process.env.TEST_PRACTITIONER_OPTION ?? 'Dr Samu Test',
};

export const adminFilterData = {
  status: process.env.TEST_ADMIN_STATUS ?? 'Approved',
  absenceType: process.env.TEST_ADMIN_ABSENCE_TYPE ?? 'Accumulated Leave CD',
};
