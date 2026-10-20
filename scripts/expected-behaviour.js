// Planned application behaviour; actual outcomes are reported separately.
export function expectedBehaviour(title = '') {
 const known = {
  'opens Configuration from Home': ['The Switch to Configuration confirmation appears.', 'After confirmation, the application opens Configuration with Reference Data selected.'],
  'switches from Home to Configuration': ['The Switch to Configuration confirmation appears. After confirmation, Configuration opens with Reference Data selected.'],
  'loads Home and waits for the authenticated user': ['Home loads the signed-in user details and displays Recent Activities.'],
  'checks help, notifications, profile, and configuration navigation': ['Help, notifications, and the user profile are accessible from Home. Confirming the switch opens Configuration with Reference Data selected.'],
  'Open Help Centre from Home': ['Selecting Help from Home opens the Help Centre and displays Frequently Asked Questions.'],
  'Navigate to FAQ': ['FAQ displays Frequently Asked Questions and its search field. Contact information is hidden.'],
  'Navigate to Guides': ['Guides displays the Administrator, Initiator, Approver, and Employee Benefits guides. FAQ and Contact content is hidden.'],
  'Navigate to Contact': ['Contact displays Contact Information and Business Hours Response. FAQ content is hidden.'],
  'Navigate back through Guides and FAQ': ['Returning to Guides displays all four role guides; returning to FAQ displays the questions and search field.'],
  'Return to Home': ['The application returns to the Home page.'],
  'Help Centre Navigation': ['Help opens from Home. FAQ, Guides, and Contact display their respective content, and the user can return to Home.'],
  'FAQ answers, search, and filters': ['FAQ answers expand and collapse. Search and role/category filters display matching questions, retain selections during section navigation, and work at tablet width.'],
  'Load FAQs and verify the default results and filter options': ['FAQ displays unique questions with valid role and category labels. All Roles and All Categories are available, and answers are initially collapsed.'],
  'Verify keyboard operation and only one answer open at a time': ['FAQ answers expand and collapse using the keyboard. Opening another question closes the previously open answer.'],
  'Search full questions, partial text, mixed case, answers, and punctuation': ['Search finds full or partial question text and answer text regardless of letter case. Punctuation is handled correctly, and unmatched searches display no results.'],
  'Combine search and both filters; clear search without resetting filters': ['FAQ results match the search text, selected role, and selected category together. Clearing search retains both filters.'],
  'Keep search and filters when visiting Guides and Contact and returning to FAQ': ['The search text and selected filters remain unchanged after visiting Guides and Contact and returning to FAQ.'],
  'Use the FAQ search, filters, and answers at tablet width': ['At tablet width, FAQ search and filters remain usable and answers expand and collapse correctly.'],
  'Employees: filter and export Employees Overview': ['Employees Overview is selected. Search displays matching employees, period and personnel-area filters update the results, and an export downloads when data is available.'],
  'Employees: filter and export Long Term Sick Leave': ['Long Term Sick Leave displays its heading and record count. Search and period/personnel-area filters update the results, and an export downloads when data is available.'],
  'User Analytics: filters and role drill-downs': ['User Analytics retains the selected period and personnel area. Initiator, Approver, and Employee Benefits performance trends open and close without an application error.'],
  'User Analytics: User Adoption': ['User Adoption is selected. Results match the Initiator search and Mogalakwena Mining personnel area for This Year.'],
  'Exceptions: exercise Reason Codes search and period': ['Reason Codes is selected. The period selection is retained, search returns matching records or a clear empty state, and no application error appears.'],
  'Exceptions: filter Posting Failures': ['Posting Failures is selected for This Year. Searching for 014 displays the matching Quota Insufficient record.'],
  'tests every Insights tab without refreshing the page': ['Each Insights tab opens successfully. Employee, User Analytics, and Exceptions views support the specified searches, filters, drill-downs, and exports where data is available.'],
  'searches organizational units, filters status, and loads more rows': ['Organizational-unit search displays matching records. Status selections are retained, and Load More adds records when further results are available.'],
  'filters absence types by category and verifies clearing search': ['The selected absence category is retained and displayed rows match it. Clearing search removes the search text.'],
  'opens the absence category upload form': ['The absence-category upload form opens and can be closed.'],
  'changes absence category columns and restores the original layout': ['Selected absence-category columns appear in the table. Restoring the original selections restores the initial layout.'],
  'checks User Management filter results, search, resets, and pagination': ['User Management search and filters display matching users. Reset restores default filters, and pagination displays further users when available.'],
  'checks User Management column settings and restores the original layout': ['Selected user columns appear in User Management. Restoring the original selections restores the initial layout.'],
  'searches, activates, and deactivates the existing User Management account': ['The existing user is found under Active or Inactive. Activation places the user under Active, profile changes preserve personnel areas and Insights access, the original role is restored, and deactivation retains the user under Inactive.'],
  'searches for Hendrick existing under Active or Inactive': ['The existing Hendrick account is found under Active or Inactive without creating a new user.'],
  'checks integrations and external API navigation': ['The integrations and External API views open and display Available Endpoints.'],
  'validates the system notification form without saving': ['The System Notification form accepts a title, message, Warning severity, Administrator audience, and a future end date. Add becomes available once required fields are complete, and closing the form leaves the notification unsaved.'],
  'filters audit categories, severity, and dates': ['Audit filters retain the selected Authentication category, Warning severity, and date range. Clear removes category and severity selections and resets the date range to All.'],
 };
 const text = title.trim();
 if (known[text]) return known[text];
 let match;
 if ((match = text.match(/^Open (Overview|Absences|Ageing|Organizational|Medical|Data Export)$/))) return [match[1] + ' becomes the selected Insights tab and opens without an application error.'];
 if ((match = text.match(/^Expand, collapse, and reopen: (.+)$/))) return ['The answer to ?' + match[1] + '? appears when expanded, is hidden when collapsed, and appears again when reopened.'];
 if ((match = text.match(/^Filter by role: (.+)$/))) return ['Only FAQ questions available to the ' + match[1] + ' role are displayed; an empty result appears when no questions match.'];
 if ((match = text.match(/^Filter by category: (.+)$/))) return ['Only FAQ questions in the ' + match[1] + ' category are displayed; an empty result appears when no questions match.'];
 if ((match = text.match(/^Combine role (.+) with category (.+)$/))) return ['FAQ results match both the ' + match[1] + ' role and the ' + match[2] + ' category; an empty result appears when no questions match.'];
 if ((match = text.match(/^creates, verifies, and deletes (.+)$/))) return ['A new ' + match[1] + ' record is saved with the entered values, remains available after returning to the section, and is removed after deletion.'];
 if ((match = text.match(/^Create and verify (.+)$/))) return ['The record ?' + match[1] + '? is saved, appears in search results, and retains its entered values when reopened for editing.'];
 if ((match = text.match(/^Delete test record (.+)$/))) return ['After deletion is confirmed, record ' + match[1] + ' no longer appears in the table or in search results after returning to the section.'];
 if ((match = text.match(/^Verify (CSV|Excel) export$/))) return ['The ' + match[1] + ' export downloads with the expected file type and contains data.'];
 if ((match = text.match(/^exports (.+) as CSV and Excel$/))) return [match[1] + ' downloads in CSV and Excel formats, with non-empty files.'];
 return [];
}
