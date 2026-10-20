import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { chromium } from '@playwright/test';
import { buildScenario, referenceSource, renderScenarioReport } from './report-scenarios.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));
const stamp = value => value ? new Date(value).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg', hour12: false }) + ' SAST' : '';
async function attachmentBuffer(attachment) {
  return attachment.body || (attachment.path ? await readFile(attachment.path) : Buffer.alloc(0));
}

function expectedValue(params) {
  const value = params?.expected ?? params?.expectedText ?? params?.expectedValue;
  if (value === undefined) return '';
  try { return typeof value === 'string' ? value : JSON.stringify(value); } catch { return String(value); }
}
function checks(items) {
  return items.flatMap(step => step.category === 'test.step' ? [] : [
    ...(step.category === 'expect' ? [{ title: step.title, subtitle: step.subtitle,
      expected: expectedValue(step.params), status: step.error ? 'failed' : 'passed' }] : []),
    // A retrying assertion owns its final result; failed polling attempts are diagnostic.
    ...(step.category === 'expect' ? [] : checks(step.steps || [])),
  ]);
}
function steps(items, parent = []) {
  return items.flatMap(step => {
    const named = step.category === 'test.step';
    const path = named ? [...parent, step.title] : parent;
    const expected = step.params?.expectedResult;
    return [
      ...(named ? [{
        title: step.title, path, start: step.startTime.toISOString(), durationMs: step.duration,
        status: step.annotations?.some(item => item.type === 'skip') ? 'skipped' : step.error ? 'failed' : 'completed',
        error: step.error?.message, checks: checks(step.steps || []),
        expectedResults: expected ? (Array.isArray(expected) ? expected : [expected]) : [],
        referenceCase: step.params?.referenceCase, referenceSteps: step.params?.referenceSteps,
      }] : []), ...steps(step.steps || [], path),
    ];
  });
}

