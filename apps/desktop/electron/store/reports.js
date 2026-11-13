const fs = require('fs');
const path = require('path');
const filestore = require('./filestore');

const REPORTS_DIR = 'reports';

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function getReportsDir(rootPath) {
  const p = path.join(rootPath, REPORTS_DIR);
  ensureDir(p);
  return p;
}

function getReportDir(rootPath, reportId) {
  const p = path.join(rootPath, REPORTS_DIR, reportId);
  ensureDir(p);
  return p;
}

function saveReport(rootPath, report) {
  const dir = getReportsDir(rootPath);
  const id = report.id || require('crypto').randomUUID();
  const filePath = path.join(dir, id + '.json');
  const data = { ...report, id };
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  return data;
}

function getScreenshotPath(rootPath, reportId, filename) {
  return path.join(rootPath, REPORTS_DIR, reportId, filename);
}

function readReport(rootPath, reportId) {
  const dir = getReportsDir(rootPath);
  const filePath = path.join(dir, reportId + '.json');
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function listReports(rootPath, testId = null) {
  const dir = getReportsDir(rootPath);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  const reports = [];
  for (const f of files) {
    try {
      const report = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      if (!testId || report.testId === testId) reports.push(report);
    } catch {}
  }
  reports.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return reports.slice(0, 100);
}

const UUID_RE = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

function deleteReport(rootPath, reportId) {
  if (!reportId || typeof reportId !== 'string' || !UUID_RE.test(reportId)) {
    throw new Error('Invalid report id');
  }
  const reportsDir = path.resolve(getReportsDir(rootPath));
  const jsonPath = path.resolve(reportsDir, `${reportId}.json`);
  const folderPath = path.resolve(reportsDir, reportId);
  const relJson = path.relative(reportsDir, jsonPath);
  const relDir = path.relative(reportsDir, folderPath);
  if (relJson.startsWith('..') || path.isAbsolute(relJson) || relDir.startsWith('..') || path.isAbsolute(relDir)) {
    throw new Error('Invalid report path');
  }
  if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath);
  if (fs.existsSync(folderPath)) {
    const st = fs.statSync(folderPath);
    if (st.isDirectory()) fs.rmSync(folderPath, { recursive: true, force: true });
  }
  return true;
}

module.exports = {
  saveReport,
  readReport,
  listReports,
  deleteReport,
  getReportsDir,
  getReportDir,
  getScreenshotPath,
};
