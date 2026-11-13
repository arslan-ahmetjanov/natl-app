const { ipcMain } = require('electron');
const { app } = require('electron');
const llmGenerateTests = require('../services/llmGenerateTests');
const { getCurrentPath } = require('./workspace');

function registerGenerateTestsIpc() {
  const progressChannel = 'main:ai-generate-progress';

  ipcMain.handle('tests:generateWithAI', async (event, pageId, customPrompt) => {
    const workspacePath = getCurrentPath();
    if (!workspacePath) throw new Error('No workspace opened');
    const userData = app.getPath('userData');
    const report = (payload) => {
      if (!event.sender.isDestroyed()) event.sender.send(progressChannel, payload);
    };
    try {
      return await llmGenerateTests.generateTestsWithAI(
        userData,
        workspacePath,
        pageId,
        customPrompt || null,
        report
      );
    } catch (e) {
      report({ phase: 'error', message: e.message || String(e) });
      throw e;
    }
  });

  ipcMain.handle('tests:generateFromSelection', async (event, options) => {
    const workspacePath = getCurrentPath();
    if (!workspacePath) throw new Error('No workspace opened');
    const userData = app.getPath('userData');
    const report = (payload) => {
      if (!event.sender.isDestroyed()) event.sender.send(progressChannel, payload);
    };
    try {
      return await llmGenerateTests.generateFromSelection(userData, workspacePath, options || {}, report);
    } catch (e) {
      report({ phase: 'error', message: e.message || String(e) });
      throw e;
    }
  });
}

module.exports = registerGenerateTestsIpc;
