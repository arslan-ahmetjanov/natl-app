'use strict';

const fs = require('node:fs');
const { ipcMain } = require('electron');

const filestore = require('../store/filestore');
const { saveScenario } = require('../natl/save');
const { runScenario, assertInsideWorkspace } = require('../natl/run');

/**
 * NATL IPC: the app writes and runs scenario files inside the workspace.
 * Everything else still talks to the old JSON store; this module is the
 * boundary where the new format lives.
 */
function currentRoot() {
  const { getCurrentPath } = require('./workspace');
  const root = getCurrentPath();
  if (!root) throw new Error('No workspace opened');
  return root;
}

function registerNatlIpc() {
  ipcMain.handle('natl:saveScenario', async (_, testId, options = {}) => {
    const root = currentRoot();
    const test = filestore.readTest(root, testId);
    if (!test) throw new Error(`Test not found: ${testId}`);

    return saveScenario({
      root,
      test,
      actions: filestore.readActions(root) || [],
      pages: filestore.listPages(root),
      ...options,
    });
  });

  ipcMain.handle('natl:runScenario', async (event, filePath, options = {}) => {
    const root = currentRoot();
    const sender = event.sender;

    return runScenario({
      root,
      file: filePath,
      ...options,
      onProgress: (payload) => {
        if (!sender.isDestroyed()) sender.send('main:natl-run-progress', payload);
      },
    });
  });

  ipcMain.handle('natl:readScreenshot', async (_, filePath) => {
    const root = currentRoot();
    const resolved = assertInsideWorkspace(root, filePath);
    const buffer = fs.readFileSync(resolved);
    return `data:image/png;base64,${buffer.toString('base64')}`;
  });
}

module.exports = { registerNatlIpc };
