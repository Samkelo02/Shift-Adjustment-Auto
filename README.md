# Shift Adjustment Playwright tests

End-to-end browser tests for the Shift Adjustment test application. The suite covers
submitting an employee absence adjustment plus thorough Home page navigation,
dashboard queue links, browser history, help, notifications, profile menus, Insights
panels, adjustment filters, and desktop/tablet layout.

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

The Home page navigation test loads Home once and keeps the same browser session
through all navigation steps, without refreshing between checks.

Run the Home page navigation suite on its own with:

```powershell
npx.cmd playwright test home-page-navigation.spec.js
```

Run the master-data suite on its own with:

```powershell
npx.cmd playwright test master-data.spec.js
```

The master-data checks share one browser session and use tabs to move between
sections and verify persisted records, without page refreshes. They cover
reference-record creation, persisted values, deletion,
search, filters, exports, column settings, help, user-management forms, integrations,
and audit filters. Each record test uses a fresh identifier and deletes that exact
record in a `finally` block, including after failed assertions. A terminated browser
or unavailable server can prevent cleanup; the cleanup step reports the identifier.
User access and system notification forms are validated without saving changes.
The notification end date is calculated at runtime.

The adjustment-submission test changes server-side data and is skipped unless an
attachment is explicitly supplied. It chooses a random three-day range from the
past 10Ã¢â‚¬â€œ30 days on each run unless both date variables are set. If the app reports
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

## Approve shift adjustment

Run the approval test with:

```powershell
npx.cmd playwright test approve-shift-adjustment.spec.js
```

This test opens the Shift Adjustment tab, clears existing filters, filters by
Submitted, selects the first submitted adjustment, and confirms approval. It
verifies that the same reference is saved as Approved. The test changes server-side
data and posts the adjustment to SAP. It requires an Approver or Administrator
account and at least one submitted adjustment. Retries are disabled to avoid
approving a second record after a failure.

## Reject shift adjustment

```powershell
npx.cmd playwright test reject-shift-adjustment.spec.js
```

The test opens the Shift Adjustment tab, clears existing filters, filters by
Submitted, selects the first submitted adjustment, and confirms rejection. It
verifies that the same reference is saved as Rejected. The default reason is
`Other`, with this rejection comment:

> The submitted shift adjustment does not contain sufficient supporting information to validate the request. Please review the details, provide the required supporting documentation, and resubmit the adjustment for approval

Override the reason and comment using `TEST_REJECTION_REASON` and
`TEST_REJECTION_COMMENT`. The reason must match an available option exactly.
This test changes server-side data and communicates the rejection to the
initiator. It requires an Approver or Administrator account and at least one
submitted adjustment. Retries are disabled to avoid rejecting a second record
after a failure.

## Request Recapture

```powershell
npx.cmd playwright test request-recapture.spec.js
```

The test opens the Shift Adjustment tab, clears existing filters, selects both
Posting Failed and Submitted, and checks that the returned rows have one of those
statuses. It selects the first record, requests recapture, and verifies that the
same reference is saved as Recapture Requested.

The default reason is `Additional Information Required`. The comment uses the
supporting-documentation wording configured for the rejection test. Override
these with `TEST_RECAPTURE_REASON` and `TEST_RECAPTURE_COMMENT`; the reason must
match an available option exactly. This test changes server-side data and
communicates the recapture request to the initiator. It requires an account with
permission to request recapture and at least one Submitted or Posting Failed
adjustment. Retries are disabled to avoid changing a second record after failure.

## Recall from Submission

```powershell
npx.cmd playwright test recall-from-submission.spec.js
```

The test opens the Shift Adjustment tab, clears existing filters, selects
Submitted, and verifies that the list contains only submitted adjustments. It
selects the first record, confirms Recall From Submission, checks the success
message, and verifies that the same reference is saved as Recalled. The app
returns recalled adjustments to an editable state. No recall reason is required.

This test changes server-side data. It requires an account with permission to
recall submitted adjustments and at least one Submitted record. Retries are
disabled to avoid recalling a second record after failure.

