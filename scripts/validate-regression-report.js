import path from 'node:path';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { chromium } from '@playwright/test';
import { renderReport, renderPdfHeader, renderPdfFooter } from './regression-reporter.js';
import { buildScenario } from './report-scenarios.js';

const outputDir = path.resolve('.report-validation', 'report-' + new Date().toISOString().replace(/[:.]/g, '-')); 
await mkdir(outputDir, { recursive: true });
const code = await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [
    path.resolve('node_modules/@playwright/test/cli.js'), 'test',
    '--config=scripts/reporting-smoke.config.js',
  ], {
    env: { ...process.env, REGRESSION_REPORT: '1', REGRESSION_OUTPUT_DIR: outputDir,
      REGRESSION_ROLE_SELECTOR: '#assigned-role', REGRESSION_USER_SELECTOR: '',
      REGRESSION_USER_NAME: '', REGRESSION_USER_ROLE: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', value => { output += value; });
  child.stderr.on('data', value => { output += value; });
  child.on('error', reject);
  child.on('exit', async code => {
    await writeFile(path.join(outputDir, 'validation-run.log'), output);
    resolve(code);
  });
});
assert.equal(code, 1, 'The sample run contains two intentional test failures.');
const report = JSON.parse(await readFile(path.join(outputDir, 'regression-report.json'), 'utf8'));
assert.equal(report.status, 'failed');
assert.equal(report.selectedTests, 8);
assert.deepEqual(report.counts, { passed: 5, failed: 2, skipped: 1 });
const pollingPass = report.attempts.find(attempt => attempt.title.includes('successful polling'));
assert.equal(pollingPass.steps[0].checks.length, 1);
assert.equal(pollingPass.steps[0].checks[0].status, 'passed');
const pollingFailure = report.attempts.find(attempt => attempt.title.includes('polling assertion failure'));
assert.equal(pollingFailure.steps[0].checks.length, 1);
assert.equal(pollingFailure.steps[0].checks[0].status, 'failed');
const pass = report.attempts.find(attempt => attempt.title.includes('intermediate screens'));
assert(pass.evidence.some(screen => screen.description === 'Visit the second screen' && screen.stepPath.includes('Visit the second screen')));
assert.equal(pass.scenario.steps[0].expectedResults[0], 'The second screen displays the heading ?Second screen?.');
assert.equal(pass.scenario.steps[0].checks[0].status, 'passed');
assert.equal(report.reference.caseCount, 36);
assert.deepEqual(report.reference.columns, ['Scenario', 'Test Steps', 'Screenshot Evidence', 'Expected Result']);
const mapped = buildScenario({ ...pass, project: 'admin', file: 'shared/approve-shift-adjustment.spec.js', annotations: [] }, 0);
assert.equal(mapped.references[0].id, 'TC-020');
assert(mapped.references[0].expectedResults.some(result => result.text.includes('APPROVED')));
assert(mapped.referenceCoverage.includes('not established'));
const plannedStep = buildScenario({
  ...pass, project: 'admin', file: 'shared/approve-shift-adjustment.spec.js', annotations: [],
  steps: [{ title: 'Confirm approval', params: {}, expectedResults: [], checks: [],
    referenceCase: 'TC-020', referenceSteps: [4], path: ['Confirm approval'] }],
}, 0);
assert.deepEqual(plannedStep.steps[0].expectedResults, ['The approval is completed.']);
const structured = structuredClone(report);
structured.attempts[0].scenario = mapped;
assert(renderReport(structured).includes('Related reference scenarios and expected results'));
assert(renderReport(structured).includes('TC-020'));
assert(renderReport(structured).includes('APPROVED'));
const legacyAttempt = { ...pass, steps: [{ title: 'Legacy step', durationMs: 1, status: 'completed' }] };
assert.equal(buildScenario(legacyAttempt, 0).steps[0].checks.length, 0);
const cancellation = buildScenario({ ...pass, project: 'admin', file: 'shared/cancel-shift-adjustment.spec.js', annotations: [] }, 0);
assert(cancellation.references[0].reviewNotes[0].includes('employee selection'));
const nonAdmin = buildScenario({ ...pass, project: 'approver', file: 'shared/approve-shift-adjustment.spec.js', annotations: [] }, 0);
assert.equal(nonAdmin.references.length, 0);
assert(pass.evidence.every(screen => screen.name === 'Regression Tester' && screen.role === 'Administrator' && screen.image));
assert(new Set(pass.evidence.map(screen => screen.image)).size >= 2, 'Distinct screens must have distinct images.');
const failed = report.attempts.find(attempt => attempt.status === 'failed');
assert(failed.errors.some(error => error.includes('Smoke validation failure')));
assert(failed.evidence.some(screen => screen.description === 'Intentional regression failure' && screen.outcome === 'failed' && screen.image));
const shared = report.attempts.find(attempt => attempt.title.includes('beforeAll'));
assert(shared.evidence.some(screen => screen.name === 'Shared Tester' && screen.role === 'Approver' && screen.image));
const gaps = report.attempts.find(attempt => attempt.title.includes('identity gaps'));
assert(gaps.evidence.some(screen => screen.name === 'Not detected' && screen.roleSource.includes('not verified')));
const shadow = report.attempts.find(attempt => attempt.title.includes('UI5-style shadow DOM'));
assert(shadow.evidence.some(screen => screen.name === 'Shadow Tester' && screen.nameSource === 'Application UI' && screen.role === 'Approver' && screen.roleSource === 'Application UI'));
const pdf = await readFile(path.join(outputDir, 'regression-report.pdf'));
assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
assert(pdf.length > 10000);
const logo = await readFile(new URL('../assets/reporting/valterra-platinum.jpg', import.meta.url));
const pdfObjects = new Map([...pdf.toString('latin1').matchAll(/(\d+) 0 obj\s*([\s\S]*?)endobj/g)].map(match => [match[1], match[2]]));
const logoObjects = [...pdfObjects].filter(([, body]) => /\/Subtype\s*\/Image/.test(body) && body.includes(logo.toString('latin1')));
assert(logoObjects.length > 0, 'The original supplied logo must be embedded in the PDF.');
const logoIds = new Set(logoObjects.map(([id]) => id));
const footerLogo = await readFile(new URL('../assets/reporting/integrove.png', import.meta.url));
const footerWidth = footerLogo.readUInt32BE(16);
const footerHeight = footerLogo.readUInt32BE(20);
const footerIds = new Set([...pdfObjects].filter(([, body]) =>
  /\/Subtype\s*\/Image/.test(body) &&
  new RegExp('/Width\\s+' + footerWidth + '\\b').test(body) &&
  new RegExp('/Height\\s+' + footerHeight + '\\b').test(body) &&
  !/\/ColorSpace\s*\/DeviceGray/.test(body)
).map(([id]) => id));
assert(footerIds.size > 0, 'The Integrove footer logo must be embedded.');
assert.equal(report.branding.footerName, 'Integrove');
const pdfPages = [...pdfObjects.values()].filter(body => /\/Type\s*\/Page\b/.test(body));
assert(pdfPages.length > 1);
for (const pageObject of pdfPages) {
  const logoNames = [...pageObject.matchAll(/(\/X\d+)\s+(\d+) 0 R/g)].filter(([, , id]) => logoIds.has(id)).map(([, name]) => name);
  assert(logoNames.length > 0, 'Every page must reference the logo.');
  const contentId = pageObject.match(/\/Contents\s+(\d+) 0 R/)[1];
  const contentObject = pdfObjects.get(contentId);
  const streamStart = contentObject.indexOf('stream\n') + 7;
  const streamEnd = contentObject.lastIndexOf('\nendstream');
  const content = inflateSync(Buffer.from(contentObject.slice(streamStart, streamEnd), 'latin1')).toString();
  assert(logoNames.some(name => content.includes(name + ' Do')), 'Every page must draw the logo.');
  const footerNames = [...pageObject.matchAll(/(\/X\d+)\s+(\d+) 0 R/g)]
    .filter(([, , id]) => footerIds.has(id)).map(([, name]) => name);
  assert(footerNames.some(name => content.includes(name + ' Do')), 'Every page must draw the Integrove footer logo.');
}
assert.equal(report.branding.name, 'Valterra Platinum');
assert(report.title.startsWith('Valterra Platinum'));
console.log('Header and footer logos verified on all ' + pdfPages.length + ' PDF pages.');
assert((pdf.toString('latin1').match(/\/Subtype\s*\/Image/g) || []).length >= 2, 'The PDF must embed screenshots.');
const html = await readFile(path.join(outputDir, 'regression-report.html'), 'utf8');
assert(html.includes('Evidence gaps:'));
assert(html.includes('Intentional regression failure'));
assert(html.includes('Application UI'));
assert(html.includes('Screenshot Evidence'));
assert(html.includes('Expected Result'));
assert(html.includes('Document Control'));
assert(html.includes('Prerequisite:'));
assert(html.includes('The second screen displays the heading'));
const malicious = structuredClone(report);
malicious.title = '<script>alert("x")</script>';
assert(renderReport(malicious).includes('&lt;script&gt;'));
assert(!renderReport(malicious).includes('<script>'));
const previewBrowser = await chromium.launch({ headless: true });
try {
  const previewPage = await previewBrowser.newPage({ viewport: { width: 1032, height: 690 } });
  await previewPage.setContent(html);
  await previewPage.emulateMedia({ media: 'print' });
  const screen = previewPage.locator('.screen').filter({ hasText: 'The second screen displays the heading' }).first();
  assert((await screen.boundingBox()).height < 619, 'Screen metadata and its image must fit on one landscape A4 page.');
  await screen.screenshot({ path: path.join(outputDir, 'screen-preview.png') });
  await previewPage.setContent('<html><body style="margin:0;padding:0;background:white">' + renderPdfHeader(report.branding.logo) + '</body></html>');
  await previewPage.locator('body > div').screenshot({ path: path.join(outputDir, 'header-preview.png') });
  await previewPage.setContent('<html><body style="margin:0;padding:0;background:white">' + renderPdfFooter(report.branding.footerLogo) + '</body></html>');
  await previewPage.locator('body > div').screenshot({ path: path.join(outputDir, 'footer-preview.png') });
} finally { await previewBrowser.close(); }
console.log('Reporting validation passed: PDF, identity, distinct screenshots, steps, failure evidence, skipped tests, shared contexts, identity gaps, and HTML escaping.');
console.log('Sample PDF: ' + path.join(outputDir, 'regression-report.pdf'));
