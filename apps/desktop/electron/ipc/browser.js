const fs = require('node:fs');
const { app, ipcMain, shell } = require('electron');

const browserRuntime = require('../services/browserRuntime');

/**
 * Браузер для записи и прогона.
 *
 * Конфиг старой модели (browser:getConfig / saveConfig) остаётся как был.
 * Новые каналы отвечают за Chromium в папке данных приложения: статус,
 * загрузка с прогрессом, отмена и открытие папки для поддержки.
 */

let installPromise = null;

function withStatus(extra) {
  return { ...browserRuntime.getStatus(app.getPath('userData')), ...extra };
}

function registerBrowserIpc() {
  ipcMain.handle('browser:getConfig', () => {
    const userData = require('electron').app.getPath('userData');
    const browserConfig = require('../store/browserConfig');
    return browserConfig.getBrowserConfig(userData);
  });

  ipcMain.handle('browser:saveConfig', (_, config) => {
    const userData = require('electron').app.getPath('userData');
    const browserConfig = require('../store/browserConfig');
    return browserConfig.saveBrowserConfig(userData, config || {});
  });

  ipcMain.handle('browser:runtimeStatus', () => withStatus());

  // Одна загрузка на все окна: второй вызов получает тот же промис.
  ipcMain.handle('browser:runtimeInstall', (event) => {
    if (installPromise) return installPromise;

    const userData = app.getPath('userData');
    const logStore = require('./logs').getStore();
    const browsersDir = browserRuntime.browsersDirFor(userData);
    const sender = event && event.sender;

    logStore.info('browser', 'загрузка Chromium началась', { dir: browsersDir });

    installPromise = browserRuntime
      .installChromium({
        userDataPath: userData,
        onProgress: (progress) => {
          if (sender && !sender.isDestroyed()) sender.send('main:browser-progress', progress);
        },
      })
      .then((result) => {
        logStore.info('browser', 'Chromium установлен', {
          executablePath: result.executablePath,
          attempts: result.attempts,
        });
        return withStatus({ ok: true, error: null });
      })
      .catch((error) => {
        const cancelled = error && error.code === 'browser-cancelled';
        if (cancelled) {
          logStore.info('browser', 'загрузка Chromium отменена');
        } else {
          logStore.error('browser', `загрузка Chromium не удалась: ${(error && error.code) || 'ошибка'}`, {
            code: error && error.code,
            message: error && error.message,
            hint: error && error.hint,
            dir: browsersDir,
          });
          console.error(`[NATL] загрузка Chromium не удалась: ${(error && error.message) || error}`);
        }
        // Ошибку не бросаем: при отмене это не сбой, а при сбое hint
        // нужен интерфейсу, а IPC-обёртка отдала бы только message.
        return withStatus({
          ok: false,
          cancelled: Boolean(cancelled),
          error: cancelled
            ? null
            : {
                code: (error && error.code) || 'browser-unknown',
                message: (error && error.message) || 'Не удалось скачать браузер.',
                hint: (error && error.hint) || '',
              },
        });
      })
      .finally(() => {
        installPromise = null;
      });

    return installPromise;
  });

  ipcMain.handle('browser:runtimeCancel', () => ({ cancelled: browserRuntime.cancelInstall() }));

  ipcMain.handle('browser:runtimeOpenFolder', async () => {
    const dir = browserRuntime.browsersDirFor(app.getPath('userData'));
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {
      /* папку мог занять антивирус; openPath ниже покажет правду */
    }
    const error = await shell.openPath(dir);
    return { opened: !error, path: dir, error: error || null };
  });
}

module.exports = registerBrowserIpc;