## Delete shift adjustment

```powershell
npx.cmd playwright test delete-shift-adjustment.spec.js
```

The test opens the Shift Adjustment tab, clears existing filters, selects Draft,
and verifies that the list contains only drafts. It opens the first draft,
confirms Yes, Delete, and checks the successful DELETE response for that record.
It then searches the Draft list for the same reference and verifies no records
are returned.

This test permanently deletes one existing draft in the target environment. It
requires an account with permission to delete drafts and at least one Draft
record. Retries are disabled to avoid deleting a second record after failure.

## Cancel shift adjustment

```powershell
npx.cmd playwright test cancel-shift-adjustment.spec.js
```

The test opens the Shift Adjustment tab, clears existing filters, selects both
Submitted and Posting Failed, and verifies that the returned rows have one of
those statuses. It opens the first record, chooses More Actions > Cancel,
completes the required cancellation reason and comments, confirms cancellation,
and verifies that the same reference is saved as Cancelled.

The default reason is `Administrative Cancellation`, with the comment
`Cancelled during automated cancellation workflow validation.` Override them
with `TEST_CANCELLATION_REASON` and `TEST_CANCELLATION_COMMENT`; the reason must
match an available option exactly. This test changes server-side data. It requires
permission to cancel adjustments and at least one Submitted or Posting Failed
record. Retries are disabled to avoid cancelling a second record after failure.

## Navigate through Audit Trail & Notifications

```powershell
npx.cmd playwright test audit-trail-notifications.spec.js
```

The test selects every available status except Pending and verifies the selected
filters and returned rows. It opens a record with history actions; Draft and
Recalled records open the creation form, so it chooses another status from the
same list. It opens Audit Trail and Notifications through More Actions, checks
each reference-specific heading, scrolls through the timeline entries, and
closes each dialog. Empty notification histories are allowed. The report records
the selected reference and entry counts. This test views history without
changing adjustment data or resending notifications. It requires at least one
record with history actions in the filtered list.

## Help Centre Navigation

```powershell
npx.cmd playwright test help-centre-navigation.spec.js
```

The test opens Help from Home, visits FAQ, Guides, and Contact, checks the section
headings and all four guide cards, revisits Guides and FAQ, and returns to Home.
It uses the same browser session throughout without refreshing the page.

The Help Centre suite also thoroughly tests FAQ answers, keyboard expansion,
exclusive accordion behavior, question and answer search, case handling, partial
queries, punctuation, no-match results, the search clear icon, every role and
category filter, every role/category combination, combined search and filters,
filter resets, navigation persistence, and tablet interactions. Expected results
are derived from the current questions, answers, category badges, and role badges
so the tests do not require a fixed FAQ count. All checks use the same session.

## User Management lifecycle

```powershell
npx.cmd playwright test user-management.spec.js
```

This test uses `hendrick.makhomisane@valterraplatinum.com`. It first checks for
existing active and inactive accounts and fails without changing them if the email
already exists. It selects Hendrick Makhomisane from Microsoft Entra Directory,
assigns Viewer access for one available personnel area, saves, and verifies the
account after reopening User Management.

Cleanup uses the row's delete icon and confirms **Deactivate User**. The application
retains the record with `isActive=false`; the test verifies removal from Active and
presence under Inactive. Cleanup also runs after failed post-creation assertions,
and only changes the ID created by that run. Browser termination or server failure
can prevent cleanup. Retries are disabled. Because deactivation retains the email,
a later run stops at the existing-account check. The test requires Administrator
access and a directory entry for the supplied email.

## Initiator role tests

The Initiator suite uses its own login at `playwright/.auth/initiator.json`.
The existing admin suite continues to use `playwright/.auth/user.json`.

```powershell
npm run auth:initiator
npm run test:initiator
```

Sign in using an account assigned the Initiator role when saving that session.
The role is assigned by the application; the test configuration does not change
an account's permissions. Save an Initiator session for this suite.

