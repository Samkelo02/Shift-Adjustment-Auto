import path from 'node:path';

export const adjustmentData = {
  employeeSearch: process.env.TEST_EMPLOYEE ?? 'Buckle',
  employeeOption: process.env.TEST_EMPLOYEE_OPTION ?? 'Thomas Johannes Buckle',
  attachmentPath: process.env.TEST_ATTACHMENT_PATH
    ? path.resolve(process.env.TEST_ATTACHMENT_PATH)
    : undefined,
  dateAccessibleName: process.env.TEST_DATE_ACCESSIBLE_NAME ?? 'September 10,',
  adjustmentType: process.env.TEST_ADJUSTMENT_TYPE ?? 'Sick Leave - SICK',
  absenceType: process.env.TEST_ABSENCE_TYPE ?? 'Sick leave Paid',
  location: process.env.TEST_LOCATION ?? 'Mogalakwena',
  practitionerType: process.env.TEST_PRACTITIONER_TYPE ?? 'Doctor',
  practitionerSearch: process.env.TEST_PRACTITIONER_SEARCH ?? 'Dr',
  practitionerOption:
    process.env.TEST_PRACTITIONER_OPTION ?? 'Dr fourie 00002678 null •',
};

export const adminFilterData = {
  status: process.env.TEST_ADMIN_STATUS ?? 'Approved',
  absenceType: process.env.TEST_ADMIN_ABSENCE_TYPE ?? 'Accumulated Leave CD',
};
