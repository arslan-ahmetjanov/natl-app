const crypto = require('crypto');
const { ipcMain, app } = require('electron');
const playwrightRunner = require('../services/playwrightRunner');
const reportsStore = require('../store/reports');
const filestore = require('../store/filestore');
const { createRunSessionLogger } = require('../services/runSessionLogger');
const { getCurrentPath } = require('./workspace');

function registerTestsRunIpc(mainWindow) {
  const sendProgress = (data) => {
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('main:test-run-progress', data);
    }
  };

  const mapProgress = (base) => ({
    ...base,
    runStage: base.runStage || 'step',
  });

  ipcMain.handle('tests:run', async (_, testId, options = {}) => {
    const workspacePath = getCurrentPath();
    if (!workspacePath) throw new Error('No workspace opened');
    const test = filestore.readTest(workspacePath, testId);
    if (!test) throw new Error(`Test ${testId} not found`);
    const testTitle = test.title || '';
    sendProgress({ testId, testTitle, phase: 'started' });
    try {
      const report = await playwrightRunner.runTest(workspacePath, testId, {
        onProgress: (stepIndex, total, message, meta) => {
          sendProgress(
            mapProgress({
              testId,
              testTitle,
              stepIndex,
              total,
              message,
              runStage: meta?.runStage,
            }),
          );
        },
        saveReportToFile: true,
        screenshotOnFailureOnly: options.screenshotOnFailureOnly === true,
        userDataPath: app.getPath('userData'),
      });
      sendProgress({
        testId,
        testTitle,
        phase: 'finished',
        passed: report.status === 'passed',
        error: null,
        message: report.status === 'passed' ? 'Done' : 'Failed',
      });
      return report;
    } catch (err) {
      const msg = err.message || String(err);
      sendProgress({
        testId,
        testTitle,
        phase: 'finished',
        passed: false,
        error: msg,
        message: msg,
      });
      throw err;
    }
  });

  ipcMain.handle(
    'tests:runMany',
    async (_, { testIds, concurrency = 1, screenshotOnFailureOnly = false, fileRunLogging = false }) => {
      const workspacePath = getCurrentPath();
      if (!workspacePath) throw new Error('No workspace opened');
      if (!Array.isArray(testIds) || testIds.length === 0) return { results: [], runLogDir: null };

      const limit = Math.max(1, Math.min(Number(concurrency) || 1, 10));
      const results = [];
      let nextIndex = 0;

      let sessionLogger = null;
      let runLogDir = null;
      if (fileRunLogging) {
        const sessionId = crypto.randomUUID();
        sessionLogger = createRunSessionLogger(workspacePath, sessionId, {
          sessionId,
          startedAt: new Date().toISOString(),
          testIds: [...testIds],
          concurrency: limit,
          screenshotOnFailureOnly,
          fileRunLogging: true,
        });
        runLogDir = sessionLogger.sessionDir;
        sessionLogger.logRun(
          `Session start tests=${testIds.length} concurrency=${limit} screenshotOnFailureOnly=${screenshotOnFailureOnly}`,
        );
      }

      const runOne = async (testId) => {
        const meta = filestore.readTest(workspacePath, testId);
        const testTitle = meta && meta.title != null ? String(meta.title) : '';
        sessionLogger?.logRun(`Test starting testId=${testId} title=${testTitle || '(untitled)'}`);
        sendProgress({ testId, testTitle, phase: 'started' });
        try {
          const report = await playwrightRunner.runTest(workspacePath, testId, {
            onProgress: (stepIndex, total, message, meta) => {
              sendProgress(
                mapProgress({
                  testId,
                  testTitle,
                  stepIndex,
                  total,
                  message,
                  runStage: meta?.runStage,
                }),
              );
            },
            saveReportToFile: true,
            screenshotOnFailureOnly,
            userDataPath: app.getPath('userData'),
            log: sessionLogger ? (line) => sessionLogger.logTest(testId, line) : undefined,
          });
          sessionLogger?.logRun(
            `Test finished testId=${testId} status=${report.status} reportId=${report.id}`,
          );
          sendProgress({
            testId,
            testTitle,
            phase: 'finished',
            passed: report.status === 'passed',
            error: null,
            message: report.status === 'passed' ? 'Done' : 'Failed',
          });
          return { testId, report, error: null };
        } catch (err) {
          const msg = err.message || String(err);
          sessionLogger?.logRun(`Test failed testId=${testId} error=${msg}`);
          sendProgress({
            testId,
            testTitle,
            phase: 'finished',
            passed: false,
            error: msg,
            message: msg,
          });
          return { testId, report: null, error: msg };
        }
      };

      const worker = async () => {
        while (nextIndex < testIds.length) {
          const testId = testIds[nextIndex++];
          const result = await runOne(testId);
          results.push(result);
        }
      };

      await Promise.all(Array.from({ length: Math.min(limit, testIds.length) }, () => worker()));
      sessionLogger?.logRun(`Session completed results=${results.length}`);
      return { results, runLogDir };
    },
  );

  ipcMain.handle('reports:list', (_, testId) => {
    const workspacePath = getCurrentPath();
    if (!workspacePath) return [];
    return reportsStore.listReports(workspacePath, testId || null);
  });

  ipcMain.handle('reports:get', (_, reportId) => {
    const workspacePath = getCurrentPath();
    if (!workspacePath) return null;
    return reportsStore.readReport(workspacePath, reportId);
  });

  ipcMain.handle('reports:getScreenshot', (_, reportId, filename) => {
    const workspacePath = getCurrentPath();
    if (!workspacePath) return null;
    const fs = require('fs');
    const filePath = reportsStore.getScreenshotPath(workspacePath, reportId, filename);
    try {
      if (!fs.existsSync(filePath)) return null;
      const buf = fs.readFileSync(filePath);
      return buf.toString('base64');
    } catch {
      return null;
    }
  });

  ipcMain.handle('reports:delete', (_, reportId) => {
    const workspacePath = getCurrentPath();
    if (!workspacePath) throw new Error('No workspace opened');
    return reportsStore.deleteReport(workspacePath, reportId);
  });
}

module.exports = registerTestsRunIpc;
