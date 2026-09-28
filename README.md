# Shift Adjustment Playwright tests

End-to-end browser tests for the Shift Adjustment test application. The suite covers
submitting an employee absence adjustment plus a non-destructive administration smoke
tour of the main pages, Insights panels, filters, and responsive layout.

## Requirements

- Node.js 20 or newer
- Access to the Shift Adjustment test environment
- A user account with the permissions needed by the tested flows

## Install

```powershell
npm ci
npx playwright install chromium
```

## Save a login session

Authentication state is stored locally under `playwright/.auth/` and is excluded from
Git. Create or refresh it with:

```powershell
npm run auth
```

Sign in in the browser, navigate to the Home screen, and then press Enter in the
terminal.

## Run tests

```powershell
npm test
```

Useful alternatives:

```powershell
npm run test:headed
npm run test:ui
npm run test:debug
npm run report
```

Run the master-data suite on its own with:

```powershell
npx.cmd playwright test master-data.spec.js
```

The master-data tests cover reference-record creation, persisted values, deletion,
search, filters, exports, column settings, help, user-management forms, integrations,
and audit filters. Each record test uses a fresh identifier and deletes that exact
record in a `finally` block, including after failed assertions. A terminated browser
or unavailable server can prevent cleanup; the cleanup step reports the identifier.
User access and system notification forms are validated without saving changes.
The notification end date is calculated at runtime.

The adjustment-submission test changes server-side data and is skipped unless an
attachment is explicitly supplied. It chooses a random three-day range from the
past 10–30 days on each run unless both date variables are set. If the app reports
that the range already exists, it tries another unused range, up to five attempts.
Explicit date ranges are submitted once:

```powershell
npm run test:submission -- 'C:\path\to\test-evidence.jpg'
```

## Configuration

All settings are optional unless noted.

| Variable | Purpose | Default |
| --- | --- | --- |
| `SHIFT_ADJUSTMENT_BASE_URL` | Target environment | Current SAP BTP test URL |
| `PLAYWRIGHT_AUTH_STATE` | Storage-state JSON used by CI | Local auth file |
| `TEST_ATTACHMENT_PATH` | Enables the data-changing submission test | Test is skipped |
| `TEST_EMPLOYEE` | Employee surname or number | `80068191` |
| `TEST_EMPLOYEE_OPTION` | Exact employee result to select | `Christiaan Van Den Berg` |
| `TEST_START_DATE` | Override random start date (`YYYY-MM-DD`; set with end date) | Random |
| `TEST_END_DATE` | Override random end date (`YYYY-MM-DD`; set with start date) | Start date + 2 days |
| `TEST_ADJUSTMENT_TYPE` | Adjustment type | `Sick Leave - SICK` |
| `TEST_ABSENCE_TYPE` | Absence type | `Sick leave Paid` |
| `TEST_LOCATION` | Location | `Mogalakwena` |
| `TEST_PRACTITIONER_TYPE` | Practitioner type | `Doctor` |
| `TEST_PRACTITIONER_SEARCH` | Practitioner search text | `Dr Samu Test` |
| `TEST_PRACTITIONER_OPTION` | Practitioner option label | `Dr Samu Test` |
| `TEST_ADMIN_STATUS` | Administration status filter | `Approved` |
| `TEST_ADMIN_ABSENCE_TYPE` | Administration absence filter | `Accumulated Leave CD` |

## CI authentication

The GitHub Actions workflow reads the `PLAYWRIGHT_AUTH_STATE` repository secret. Set
its value to the complete contents of `playwright/.auth/user.json`. Treat that value
as a credential and rotate it when the test account changes.

Tests run serially because they share server-side state. Failed runs retain a trace,
screenshot, video, and HTML report for diagnosis.
