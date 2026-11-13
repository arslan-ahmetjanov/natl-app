'use strict';

const { ipcMain } = require('electron');

const filestore = require('../store/filestore');
const { saveScenario } = require('../natl/save');

/**
 * NATL IPC: the app writes scenario files into the workspace repository.
 * Keeping these handlers in one small module makes the boundary visible —
 * everything else still talks to the old JSON store.
 */
function registerNatlIpc() {
  ipcMain.handle('natl:saveScenario', async (_, testId, options = {}) => {
    const { getCurrentPath } = require('./workspace');
    const root = getCurrentPath();
    if (!root) throw new Error('No workspace opened');

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
}

module.exports = { registerNatlIpc };
