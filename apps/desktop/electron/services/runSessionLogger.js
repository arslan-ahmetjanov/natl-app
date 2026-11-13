const fs = require('fs');
const path = require('path');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function appendLine(filePath, line) {
  fs.appendFileSync(filePath, `[${new Date().toISOString()}] ${line}\n`, 'utf8');
}

/**
 * @param {string} workspaceRoot
 * @param {string} sessionId
 * @param {object} metaPayload written to meta.json once
 */
function createRunSessionLogger(workspaceRoot, sessionId, metaPayload) {
  const sessionDir = path.join(workspaceRoot, '.testblox', 'run-logs', sessionId);
  ensureDir(sessionDir);
  const runLogPath = path.join(sessionDir, 'run.log');
  const metaPath = path.join(sessionDir, 'meta.json');
  fs.writeFileSync(metaPath, JSON.stringify(metaPayload, null, 2), 'utf8');

  const logRun = (line) => appendLine(runLogPath, line);

  const logTest = (testId, line) => {
    if (!testId) return;
    const filePath = path.join(sessionDir, `${testId}.log`);
    appendLine(filePath, line);
  };

  return { sessionDir, logRun, logTest };
}

module.exports = { createRunSessionLogger };
