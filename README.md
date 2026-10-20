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

Administrator, Approver, and Employee Benefits use the shared Home navigation
workflow in `tests/e2e/shared/home-page-navigation.spec.js` through their role entry
files. It loads Home once and retains the same browser session for role verification,
main tabs, browser history, Help, notifications, profile dismissal, and desktop/tablet
navigation at widths of 1440 and 768 pixels. Each role uses its own saved login.

Administrator checks global dashboard cards, their navigation links, and opening
New Shift Adjustment without submitting. Approver checks personal review metrics
and verifies that New Shift Adjustment is hidden. Employee Benefits dashboard card
labels and creation permission still need confirmation; the test records this as a
coverage-gap annotation rather than treating those permissions as verified.

Detailed Insights and Help checks remain in their dedicated suites. The existing
Administrator search and filter checks now run in
`tests/e2e/admin/shift-adjustment-filters.spec.js`.

Run the shared Home workflow with a specific role:

```powershell
npm run test:admin -- home-page-navigation.spec.js
npm run test:approver -- home-page-navigation.spec.js
npm run test:employee-benefits -- home-page-navigation.spec.js
```

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
search, filters, exports, column settings, help, user-management filters, integrations,
and audit filters. Each record test uses a fresh identifier and deletes that exact
record in a `finally` block, including after failed assertions. A terminated browser
or unavailable server can prevent cleanup; the cleanup step reports the identifier.
The Master Data suite checks user filters, searches for the existing directory user, and verifies activation and deactivation in the same browser session. System notification forms are validated without saving changes.
The notification end date is calculated at runtime.

