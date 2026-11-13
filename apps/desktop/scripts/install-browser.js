'use strict';

/**
 * Скачивает Chromium для разработки и CI.
 *
 *   npm run browser:install
 *
 * Папка: PLAYWRIGHT_BROWSERS_PATH, если задан снаружи, иначе apps/desktop/.browsers.
 * Работает и под node, и под Electron: app не требуется.
 */

const path = require('node:path');

const runtime = require('../electron/services/browserRuntime');

const appDir = path.join(__dirname, '..');
const external = (process.env.PLAYWRIGHT_BROWSERS_PATH || '').trim();
const browsersDir = external || path.join(appDir, '.browsers');
process.env.PLAYWRIGHT_BROWSERS_PATH = browsersDir;

function printProgress(event) {
  if (!event) return;
  if (event.phase === 'download') {
    const label = event.label || 'загрузка';
    const total = event.totalMiB == null ? '?' : event.totalMiB;
    const done = event.downloadedMiB == null ? '?' : event.downloadedMiB;
    console.log(`${event.percent}% · ${label} · ${done}/${total} MiB`);
    return;
  }
  if (event.phase === 'unpack') console.log(`100% · распаковка: ${event.label || ''}`);
}

(async () => {
  console.log(`браузер ставится в ${browsersDir}`);
  try {
    const result = await runtime.installChromium({
      userDataPath: appDir,
      onProgress: printProgress,
    });
    console.log(`готово: ${result.executablePath}`);
    console.log(`попыток: ${result.attempts}`);
    process.exit(0);
  } catch (error) {
    console.error(`ошибка: ${error.code || 'browser-unknown'}`);
    console.error(error.message);
    if (error.hint) console.error(error.hint);
    if (error.details) console.error(`подробности: ${error.details}`);
    process.exit(1);
  }
})();
