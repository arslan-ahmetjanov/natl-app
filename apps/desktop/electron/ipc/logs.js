'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { app, dialog, ipcMain, shell, BrowserWindow } = require('electron');

const { LogStore } = require('../natl/log');
const { getAppInfo } = require('../appInfo');

/**
 * The app's single log sink.
 *
 * Three things are wired here:
 *  1. one store for every layer (main, renderer, recorder, runner, IPC);
 *  2. a file on disk, so a bug can be reported after the app was closed;
 *  3. a screen in the UI that shows the tail live.
 *
 * IPC handlers are wrapped, so every failure is logged with its channel before
 * the renderer ever sees it. That is the difference between "не работает" and
 * "click failed on step 3: element not found".
 */

let store = null;
let installed = false;

function getStore() {
  if (!store) {
    const filePath = path.join(app.getPath('userData'), 'logs', 'natl.log');
    store = new LogStore({ filePath });
  }
  return store;
}

function broadcast(entry) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('main:log-entry', entry);
    }
  }
}

/** Имя файла журнала: natl-log-2026-11-14-1830.txt. */
function logFileName(date) {
  const pad = (value) => String(value).padStart(2, '0');
  const stamp = [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-');
  return `natl-log-${stamp}-${pad(date.getHours())}${pad(date.getMinutes())}.txt`;
}

/**
 * Шапка сохранённого журнала.
 *
 * Только то, что спросит поддержка: версия сборки, платформа, папки и есть ли
 * Chromium. Никаких ключей API и токенов — файл уходит в переписку.
 */
function buildReportHeader() {
  const lines = [];
  const info = getAppInfo();
  lines.push('NATL IDE — журнал приложения');
  lines.push(`Версия: ${info.version} (${info.name})`);
  lines.push(`Канал: ${info.channel}`);
  lines.push(`Платформа: ${info.platform} ${info.arch}`);
  lines.push(`Electron: ${info.electron}`);
  lines.push(`Сформирован: ${new Date().toISOString()}`);

  try {
    lines.push(`Папка данных: ${app.getPath('userData')}`);
  } catch {
    lines.push('Папка данных: неизвестна');
  }

  try {
    const browserRuntime = require('../services/browserRuntime');
    const status = browserRuntime.getStatus(app.getPath('userData'));
    lines.push(`Папка браузеров: ${status.browsersDir || 'неизвестна'}`);
    lines.push(`Chromium: ${status.installed ? 'установлен' : 'не установлен'}`);
    if (status.installed && status.executablePath) {
      lines.push(`Chromium, файл: ${status.executablePath}`);
    }
  } catch (err) {
    lines.push(`Папка браузеров: не определена (${err && err.message ? err.message : err})`);
  }

  try {
    const { getCurrentPath } = require('./workspace');
    const root = getCurrentPath();
    lines.push(`Рабочая папка: ${root || 'не открыта'}`);
  } catch {
    lines.push('Рабочая папка: неизвестна');
  }

  return lines.join('\n');
}

/** Console output from the main process also lands in the log. */
function patchConsole(logStore) {
  for (const level of ['warn', 'error']) {
    const original = console[level].bind(console);
    console[level] = (...args) => {
      try {
        const message = args
          .map((arg) => (arg instanceof Error ? `${arg.message}` : String(arg)))
          .join(' ');
        logStore.add(level, 'main', message, firstError(args));
      } catch {
        /* logging must not break the console */
      }
      original(...args);
    };
  }
}

function firstError(args) {
  const error = args.find((arg) => arg instanceof Error);
  return error ? { stack: error.stack } : undefined;
}

/** Every IPC failure is logged with its channel, then passed through. */
function patchIpcMain(logStore) {
  const originalHandle = ipcMain.handle.bind(ipcMain);
  ipcMain.handle = (channel, listener) =>
    originalHandle(channel, async (event, ...args) => {
      try {
        return await listener(event, ...args);
      } catch (err) {
        logStore.error('ipc', `${channel}: ${err && err.message ? err.message : err}`, {
          channel,
          stack: err && err.stack ? err.stack : String(err),
          firstArg: typeof args[0] === 'string' ? args[0].slice(0, 200) : undefined,
        });
        throw err;
      }
    });
}

function registerLogsIpc() {
  const logStore = getStore();

  if (!installed) {
    installed = true;
    logStore.subscribe(broadcast);
    patchConsole(logStore);
    patchIpcMain(logStore);

    process.on('uncaughtException', (err) => {
      logStore.fatal('main', err && err.message ? err.message : String(err), {
        stack: err && err.stack,
      });
    });
    process.on('unhandledRejection', (reason) => {
      logStore.error('main', 'unhandled rejection', { reason: String(reason) });
    });
  }

  ipcMain.handle('logs:list', (_, filter) => logStore.list(filter || {}));
  ipcMain.handle('logs:clear', () => {
    logStore.clear();
    logStore.info('logs', 'журнал очищен');
    return true;
  });
  ipcMain.handle('logs:write', (_, entry = {}) => {
    const { level, scope, message, details } = entry;
    return logStore.add(level, scope || 'renderer', message, details);
  });
  ipcMain.handle('logs:text', (_, filter) => logStore.toText(filter || {}));
  ipcMain.handle('logs:path', () => logStore.filePath);
  ipcMain.handle('logs:openFile', () => {
    const filePath = logStore.filePath;
    if (!filePath) return { opened: false };
    shell.showItemInFolder(filePath);
    return { opened: true, filePath };
  });

  // Журнал в файл: пользователь прикладывает его к письму, поддержка читает.
  // Ошибка записи возвращается как значение, а не исключение: экран журнала
  // должен показать её рядом с кнопкой, а не упасть.
  ipcMain.handle('logs:save', async (event, filter) => {
    const owner = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow();
    const options = {
      title: 'Сохранить журнал',
      defaultPath: logFileName(new Date()),
      filters: [{ name: 'Текстовый файл', extensions: ['txt'] }],
    };
    const { canceled, filePath } = owner
      ? await dialog.showSaveDialog(owner, options)
      : await dialog.showSaveDialog(options);
    if (canceled || !filePath) return { saved: false, canceled: true };

    try {
      const body = logStore.toText(filter || {});
      fs.writeFileSync(filePath, `${buildReportHeader()}\n\n${body}\n`, 'utf8');
      logStore.info('logs', `журнал сохранён: ${filePath}`);
      return { saved: true, path: filePath };
    } catch (err) {
      const message = err && err.message ? err.message : String(err);
      logStore.error('logs', `журнал не сохранён: ${message}`);
      return { saved: false, error: message };
    }
  });

  logStore.info('logs', 'журнал запущен');
  return logStore;
}

module.exports = { registerLogsIpc, getStore };
