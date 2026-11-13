'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { app, ipcMain } = require('electron');

/**
 * Автообновление с выключателем.
 *
 * Проверка и скачивание идут с GitHub Releases. Ставится при выходе.
 * Три предохранителя: выключатель в настройках, канал (stable / beta)
 * и возможность проверить вручную, не включая автоматику.
 *
 * В dev-режиме обновления не работают: electron-updater требует собранного
 * приложения и файла latest.yml в релизе.
 */

const DEFAULT_SETTINGS = { enabled: false, channel: 'stable', autoDownload: true };

let autoUpdater = null;
let settingsPath = null;
let settings = { ...DEFAULT_SETTINGS };
let lastStatus = { state: 'idle', version: null, error: null, checkedAt: null };

function readSettings() {
  try {
    const raw = fs.readFileSync(settingsPath, 'utf8');
    settings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    settings = { ...DEFAULT_SETTINGS };
  }
  return settings;
}

function writeSettings(next) {
  settings = { ...settings, ...next };
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
  return settings;
}

function broadcast(payload) {
  lastStatus = { ...lastStatus, ...payload };
  for (const win of require('electron').BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('main:update-status', lastStatus);
  }
}

function registerUpdaterIpc() {
  settingsPath = path.join(app.getPath('userData'), 'update.json');
  readSettings();

  const info = {
    supported: app.isPackaged,
    version: app.getVersion(),
    platform: process.platform,
  };

  ipcMain.handle('update:get', () => ({ settings, status: lastStatus, info }));

  ipcMain.handle('update:set', (_, next = {}) => {
    const updated = writeSettings({
      enabled: Boolean(next.enabled),
      channel: next.channel === 'beta' ? 'beta' : 'stable',
      autoDownload: next.autoDownload !== false,
    });
    if (autoUpdater) {
      autoUpdater.channel = updated.channel === 'beta' ? 'beta' : 'latest';
      autoUpdater.allowPrerelease = updated.channel === 'beta';
      autoUpdater.autoDownload = updated.autoDownload;
    }
    return { settings: updated, status: lastStatus, info };
  });

  ipcMain.handle('update:check', async () => {
    if (!app.isPackaged || !autoUpdater) {
      return { ok: false, reason: 'dev', status: lastStatus };
    }
    try {
      await autoUpdater.checkForUpdates();
      return { ok: true, status: lastStatus };
    } catch (err) {
      broadcast({ state: 'error', error: err.message || String(err) });
      return { ok: false, reason: err.message || String(err), status: lastStatus };
    }
  });

  ipcMain.handle('update:install', () => {
    if (!autoUpdater) return { ok: false, reason: 'dev' };
    autoUpdater.quitAndInstall(false, true);
    return { ok: true };
  });

  if (!app.isPackaged) {
    return { settings, status: lastStatus, info };
  }

  // Ленивая загрузка: пакет тянет много кода, а в dev он не нужен.
  const { autoUpdater: updater } = require('electron-updater');
  autoUpdater = updater;
  autoUpdater.autoDownload = settings.autoDownload;
  autoUpdater.allowPrerelease = settings.channel === 'beta';
  autoUpdater.channel = settings.channel === 'beta' ? 'beta' : 'latest';
  autoUpdater.logger = null;

  autoUpdater.on('checking-for-update', () => broadcast({ state: 'checking', error: null }));
  autoUpdater.on('update-available', (info) => broadcast({ state: 'available', version: info.version }));
  autoUpdater.on('update-not-available', () => broadcast({ state: 'none', checkedAt: new Date().toISOString() }));
  autoUpdater.on('download-progress', (progress) =>
    broadcast({ state: 'downloading', percent: Math.round(progress.percent || 0) }),
  );
  autoUpdater.on('update-downloaded', (info) => broadcast({ state: 'ready', version: info.version }));
  autoUpdater.on('error', (err) => broadcast({ state: 'error', error: err.message || String(err) }));

  if (settings.enabled) {
    autoUpdater.checkForUpdates().catch(() => {});
  }

  return { settings, status: lastStatus, info };
}

module.exports = { registerUpdaterIpc, DEFAULT_SETTINGS };