The adjustment-submission test changes server-side data. All roles use
Downloads/dummy_shift_adjustment_form.pdf in the current user's home folder by default.
Set TEST_ATTACHMENT_PATH to override it. The test is skipped if no override is set
and the default PDF is missing. It chooses a random three-day range from the
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
| `TEST_ATTACHMENT_PATH` | Overrides the shared submission attachment for every role | `~/Downloads/dummy_shift_adjustment_form.pdf` if present; otherwise skipped |
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
npm run test:admin -- master-data.spec.js
```

The lifecycle runs as an independent Master Data test, using
`tests/support/user-management-lifecycle.js`. It searches for the existing
`hendrick.makhomisane@valterraplatinum.com` account under Active or Inactive.
It never adds a user. A missing or duplicate account fails the test.

If inactive, the test activates the account and verifies it under Active and
absent under Inactive. If already active, it verifies the active state instead.
The test verifies read-only profile fields, cancels an unsaved role change, then
saves a temporary role change using the original personnel-area assignments. It
checks that personnel areas and Insights access are preserved and restores the
original role in a `finally` block.

The final step deactivates that same account, verifies removal from Active, and
confirms the retained record under Inactive with `isActive=false`. This step also
runs after an activation verification failure. A browser termination or unavailable
server can prevent deactivation; the report identifies the selected account ID.
The workflow can run again against the retained account. Administrator access is
required, and retries are disabled for the Master Data suite.

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
submission test under the Initiator session. Submission uses the shared Downloads
PDF unless `TEST_ATTACHMENT_PATH` overrides it; employee and adjustment settings use the same
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

Admin-specific specs are grouped in `tests/e2e/admin/`; common adjustment workflows live in `tests/e2e/shared/`. Both run under the
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

Run the shared adjustment workflows and Approver-specific tests with this session:

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

## Shared adjustment workflows

The submission, approval, rejection, recapture, and Audit Trail & Notifications
specs live in `tests/e2e/shared/`. Admin runs all five. Approver runs approval,
rejection, recapture, and history with its saved login; Approvers cannot create
or submit adjustments. Initiator reuses the shared submission
spec and retains its own role-specific history workflow. Each role configuration
selects only the shared workflows it supports; there are no copied Approver specs.
Existing commands that select a test by filename still work.

List the four shared Approver tests without changing application data:

```powershell
npm run test:approver -- "approve-shift-adjustment|reject-shift-adjustment|request-recapture|audit-trail-notifications" --list
```

Run them with:

```powershell
npm run test:approver -- "approve-shift-adjustment|reject-shift-adjustment|request-recapture|audit-trail-notifications"
```

Admin and Initiator submission tests use the shared Downloads PDF by default. Set `TEST_ATTACHMENT_PATH` to override it. To run submission on its own:

```powershell
$env:TEST_ATTACHMENT_PATH = 'C:\path\to\test-evidence.jpg'
npm run test:admin -- add-new-shift-adjustment.spec.js
```

Approval and rejection each require a separate Submitted
record; recapture requires a Submitted or Posting Failed record. These workflows
change server data, and approval posts to SAP. Approver retries are disabled.
Audit Trail & Notifications only views history and requires a record with history
actions. Missing required records fail the corresponding test.

## Employee Benefits login session

Save a separate Employee Benefits session at `playwright/.auth/employee-benefits.json`:

```powershell
npm run auth:employee-benefits
```

Sign in with an account assigned the Employee Benefits role, navigate to Home,
then press Enter in the terminal to save the session. The command saves the
account's login; it does not assign or verify the application's role.
Authentication files are excluded from Git. Run the same command again to
refresh an expired session.

The authentication profile uses `employee-benefits` as its role key and
`PLAYWRIGHT_EMPLOYEE_BENEFITS_AUTH_STATE` as its separate CI secret. Run its shared workflow suite with `npm run test:employee-benefits`.


## Employee Benefits shared tests

```powershell
npm run auth:employee-benefits
npm run test:employee-benefits -- --list
npm run test:employee-benefits
```

The dedicated configuration selects Home navigation, Help Centre navigation and FAQ
checks, shift adjustment filters, search, recalled adjustment submission, cancellation, Audit
Trail & Notifications, and Insights navigation with the Employee Benefits session.
Employee Benefits entry files live in `tests/e2e/employee-benefits/` and import
workflows from `tests/e2e/shared/`. Existing role entry files reuse the common
checks with their own sessions and preserve their role-specific Home assertions.
Employee Benefits Home checks now use the common navigation workflow described above; dashboard cards and creation permission remain unconfirmed.

Run a single workflow by filename:

```powershell
npm run test:employee-benefits -- submit-recalled-adjustment.spec.js
npm run test:employee-benefits -- insights-navigation.spec.js
```

Set `TEST_EMPLOYEE_BENEFITS_ABSENCE_TYPE` to override the filter default
`Sick leave Paid`. Employee Benefits cannot request recapture. Its submission test
selects an existing Recalled adjustment, submits its saved details for approval,
and verifies that the same reference is listed as Submitted. It requires a Recalled
adjustment with complete submission details and changes that existing record.
Cancellation uses `TEST_CANCELLATION_*` settings and requires a Submitted or
Posting Failed adjustment accessible to the account.
History requires a record with history actions. Insights requires Insights access
and a Posting Failures record for its valid-search check. Retries are disabled.

For CI, supply `PLAYWRIGHT_EMPLOYEE_BENEFITS_AUTH_STATE` and run
`npm run test:employee-benefits`.


Approver entry files live in `tests/e2e/approver/` and import the shared Home,
Help Centre, filters, Insights, approval, rejection, recapture, and history
workflows. The Approver configuration selects only those entry files and uses
its separate saved session. Run a workflow by its entry filename, for example:

```powershell
npm run test:approver -- request-recapture.spec.js
```


## Employee Benefits: close a Posting Failed adjustment

```powershell
npm run test:employee-benefits -- close-shift-adjustment.spec.js
```

The test clears filters and search, selects only Posting Failed, opens the first
matching adjustment, and retains its reference. It confirms Close Record (No
Action), waits for the completed closure result, and searches for the same
reference under the Close Record (No Action) filter to verify the displayed
Closed Record (No Action) status. This changes one existing server record and
requires a Posting Failed adjustment accessible to the Employee Benefits account.
A missing record fails the test. Retries are disabled to avoid closing another
record. The shared closure spec runs through its Employee Benefits entry file
and is excluded from the default Admin suite.

## PDF regression reports

Generate an Extent-style regression document using the existing Playwright tests:

```powershell
npm run test:regression
npm run test:regression:initiator
npm run test:regression:approver
npm run test:regression:employee-benefits
```

The default role is Admin. Save that role's login using the corresponding
`auth` command first. Chromium must be installed with
`npx playwright install chromium`. No additional reporting dependency is needed.
These commands execute the selected regression tests, including their existing
submission, approval, deletion, cancellation, and other server changes.

Select a workflow or test by filename or grep:

```powershell
npm run test:regression:admin -- home-page-navigation.spec.js
npm run test:regression -- --role approver --grep "Home Page Navigation"
```

Each run saves `regression-report.pdf`, a self-contained HTML document, and JSON
evidence under `regression-reports/<timestamp>-<role>-<process>/`. The runner prints
the output path and returns the test exit code. PDF generation failures also fail
the run, while retaining the HTML and JSON evidence. Output folders are excluded
from Git. Existing test commands continue to run without regression screenshot
capture. This is a custom Extent-style Playwright reporter, not the Java
ExtentReports library.

The PDF includes run start/end times in South African time, duration, environment
URL, browser and viewport, role project, optional build/revision, a test index,
actual and expected results, retries, skip reasons, named step durations, assertion
errors, and screen evidence. Each screen has its timestamp, action or named-step
description, URL, logged-in user, assigned role, identity source, and screenshot.
Screenshots capture the visible viewport before/after browser actions and at
named-step completion, including intermediate tabs and dialogs. Consecutive
identical action screenshots are deduplicated; named steps retain their evidence.
Only screens visited by the selected tests are documented. Screenshot failures,
undetected users, and unverified roles are flagged explicitly.

User names are read from the Home greeting or the profile menu's accessible label.
Roles are read from visible profile-menu labels when available. For the complete
name and assigned role on your application's profile/header, configure selectors
that target those specific fields (replace the examples with real selectors):

```powershell
$env:REGRESSION_USER_SELECTOR = '[data-testid="current-user-name"]'
$env:REGRESSION_ROLE_SELECTOR = '[data-testid="current-user-role"]'
npm run test:regression:admin -- home-page-navigation.spec.js
```

The reporter remembers identity values between screens in the same browser page.
It does not open the profile menu itself or change the account's permissions.
Without an observed role, the configured test role is labelled
"not verified in application". If needed, `REGRESSION_USER_NAME` and
`REGRESSION_USER_ROLE` supply operator-declared fallback values; these are labelled
"Operator supplied" rather than verified application identity. Values read from
the UI take precedence. Set `REGRESSION_BUILD` and `REGRESSION_REVISION` to include
release identifiers.

New specs should import `test` and `expect` from
`tests/support/regression-test.js` using the appropriate relative path. Use
`test.step('Describe the screen and verification', async () => { ... })` for
business-readable descriptions. For independent scroll positions or custom
canvas interactions, add a named step after the screen is ready.

Validate reporting against local sample screens without application access:

```powershell
npm run test:reporting
```

This check verifies screenshots for multiple screens, UI identity, a shared
`beforeAll` browser session, an intentionally failing scenario, skipped tests,
identity gaps, HTML escaping, and the generated PDF. The validation command
succeeds when the expected failure is correctly documented. Its sample PDF is
saved at `.report-validation/report-<timestamp>/regression-report.pdf`.

PDF documents use the supplied Valterra Platinum logo on every page, with matching
teal and blue-grey headings, table styling, and branded titles and footers. The
logo is stored at assets/reporting/valterra-platinum.jpg, so report generation
does not depend on the original OneDrive image path.

Every PDF page also includes the supplied Integrove logo in its footer, alongside
the document label and page numbers. The HTML document includes the same footer
branding. The footer logo is stored at assets/reporting/integrove.png.


## Regression scenario structure

Reports follow the supplied Administrator Word document: Document Control,
System Identification, Document Information, Document Overview, Table of Contents,
and the four columns Test Steps, Expected Results, Screenshot Evidence, and Pass/Fail.
Scenario details appear above the tables. Skipped tests are labelled Skipped;
steps without verified outcomes and baseline reference cases are labelled Not assessed.
The extracted baseline is stored in reporting/administrator-test-cases.json;
the original Word document and its embedded images are not required for generation.

Admin workflows link to related reference cases where the relationship is clear.
These links are not full coverage claims. Other roles use the same report structure
and only link Administrator baseline cases when explicitly annotated. Missing
TC-036 and inconsistent source expectations are retained and flagged for review.
Reference screenshots are not copied into current-run evidence.

Business expectations can be supplied through named-step parameters:

```javascript
await test.step('Open the Home dashboard', async () => {
  await home.goto();
  await expect(page.getByRole('heading', { name: 'Recent Activities' })).toBeVisible();
}, {
  params: {
    expectedResult: 'The Home dashboard displays Recent Activities.',
    referenceCase: 'TC-002',
    referenceSteps: [1, 2],
  },
});
```

Scenario metadata can be supplied with test.info().annotations using types
prerequisite, expected-result, and reference-case. Expected results remain distinct
from actual test statuses; observed assertions and their results are recorded in
the verification log. Set REGRESSION_REPORT_AUTHOR to name the current report author.

## All admin tests in one login session

```powershell
npm run test:regression:admin:session
```

This runner verifies the saved admin login once, then executes the full configured
admin suite serially using the same browser context and tab. The parent process
keeps that session alive across Playwright worker restarts after failures. Each
test resets its viewport and timeouts; authentication and browser storage persist.
Tests still navigate to their own starting screens. Reports include per-test
session annotations and are saved as PDF, HTML, and JSON in the printed
`regression-reports/<timestamp>-admin-single-session-<process>/` folder.

To refresh an expired login in the same browser before the suite starts:

```powershell
npm run test:regression:admin:session -- --login
```

Sign in as Administrator and navigate to Home. Tests start automatically when the
Home greeting becomes visible, and the refreshed login is saved for later runs.
The existing tests retain their documented server-side changes and prerequisites.

## Independent Master Data tests

Master Data navigation, each reference-record lifecycle, exports, searches and
filters, upload, column settings, User Management, integrations, notification
validation, and audit filters have separate test results. The admin configuration
uses one worker and the suite uses default mode, so a failure does not skip later
tests. Playwright may restart that worker after a failure; only one worker runs
at a time.

Every test reloads Home and checks its authenticated user response. Configuration
tests switch to Configuration themselves and open their own section. This also
resets the shared tab when using the single-login-session runner. Record lifecycles
create unique records and clean up within the same test. User activation, editing,
role restoration, and deactivation stay together as one lifecycle with cleanup.

Run all Master Data tests or select one case:

```powershell
npm run test:admin -- master-data.spec.js
npm run test:admin -- master-data.spec.js --grep "creates, verifies, and deletes absence reasons"
npm run test:admin -- master-data.spec.js --grep "exports User Management"
```
