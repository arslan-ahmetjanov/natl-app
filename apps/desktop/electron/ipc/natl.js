'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { ipcMain } = require('electron');

const filestore = require('../store/filestore');
const store = require('../natl/store');
const { saveScenario } = require('../natl/save');
const { runScenario, assertInsideWorkspace } = require('../natl/run');
const { startRecording } = require('../natl/recorder');
const { getStore } = require('./logs');

/** One recorder at a time: a second browser would fight the first for events. */
let recorder = null;

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

    const saved = saveScenario({
      root,
      test,
      actions: filestore.readActions(root) || [],
      pages: filestore.listPages(root),
      ...options,
    });
    getStore().info('natl', `сценарий сохранён: ${saved.relativePath}`, {
      unsupported: saved.unsupported.length,
    });
    return saved;
  });

  ipcMain.handle('natl:runScenario', async (event, filePath, options = {}) => {
    const root = currentRoot();
    const sender = event.sender;

    const log = getStore();
    log.info('runner', `прогон начат: ${path.basename(filePath)}`);

    try {
      const result = await runScenario({
        root,
        file: filePath,
        ...options,
        onProgress: (payload) => {
          if (payload.type === 'step-end' && !payload.ok) {
            log.warn('runner', `шаг упал: ${payload.name}`, { error: payload.error });
          }
          if (!sender.isDestroyed()) sender.send('main:natl-run-progress', payload);
        },
      });

      if (result.ok) {
        log.info('runner', `прогон прошёл за ${result.durationMs} мс`, {
          steps: (result.steps || []).length,
        });
      } else {
        log.error('runner', `прогон упал: ${result.error || 'без текста'}`, {
          durationMs: result.durationMs,
        });
      }
      return result;
    } catch (err) {
      log.error('runner', `прогон не запустился: ${err && err.message ? err.message : err}`, {
        stack: err && err.stack,
      });
      throw err;
    }
  });

  ipcMain.handle('natl:readScreenshot', async (_, filePath) => {
    const root = currentRoot();
    const resolved = assertInsideWorkspace(root, filePath);
    const buffer = fs.readFileSync(resolved);
    return `data:image/png;base64,${buffer.toString('base64')}`;
  });

  ipcMain.handle('natl:recordStart', async (event, options = {}) => {
    if (recorder) {
      await recorder.close();
      recorder = null;
    }
    const sender = event.sender;
    const handle = await startRecording({
      url: options.url,
      headless: options.headless === true,
      onStep: (step) => {
        if (!sender.isDestroyed()) sender.send('main:natl-record-progress', step);
      },
    });
    recorder = handle;
    getStore().info('recorder', `запись начата: ${handle.url}`);
    return { url: handle.url, warnings: handle.warnings };
  });

  ipcMain.handle('natl:recordStop', async (_, options = {}) => {
    if (!recorder) throw new Error('Запись не запущена');
    const handle = recorder;
    recorder = null;
    const result = await handle.stop({ name: options.name });
    getStore().info('recorder', `запись остановлена, шагов: ${result.steps.length}`, {
      warnings: result.warnings.length,
    });
    return result;
  });

  ipcMain.handle('natl:recordCancel', async () => {
    if (!recorder) return { cancelled: false };
    const handle = recorder;
    recorder = null;
    await handle.close();
    getStore().info('recorder', 'запись отменена');
    return { cancelled: true };
  });

  ipcMain.handle('natl:saveRecorded', async (_, payload = {}) => {
    const root = currentRoot();
    const { yaml, name } = payload;
    if (typeof yaml !== 'string' || !yaml.trim()) throw new Error('Пустой сценарий');

    const dir = store.testsDir(root);
    const existing = store.listScenarios(dir).map((file) => path.basename(file));
    const fileName = store.scenarioFileName(name, existing);
    const filePath = path.join(dir, fileName);
    store.writeScenario(filePath, yaml);

    return {
      filePath,
      fileName,
      relativePath: path.relative(root, filePath).split(path.sep).join('/'),
    };
  });
}

module.exports = { registerNatlIpc };
