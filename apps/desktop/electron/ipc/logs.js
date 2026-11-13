'use strict';

const path = require('node:path');
const { app, ipcMain, shell, BrowserWindow } = require('electron');

const { LogStore } = require('../natl/log');

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

  logStore.info('logs', 'журнал запущен');
  return logStore;
}

module.exports = { registerLogsIpc, getStore };