export default class RegressionReporter {
  constructor() { this.attempts = []; this.errors = []; }
  onBegin(config, suite) {
    this.config = config;
    this.total = suite.allTests().length;
    this.started = new Date();
  }
  onError(error) { this.errors.push(error.message || String(error)); }
  onTestEnd(test, result) {
    this.attempts.push({ test, result, outcome: test.outcome() });
  }
  async onEnd(result) {
    const folder = process.env.REGRESSION_OUTPUT_DIR ||
      path.resolve('regression-reports', new Date().toISOString().replace(/[:.]/g, '-'));
    await mkdir(folder, { recursive: true });
    const brandLogo = 'data:image/jpeg;base64,' + (await readFile(new URL('../assets/reporting/valterra-platinum.jpg', import.meta.url))).toString('base64');
    const footerLogo = 'data:image/png;base64,' + (await readFile(new URL('../assets/reporting/integrove.png', import.meta.url))).toString('base64');
    const attempts = [];
    for (const { test, result: testResult, outcome } of this.attempts) {
      const evidence = [];
      for (const attachment of testResult.attachments.filter(item => item.name === 'regression-evidence')) {
        try { evidence.push(...JSON.parse((await attachmentBuffer(attachment)).toString())); }
        catch (error) { this.errors.push('Evidence could not be read: ' + error.message); }
      }
      for (const screen of evidence) {
        const image = testResult.attachments.find(item => item.name === screen.screenshot);
        if (image) {
          try { screen.image = 'data:image/png;base64,' + (await attachmentBuffer(image)).toString('base64'); }
          catch (error) { screen.captureError = error.message; }
        }
      }
      // Retain Playwright failure screenshots even when the browser terminated before evidence capture.
      if (!evidence.some(screen => screen.image)) {
        for (const attachment of testResult.attachments.filter(item => item.contentType === 'image/png')) {
          evidence.push({ description: attachment.name, outcome: testResult.status,
            timestamp: testResult.startTime.toISOString(), name: 'Not detected',
            role: test.parent.project()?.name, roleSource: 'Configured test role',
            image: 'data:image/png;base64,' + (await attachmentBuffer(attachment)).toString('base64') });
        }
      }
      attempts.push({
        id: test.id, title: test.titlePath().filter(Boolean).join(' > '),
        project: test.parent.project()?.name, file: path.relative(this.config.rootDir, test.location.file),
        line: test.location.line, status: testResult.status, expectedStatus: test.expectedStatus,
        outcome, retry: testResult.retry, start: testResult.startTime.toISOString(),
        durationMs: testResult.duration, annotations: test.annotations,
        errors: testResult.errors.map(error => error.message || String(error)),
        steps: steps(testResult.steps), checks: checks(testResult.steps), evidence,
      });
    }
    attempts.forEach((attempt, index) => { attempt.scenario = buildScenario(attempt, index); });
    const latest = new Map(attempts.map(attempt => [attempt.id, attempt]));
    const counts = {};
    for (const attempt of latest.values()) counts[attempt.status] = (counts[attempt.status] || 0) + 1;
    const report = {
      title: 'Valterra Platinum | Shift Adjustment Regression Report',
      branding: { name: 'Valterra Platinum', logo: brandLogo, footerName: 'Integrove', footerLogo }, format: 'Extent-style Playwright report',
      reference: referenceSource, author: process.env.REGRESSION_REPORT_AUTHOR || 'Automated regression execution',
      started: this.started?.toISOString() || new Date().toISOString(), ended: new Date().toISOString(),
      durationMs: result.duration, status: result.status, timezone: 'Africa/Johannesburg',
      selectedTests: this.total || 0, reportedTests: latest.size, counts,
      environment: {
        node: process.version, os: os.platform() + ' ' + os.release(),
        roles: this.config.projects.map(project => project.name),
        baseURLs: [...new Set(this.config.projects.map(project => project.use.baseURL).filter(Boolean))],
        browsers: this.config.projects.map(project => ({
          role: project.name, browser: project.use.browserName || 'chromium', viewport: project.use.viewport,
        })),
        build: process.env.REGRESSION_BUILD || 'Not supplied',
        revision: process.env.REGRESSION_REVISION || 'Not supplied',
      },
      errors: this.errors, attempts,
    };
    await writeFile(path.join(folder, 'regression-report.json'), JSON.stringify(report, null, 2));
    const html = renderReport(report);
    await writeFile(path.join(folder, 'regression-report.html'), html);
    let browser;
    try {
      browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load', timeout: 120000 });
      await page.evaluate(() => Promise.all([...document.images].map(image => image.decode())));
      await page.pdf({
        path: path.join(folder, 'regression-report.pdf'), format: 'A4', landscape: true,
        printBackground: true, displayHeaderFooter: true, headerTemplate: renderPdfHeader(brandLogo),
        footerTemplate: renderPdfFooter(footerLogo),
        margin: { top: '28mm', bottom: '18mm', left: '12mm', right: '12mm' },
      });
      console.log('PDF regression report: ' + path.join(folder, 'regression-report.pdf'));
    } catch (error) {
      console.error('PDF generation failed; HTML and JSON evidence are saved at ' + folder + '. ' + error.message);
      return { status: 'failed' };
    } finally { await browser?.close(); }
  }
}

export const renderReport = renderScenarioReport;

export function renderPdfHeader(logo) {
  return '<div style="width:100%;margin:0 12mm;padding:4mm 0 2mm;border-bottom:1px solid #7c9bab;display:flex;align-items:center;justify-content:space-between;font-family:Arial,sans-serif;-webkit-print-color-adjust:exact;">' +
    '<img alt="Valterra Platinum" src="' + escape(logo) + '" style="width:48mm;height:15mm;object-fit:contain;display:block;">' +
    '<span style="font-size:10px;color:#007b83;">Shift Adjustment | Regression Report</span></div>';
}

export function renderPdfFooter(logo) {
  return '<div style="width:100%;margin:0 12mm;padding:2mm 0;border-top:1px solid #7c9bab;display:flex;align-items:center;justify-content:space-between;font-family:Arial,sans-serif;font-size:9px;color:#263e45;-webkit-print-color-adjust:exact;">' +
    '<img alt="Integrove" src="' + escape(logo) + '" style="width:32mm;height:8mm;object-fit:contain;display:block;">' +
    '<span>Valterra Platinum | Shift Adjustment Regression</span>' +
    '<span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>';
}