The suite covers Home and adjustment-list navigation, browser history, opening
and leaving the creation form, search with no results and clearing search, FAQ,
the Initiator guide, and Contact. It also runs the existing paid sick-leave
submission test under the Initiator session. Submission is skipped unless
`TEST_ATTACHMENT_PATH` is set; employee and adjustment settings use the same
`TEST_*` variables documented above. Choose an employee accessible to the Initiator.
Retries are disabled for this suite to avoid repeating submissions.

```powershell
$env:TEST_ATTACHMENT_PATH = 'C:\path\to\test-evidence.jpg'
npm run test:initiator -- add-new-shift-adjustment.spec.js
```

Run the Initiator workflow tests, or list the suite without opening a browser:

```powershell
npm run test:initiator -- home-page-navigation.spec.js
npm run test:initiator -- --list
```

For CI, provide the Initiator storage-state JSON using the separate
`PLAYWRIGHT_INITIATOR_AUTH_STATE` secret and run `npm run test:initiator`.
The current admin workflow remains unchanged. Initiator tests are excluded from
`npm test`; use the dedicated command to run them. These checks cover permitted
workflows; assertions for restricted actions require confirmed role access rules.

Initiator workflows live in separate files under tests/e2e/initiator/.
Each workflow opens Home with its own saved Initiator browser context.
A failing test does not skip other files.

## Admin role tests

All existing admin specs are grouped in `tests/e2e/admin/` and run under the
`admin` Playwright project using the saved admin session.

```powershell
npm run auth:admin
npm run test:admin
npm run test:admin -- home-page-navigation.spec.js
```

`npm test` continues to run the admin suite. Existing single-spec commands still
work by filename. Initiator workflows stay in `tests/e2e/initiator/`; its
configuration explicitly reuses only the submission spec from the admin folder
with the separate Initiator login.

The Initiator workflow suite also checks status selection, combined statuses,
absence-type filtering, and clearing filters; recalls a Submitted adjustment;
deletes a Draft; cancels a Submitted or Posting Failed adjustment; and views
Audit Trail and Notifications. Each action verifies the selected reference or
ID, and records it in the report. Each workflow opens Home in a fresh browser context. Retries are disabled.

The workflow suite changes existing server data: it recalls one record, permanently deletes
one draft, and cancels another record. Provide records accessible to the Initiator:
at least one Draft, one Submitted for recall, another Submitted or Posting Failed
for cancellation, and an adjustment with history actions. If required records
are missing, the test fails. A failure does not skip other workflow files.
Set `TEST_INITIATOR_ABSENCE_TYPE` to override the filter's default `Sick leave Paid`.
Cancellation reason and comment use `TEST_CANCELLATION_REASON` and
`TEST_CANCELLATION_COMMENT`, as documented for the admin cancellation test.

Each Initiator workflow has its own file: Home navigation, creation form navigation,
search, Help, filters, history, recall, deletion, and cancellation.
Run individual files or choose tests in Playwright UI:

```powershell
npm run test:initiator -- shift-adjustment-filters.spec.js
npm run test:initiator -- audit-trail-notifications.spec.js
npm run test:initiator -- --ui
```

## Approver login session

Save a separate Approver session at `playwright/.auth/approver.json`:

```powershell
npm run auth:approver
```

Sign in with an account assigned the Approver role, navigate to Home, then press
Enter in the terminal to save the session. The command saves the account's login;
it does not assign or verify the application's role. Authentication files are
excluded from Git. Run the same command again to refresh an expired session.

Run the approval, rejection, and recapture workflows with this session:

```powershell
npm run test:approver
npm run test:approver -- approve-shift-adjustment.spec.js
npm run test:approver -- --list
```

These workflows change existing adjustments, as described above. Retries are
disabled. The dedicated configuration reuses the existing workflow specs with the
Approver session; Admin and Initiator commands keep their own sessions.

For CI, provide the complete Approver storage-state JSON through
`PLAYWRIGHT_APPROVER_AUTH_STATE` and run `npm run test:approver`. The existing
GitHub Actions workflow runs the Admin suite; an Approver CI job must supply this
separate secret.
