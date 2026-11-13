'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { app, ipcMain } = require('electron');

const filestore = require('../store/filestore');
const llmConfig = require('../store/llmConfig');
const store = require('../natl/store');
const { saveScenario } = require('../natl/save');
const { runScenario, assertInsideWorkspace } = require('../natl/run');
const { startRecording } = require('../natl/recorder');
const { scenarioSummary } = require('../natl/scenario');
const resources = require('../natl/resources');
const artifacts = require('../natl/artifacts');
const { lintYaml } = require('../natl/lint');
const { generateSteps } = require('../natl/ai');
const { chat } = require('../natl/agent-chat');
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
  ipcMain.handle('natl:listScenarios', async () => {
    const root = currentRoot();
    const dir = store.testsDir(root);

    return store.listScenarios(dir).map((file) => {
      let stat = null;
      try {
        stat = fs.statSync(file);
      } catch {
        /* a broken file still deserves a row */
      }
      return scenarioSummary({ filePath: file, root, read: store.readScenario(file), stat });
    });
  });

  ipcMain.handle('natl:readScenario', async (_, relativePath) => {
    const root = currentRoot();
    const resolved = assertInsideWorkspace(root, path.join(root, relativePath));
    return store.readScenario(resolved);
  });

  ipcMain.handle('natl:writeScenario', async (_, payload = {}) => {    const root = currentRoot();
    const { relativePath, text } = payload;
    if (typeof text !== 'string') throw new Error('Нет текста сценария');
    const resolved = assertInsideWorkspace(root, path.join(root, relativePath));
    if (!store.isScenarioFile(resolved)) throw new Error('Это не файл сценария');

    store.writeScenario(resolved, text);
    return { relativePath, savedAt: new Date().toISOString() };
  });

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

  // Ресурсы: локаторы и переиспользуемые действия в pages/
  ipcMain.handle('resources:list', async () => resources.listResources(currentRoot()));
  ipcMain.handle('resources:read', async (_, relativePath) =>
    resources.readResource(currentRoot(), relativePath),
  );
  ipcMain.handle('resources:write', async (_, payload = {}) => {
    const result = resources.writeResource(currentRoot(), payload.relativePath, payload.text);
    getStore().info('resources', `ресурс сохранён: ${payload.relativePath}`);
    return result;
  });
  ipcMain.handle('resources:create', async (_, name) => {
    const result = resources.createResource(currentRoot(), name);
    getStore().info('resources', `ресурс создан: ${result.relativePath}`);
    return result;
  });
  ipcMain.handle('resources:rename', async (_, payload = {}) => {
    const result = resources.renameResource(currentRoot(), payload.relativePath, payload.name);
    getStore().info('resources', `ресурс переименован: ${result.relativePath}`);
    return result;
  });
  ipcMain.handle('resources:delete', async (_, relativePath) => {
    const result = resources.deleteResource(currentRoot(), relativePath);
    getStore().info('resources', `ресурс удалён: ${relativePath}`);
    return result;
  });

  // Проверка до запуска
  ipcMain.handle('natl:lint', (_, text) => lintYaml(text));

  // CRUD сценариев
  ipcMain.handle('natl:deleteScenario', async (_, relativePath) => {
    const root = currentRoot();
    const resolved = assertInsideWorkspace(root, path.join(root, String(relativePath || '')));
    if (!store.isScenarioFile(resolved)) throw new Error('Это не файл сценария');
    fs.unlinkSync(resolved);
    getStore().info('natl', `сценарий удалён: ${relativePath}`);
    return { deleted: true, relativePath };
  });

  ipcMain.handle('natl:renameScenario', async (_, payload = {}) => {
    const root = currentRoot();
    const from = assertInsideWorkspace(root, path.join(root, String(payload.relativePath || '')));
    if (!store.isScenarioFile(from)) throw new Error('Это не файл сценария');

    const fileName = `${String(payload.name || 'scenario')
      .toLowerCase()
      .replace(/[^a-zа-я0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '') || 'scenario'}.yaml`;
    const to = path.join(path.dirname(from), fileName);

    if (path.resolve(from) !== path.resolve(to)) {
      if (fs.existsSync(to)) throw new Error(`Файл ${fileName} уже существует`);
      fs.renameSync(from, to);
    }
    const relativePath = path.relative(root, to).split(path.sep).join('/');
    getStore().info('natl', `сценарий переименован: ${relativePath}`);
    return { relativePath, fileName };
  });

  // Артефакты прогонов
  ipcMain.handle('natl:artifactsInfo', async () => artifacts.artifactsInfo(currentRoot()));
  ipcMain.handle('natl:cleanArtifacts', async (_, options = {}) => {
    const result = artifacts.cleanArtifacts({
      root: currentRoot(),
      keepLast: Number(options.keepLast) || 0,
    });
    getStore().info('artifacts', `удалено прогонов: ${result.removed}`, {
      freedBytes: result.freedBytes,
    });
    return result;
  });

  // AI: the key never leaves the main process, the renderer only sends a prompt.
  ipcMain.handle('ai:generateSteps', async (_, payload = {}) => {
    const root = currentRoot();
    const userData = app.getPath('userData');
    const details = llmConfig.getEffectiveConfigDetails(userData, root);

    try {
      const result = await generateSteps({
        description: payload.description,
        currentYaml: payload.yaml,
        config: details.values,
      });
      getStore().info('ai', `предложено шагов: ${result.steps.length}`, {
        rejected: result.rejected.length,
        model: details.values.modelName,
      });
      return result;
    } catch (err) {
      getStore().error('ai', `генерация не удалась: ${err && err.message ? err.message : err}`, {
        stack: err && err.stack,
      });
      throw err;
    }
  });

  // Агент: чат с инструментами в пределах рабочей папки.
  ipcMain.handle('ai:chat', async (_, payload = {}) => {
    const root = currentRoot();
    const details = llmConfig.getEffectiveConfigDetails(app.getPath('userData'), root);
    const messages = Array.isArray(payload.messages) ? payload.messages : [];

    try {
      const result = await chat({ messages, root, config: details.values });
      getStore().info('ai', `агент ответил, инструментов: ${result.calls.length}`, {
        tools: result.calls.map((call) => call.name),
      });
      return result;
    } catch (err) {
      getStore().error('ai', `агент не ответил: ${err && err.message ? err.message : err}`, {
        stack: err && err.stack,
      });
      throw err;
    }
  });
}

module.exports = { registerNatlIpc };
