import { readFileSync } from 'node:fs';
import { expectedBehaviour } from './expected-behaviour.js';
import { businessDescription, failureDescription } from './business-descriptions.js';

const catalogue = JSON.parse(readFileSync(new URL('../reporting/administrator-test-cases.json', import.meta.url), 'utf8'));
export const referenceSource = { ...catalogue.source, caseCount: catalogue.cases.length };
const casesById = new Map(catalogue.cases.map(item => [item.id, item]));
const fileReferences = {
  'home-page-navigation.spec.js': ['TC-002'],
  'shift-adjustment-filters.spec.js': ['TC-003'],
  'adjustment-filters-approver.spec.js': ['TC-003'],
  'search-shift-adjustments.spec.js': ['TC-003'],
  'cancel-shift-adjustment.spec.js': ['TC-006'],
  'add-new-shift-adjustment.spec.js': ['TC-007', 'TC-009', 'TC-010', 'TC-012', 'TC-014', 'TC-016', 'TC-019'],
  'approve-shift-adjustment.spec.js': ['TC-020'],
  'reject-shift-adjustment.spec.js': ['TC-021'],
  'request-recapture.spec.js': ['TC-022'],
  'recall-from-submission.spec.js': ['TC-023'],
  'audit-trail-notifications.spec.js': ['TC-024'],
  'master-data.spec.js': ['TC-033', 'TC-034', 'TC-037'],
};
function caseId(value) {
  const match = String(value).match(/^TC\s*-?\s*(\d+)$/i);
  return match ? 'TC-' + match[1].padStart(3, '0') : String(value);
}
export function buildScenario(attempt, index) {
  const specified = attempt.annotations.filter(item => item.type === 'reference-case')
    .flatMap(item => (item.description || '').split(/[,;]/).map(value => caseId(value.trim())).filter(Boolean));
  // File mappings link related business workflows; they do not assert full reference-case coverage.
  const ids = specified.length ? specified :
    (attempt.project === 'admin' ? fileReferences[attempt.file.replaceAll('\\', '/').split('/').at(-1)] || [] : []);
  const references = [...new Set(ids)].map(id => {
    const item = casesById.get(id);
    return item ? structuredClone(item) : { id, title: 'Unknown reference case', prerequisite: '',
      testSteps: [], expectedResults: [], reviewNotes: ['This case ID does not exist in the supplied reference document.'] };
  });
  const ownPrerequisite = attempt.annotations.find(item => item.type === 'prerequisite')?.description;
  const expected = attempt.annotations.filter(item => item.type === 'expected-result').map(item => item.description).filter(Boolean);
  return {
    id: 'REG-' + String(index + 1).padStart(3, '0'),
    title: attempt.title.split(' > ').at(-1),
    prerequisite: ownPrerequisite || 'A valid saved login for the ' + attempt.project + ' role and the workflow test data are available.',
    expectedResults: expected.length ? expected : expectedBehaviour(attempt.title.split(' > ').at(-1)),
    references,
    referenceCoverage: references.length ? 'Related workflow only; full reference-case coverage is not established.' : 'No reference case linked.',
    steps: attempt.steps.map((step, number) => {
      const authoredResults = step.expectedResults || [];
      const businessResults = expectedBehaviour(step.title);
      const expectedResults = authoredResults.length ? authoredResults : businessResults;
      const id = step.referenceCase && caseId(step.referenceCase);
      const selectedCase = id && casesById.get(id);
      const selectedNumbers = step.referenceSteps || [];
      const sourceResults = selectedCase && selectedNumbers.length && !selectedCase.reviewNotes.length
        ? selectedCase.expectedResults.filter(item => selectedNumbers.includes(item.number)).map(item => item.text) : [];
      return { ...step, checks: step.checks || [], number: number + 1, expectedResults: expectedResults.length ? expectedResults : sourceResults,
        expectedSource: authoredResults.length ? 'Authored test expectation' : businessResults.length ? 'Application behaviour description' : sourceResults.length ? id + ' reference expectation' : 'Recorded assertion checks' };
    }),
  };
}
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));
const stamp = value => value ? new Date(value).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg', hour12: false }) + ' SAST' : '';
const row = (label, value) => '<tr><th>' + escape(label) + '</th><td>' + escape(value) + '</td></tr>';
const paragraphs = values => values.map(value => '<p>' + escape(value) + '</p>').join('');
const list = values => '<ol>' + values.map(value => '<li>' + escape(value.text || value) + '</li>').join('') + '</ol>';
const numberedSource = values => paragraphs(values.map(value => value.number + '. ' + value.text));
const columns = '<colgroup><col style="width:25%"><col style="width:25%"><col style="width:40%"><col style="width:10%"></colgroup>';
const headings = '<thead><tr><th>Test Steps</th><th>Expected Results</th><th>Screenshot Evidence</th><th>Pass/Fail</th></tr></thead>';
function expectedCell(step, fallback = [], baselineSource = '') {
  const descriptions = step?.expectedResults?.length ? step.expectedResults : expectedBehaviour(step?.title);
  const explicit = descriptions.length ? descriptions : fallback;
  const isBaseline = baselineSource && !descriptions.length;
  return (isBaseline ? '<p><b>Scenario baseline (' + escape(baselineSource) + '):</b> individual reference steps remain unassessed.</p>' : '') +
    (explicit.length ? paragraphs(explicit) : '<p>No specific expected application behaviour was recorded for this screen.</p>');
}

function passFail(status) {
  if (status === 'passed') return 'Pass';
  if (['failed', 'timedOut', 'interrupted'].includes(status)) return 'Fail';
  if (status === 'skipped') return 'Skipped';
  return 'Not assessed';
}
function stepPassFail(step, screen, attempt) {
  if (screen?.outcome === 'failed') return 'Fail';
  if (!step) return screen?.outcome === 'passed' || attempt?.status === 'passed' ? 'Pass' : passFail(screen?.outcome);
  if (step.status === 'failed' || step.checks.some(check => check.status === 'failed')) return 'Fail';
  if (step.status === 'skipped') return 'Skipped';
  if (step.status === 'completed' && ((step.checks.length && step.checks.every(check => check.status === 'passed')) || attempt?.status === 'passed')) return 'Pass';
  return 'Not assessed';
}
function referenceSection(reference) {
  return '<section class="reference-case"><h3>' + escape(reference.id + ' ? ' + reference.title) + '</h3>' +
    '<p><b>Prerequisite:</b> ' + escape(reference.prerequisite) + '</p>' +
    (reference.reviewNotes.length ? '<div class="warn">' + paragraphs(reference.reviewNotes) + '</div>' : '') +
    '<table class="scenario-grid reference-grid"><colgroup><col style="width:50%"><col style="width:50%"></colgroup>' +
    '<thead><tr><th>Test Steps</th><th>Expected Results</th></tr></thead><tbody><tr>' +
    '<td>' + numberedSource(reference.testSteps) + '</td><td>' + numberedSource(reference.expectedResults) + '</td>' +
    '</tr></tbody></table></section>';
}
function screenSection(attempt, scenario, screen, number) {
  let step = scenario.steps.find(item => JSON.stringify(item.path || []) === JSON.stringify(screen.stepPath || []) && screen.stepPath?.length);
  step ||= scenario.steps.find(item => item.title === screen.description);
  // Earlier reports did not contain step paths; retain their evidence without claiming an exact step association.
  const stepName = step ? step.number + '. ' + businessDescription(step.title) : businessDescription(screen.description);
  const baseline = scenario.references.length === 1 && !scenario.references[0].reviewNotes.length ? scenario.references[0] : undefined;
  const fallbackExpected = scenario.expectedResults.length ? scenario.expectedResults : baseline?.expectedResults.map(item => item.text) || [];
  const actual = step ? step.status : screen.outcome;
  return '<section class="screen"><h2>' + escape(scenario.id + ' — ' + scenario.title) + '</h2>' +
    '<p class="screen-context"><b>Evidence ' + (number + 1) + '</b> | ' + escape(stamp(screen.timestamp)) + ' | <b>Actual result:</b> ' + escape(actual) + '</p>' +
    '<p class="screen-context"><b>Logged-in user:</b> ' + escape(screen.name || 'Not detected') + ' (' + escape(screen.nameSource || 'Unavailable') + ') | <b>Assigned role:</b> ' + escape(screen.role || attempt.project) + ' (' + escape(screen.roleSource || 'Unavailable') + ')</p>' +
    '<p class="url"><b>Screen URL:</b> ' + escape(screen.url || 'Unavailable') + '</p>' +
    '<p class="screen-context"><b>Prerequisite:</b> ' + escape(scenario.prerequisite) + '</p>' +
    (scenario.references.length ? '<p class="screen-context"><b>Related cases:</b> ' + escape(scenario.references.map(item => item.id).join(', ')) + '</p>' : '') +
    '<table class="scenario-grid evidence-grid">' + columns + headings + '<tbody><tr>' +
    '<td><p><b>' + escape(stepName) + '</b></p>' + (step ? '<p>' + escape(businessDescription(screen.description)) + '</p>' : '') + '<p><b>Action outcome:</b> ' + escape(screen.outcome) + '</p></td>' +
    '<td>' + expectedCell(step, fallbackExpected, scenario.expectedResults.length ? '' : baseline?.id) + '</td>' +
    '<td>' + (screen.image ? '<img class="image" alt="' + escape(businessDescription(screen.description)) + '" src="' + escape(screen.image) + '">' : '<p class="warn">Screenshot unavailable for this screen.</p>') +
    '</td><td>' + escape(stepPassFail(step, screen, attempt)) + '</td></tr></tbody></table>' +
    '</section>';
}
export function selectStepScreens(attempt, scenario) {
  const groups = new Map();
  for (const screen of attempt.evidence.filter(item => item.image)) {
    const step = scenario.steps.find(item => screen.stepPath?.length && JSON.stringify(item.path || []) === JSON.stringify(screen.stepPath))
      || scenario.steps.find(item => item.title === screen.description);
    const key = step ? step : screen;
    if (!groups.has(key)) groups.set(key, { step, screens: [] });
    groups.get(key).screens.push(screen);
  }
  return [...groups.values()].map(({ step, screens }) => {
    const failures = screens.filter(screen => screen.outcome === 'failed');
    if (failures.length) return failures.at(-1);
    const completed = screens.filter(screen => screen.description === step?.title);
    return completed.at(-1) || screens.at(-1);
  });
}
function scenarioSection(attempt, index) {
  const scenario = attempt.scenario || buildScenario(attempt, index);
  const screensWithImages = selectStepScreens(attempt, scenario);
  const identity = [...attempt.evidence].reverse().find(screen => screen.roleSource === 'Application UI') || attempt.evidence.find(screen => screen.nameSource === 'Application UI') || attempt.evidence[0];
  return '<section class="case" id="case-' + index + '"><h2>' + escape(scenario.id + ' — ' + scenario.title) + '</h2><table>' +
    row('Execution result / expected test status', attempt.status + ' / ' + attempt.expectedStatus) +
    row('Outcome / attempt', attempt.outcome + ' / ' + (attempt.retry + 1)) +
    row('Started / duration', stamp(attempt.start) + ' / ' + (attempt.durationMs / 1000).toFixed(2) + ' seconds') +
    row('Logged-in user / assigned role', identity ? identity.name + ' / ' + identity.role : 'Not detected / ' + attempt.project + ' (configured role)') +
    row('Prerequisite', scenario.prerequisite) + row('Related reference cases', scenario.references.map(item => item.id).join(', ') || 'None') +
    row('Reference coverage', scenario.referenceCoverage) + '</table>' +
    attempt.annotations.filter(item => !['reference-case', 'prerequisite', 'expected-result'].includes(item.type))
      .map(item => '<p>' + escape(item.type + ': ' + (item.description || '')) + '</p>').join('') +
    paragraphs([...new Set(attempt.errors.map(failureDescription))]) +
    (scenario.references.length ? '<h3>Related reference scenarios and expected results</h3>' + scenario.references.map(referenceSection).join('') : '') +
    (!screensWithImages.length ? '<p class="warn">No screen evidence captured (scenario may have been skipped or failed before opening the application).</p>' : '') +
    screensWithImages.map((screen, number) => screenSection(attempt, scenario, screen, number)).join('') + '</section>';
}
export function renderScenarioReport(report) {
  const source = report.reference || referenceSource;
  const css = 'body{font:12px Arial,sans-serif;color:#263e45}h1,h2,h3{color:#007b83}h1{font-size:24px}h2{font-size:18px}h3{font-size:14px}table{border-collapse:collapse;width:100%;margin:10px 0;table-layout:fixed}th,td{border:1px solid #b9ccd3;padding:6px;text-align:left;vertical-align:top;overflow-wrap:anywhere}th{background:#edf5f5}table:not(.scenario-grid) th:first-child{width:24%}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:10px}p{margin:6px 0}ol{margin:4px 0;padding-left:18px}li{margin:4px 0}.case,.screen{break-before:page}.reference-case{break-before:page}.scenario-grid{font-size:11px}.scenario-grid thead{display:table-header-group}.scenario-grid th{width:auto!important;background:#007b83;color:white}.scenario-grid p{margin:4px 0}.screen h2{margin:4px 0}.screen-context,.url{font-size:10px;margin:4px 0;overflow-wrap:anywhere}.evidence-grid tr{break-inside:avoid;page-break-inside:avoid}.screen{break-inside:avoid;page-break-inside:avoid}.evidence-grid td{padding:5px}.image{display:block;max-width:100%;max-height:82mm;margin:0 auto;object-fit:contain}figure{margin:0}figcaption{font-size:9px;color:#55737e;margin-top:5px}.small{font-size:9px;color:#55737e}.warn{background:#fff3cf;padding:8px}a{color:#007b83}.report-brand{display:flex;align-items:center;border-bottom:2px solid #7c9bab;padding:8px 0;margin-bottom:18px}.report-brand img{width:182px;height:auto}.report-footer{display:flex;align-items:center;justify-content:space-between;border-top:1px solid #7c9bab;margin-top:24px;padding:12px 0;font-size:11px}.report-footer img{width:121px;height:auto}@media print{.report-brand,.report-footer{display:none}}';
  return '<!doctype html><html><head><meta charset="utf-8"><title>' + escape(report.title) + '</title><style>' + css + '</style></head><body>' +
    (report.branding?.logo ? '<header class="report-brand"><img alt="Valterra Platinum" src="' + escape(report.branding.logo) + '"></header>' : '') +
    '<h1>' + escape(report.title) + '</h1><p>Regression Test Case Document</p><h2>Document Control</h2><h3>System Identification</h3><table>' +
    row('System Name', 'Shift Adjustment') + row('Environment', report.environment.baseURLs.join(', ') || 'Local reporting validation') + '</table>' +
    '<h3>Document Information</h3><table>' + row('Document Author', report.author || 'Automated regression execution') +
    row('Issue Date', stamp(report.started)) + row('Last Saved Date', stamp(report.ended)) + row('Template Name', source.title) +
    row('Execution result / duration', report.status + ' / ' + (report.durationMs / 1000).toFixed(2) + ' seconds') +
    row('Selected / reported tests', report.selectedTests + ' / ' + report.reportedTests) + row('Execution results', Object.entries(report.counts).map(([status, count]) => count + ' ' + status).join('; ')) +
    row('Roles', report.environment.roles.join(', ')) + '</table>' +
    '<h2>Document Overview</h2><p>This document records the scenarios, steps, expected results and screenshot evidence from the selected regression run.</p><p><b>Target Audience:</b> Business, Integrove Support and the Functional Testing Team.</p><p><b>Prerequisites:</b> Saved role-specific login sessions, accessible test data and permissions for the selected workflows.</p>' +
    '<p>Pass on an intermediate screen without individual assertions reflects the verified result of its passing workflow. Failed actions and steps retain Fail. Expected results describe the planned application behaviour. Actual execution outcomes appear separately. Screenshots come from this run. Reference-case links identify related workflows.</p>' +
    paragraphs([...new Set(report.errors.map(failureDescription))]) +
    '<h2>Table of Contents</h2><ol>' + report.attempts.map((attempt, index) =>
      '<li><a href="#case-' + index + '">' + escape((attempt.scenario || buildScenario(attempt, index)).id + ' — ' + (attempt.scenario || buildScenario(attempt, index)).title) + '</a> — ' + escape(attempt.status) + ' (attempt ' + (attempt.retry + 1) + ')</li>').join('') + '</ol>' +
    report.attempts.map(scenarioSection).join('') +
    (report.branding?.footerLogo ? '<footer class="report-footer"><img alt="Integrove" src="' + escape(report.branding.footerLogo) + '"><span>Valterra Platinum | Shift Adjustment Regression</span></footer>' : '') + '</body></html>';
}
