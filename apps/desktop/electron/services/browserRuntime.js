'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const DOWNLOAD_LINE = /^Downloading\s+(.+?)\s+from\s+\S+/i;
const PERCENT_LINE = /(\d{1,3})%\s+of\s+([\d.]+)\s*MiB/i;
const UNPACK_LINE = /downloaded to\s+/i;
const RETRY_DELAYS_MS = [1000, 3000];
const PROGRESS_THROTTLE_MS = 100;

let currentChild = null;
let installing = false;
let cancelRequested = false;
let ownBrowsersDir = null;

/** Chromium живёт в данных приложения, а не в системном кэше Playwright. */
function browsersDirFor(userDataPath) {
  return path.join(userDataPath, 'browsers');
}

/**
 * Выставляет PLAYWRIGHT_BROWSERS_PATH до первого require('playwright'):
 * реестр браузеров читает переменную в момент загрузки модуля.
 *
 * Внешнее значение (CI, разработчик, другой лаунчер) не перетирается.
 * @returns {{ dir: string|null, owned: boolean, error?: Error }}
 */
function configureBrowsersPath(userDataPath) {
  try {
    const dir = browsersDirFor(userDataPath);
    const current = (process.env.PLAYWRIGHT_BROWSERS_PATH || '').trim();
    if (current) {
      return { dir: current, owned: current === ownBrowsersDir };
    }
    process.env.PLAYWRIGHT_BROWSERS_PATH = dir;
    ownBrowsersDir = dir;
    return { dir, owned: true };
  } catch (error) {
    return { dir: null, owned: false, error };
  }
}

/** Путь к chrome.exe, только если файл реально лежит на диске. */
function installedChromiumPath() {
  try {
    const { chromium } = require('playwright');
    const executablePath = chromium.executablePath();
    return executablePath && fs.existsSync(executablePath) ? executablePath : null;
  } catch {
    return null;
  }
}

function playwrightVersion() {
  try {
    return require('playwright/package.json').version || null;
  } catch {
    return null;
  }
}

/** Никогда не бросает: экран настроек должен открываться при любой поломке. */
function getStatus(userDataPath) {
  try {
    const { dir, owned } = configureBrowsersPath(userDataPath);
    const executablePath = installedChromiumPath();
    return {
      installed: Boolean(executablePath),
      executablePath: executablePath || null,
      browsersDir: dir,
      owned,
      playwrightVersion: playwrightVersion(),
    };
  } catch {
    return {
      installed: false,
      executablePath: null,
      browsersDir: null,
      owned: false,
      playwrightVersion: null,
    };
  }
}

/**
 * Разбирает одну строку вывода `playwright install`.
 * Входной state не мутируется: возвращается новый объект.
 *
 * @param {string} line строка без \r и \n
 * @param {{ label?: string|null, percent?: number, downloadedMiB?: number, totalMiB?: number|null }} state
 * @returns {{ state: object, event: { phase: string, label: string|null, percent: number, downloadedMiB: number|null, totalMiB: number|null }|null }}
 */
function parseProgressLine(line, state = {}) {
  const base = {
    label: state.label ?? null,
    percent: state.percent ?? 0,
    downloadedMiB: state.downloadedMiB ?? 0,
    totalMiB: state.totalMiB ?? null,
  };
  const text = String(line ?? '');
  if (!text.trim()) return { state: base, event: null };

  const download = text.match(DOWNLOAD_LINE);
  if (download) {
    // Новый файл: прежний процент уже не имеет смысла.
    const next = { label: download[1].trim(), percent: 0, downloadedMiB: 0, totalMiB: null };
    return {
      state: next,
      event: { phase: 'download', label: next.label, percent: 0, downloadedMiB: 0, totalMiB: null },
    };
  }

  const percent = text.match(PERCENT_LINE);
  if (percent) {
    const value = Math.max(0, Math.min(100, Number(percent[1])));
    const totalMiB = Number(percent[2]);
    const next = {
      ...base,
      percent: value,
      downloadedMiB: Number.isFinite(totalMiB) ? Number(((totalMiB * value) / 100).toFixed(1)) : 0,
      totalMiB: Number.isFinite(totalMiB) ? totalMiB : null,
    };
    return {
      state: next,
      event: {
        phase: 'download',
        label: next.label,
        percent: next.percent,
        downloadedMiB: next.downloadedMiB,
        totalMiB: next.totalMiB,
      },
    };
  }

  if (UNPACK_LINE.test(text)) {
    const next = { ...base, percent: 100 };
    return {
      state: next,
      event: {
        phase: 'unpack',
        label: next.label,
        percent: 100,
        downloadedMiB: next.totalMiB ?? next.downloadedMiB,
        totalMiB: next.totalMiB,
      },
    };
  }

  return { state: base, event: null };
}

/**
 * Переводит хвост вывода установщика в понятную причину.
 * Порядок важен: сеть → прокси → сертификат → диск → права → прочее.
 */
function explainInstallFailure(output, ctx = {}) {
  const text = String(output || '');
  const low = text.toLowerCase();
  const has = (...needles) => needles.some((needle) => low.includes(needle.toLowerCase()));

  if (has('enotfound', 'eai_again', 'getaddrinfo', 'etimedout', 'econnreset', 'econnrefused', 'socket hang up', 'network')) {
    return {
      code: 'browser-offline',
      message: 'Нет связи с сервером загрузки. Проверьте интернет и прокси.',
      hint: 'Если интернет работает, включите прокси в системе или задайте HTTPS_PROXY и повторите.',
    };
  }

  if (has('407', 'proxy', 'tunnel') || /\bCONNECT\b/.test(text)) {
    return {
      code: 'browser-proxy',
      message: 'Прокси не пускает загрузку.',
      hint: 'Задайте HTTPS_PROXY и HTTP_PROXY с адресом прокси. Если нужен логин, впишите его в адрес: http://user:pass@proxy:8080.',
    };
  }

  if (has('self signed certificate', 'unable_to_get_issuer_cert', 'certificate')) {
    return {
      code: 'browser-tls',
      message: 'Прокси или антивирус подменяет сертификат.',
      hint: 'Укажите корневой сертификат в NODE_EXTRA_CA_CERTS — путь к файлу .pem или .crt.',
    };
  }

  if (has('enospc', 'no space')) {
    return {
      code: 'browser-disk',
      message: 'Не хватает места на диске. Нужно около 400 МБ.',
      hint: 'Освободите место или перенесите папку браузеров на другой диск через PLAYWRIGHT_BROWSERS_PATH.',
    };
  }

  if (has('eacces', 'eperm', 'ebusy', 'being used by another process')) {
    return {
      code: 'browser-permissions',
      message: 'Нет доступа к папке браузеров или файл занят антивирусом.',
      hint: 'Разрешите запись в папку браузеров или выключите антивирус на время загрузки.',
    };
  }

  const dir = ctx.browsersDir ? ` Папка: ${ctx.browsersDir}.` : '';
  return {
    code: 'browser-unknown',
    message: 'Не удалось скачать браузер.',
    hint: `Повторите позже; если не помогает, скачайте вручную (см. README, раздел про браузер).${dir}`,
  };
}

function makeError({ code, message, hint, details = '' }) {
  const error = new Error(message);
  error.code = code;
  error.hint = hint;
  error.details = String(details || '').slice(-2000);
  return error;
}

function playwrightCliPath() {
  const packageJson = require.resolve('playwright/package.json');
  return path.join(path.dirname(packageJson), 'cli.js');
}

/** Electron в роли node пишет в stderr свои внутренние ошибки — они не про загрузку. */
function isElectronNoise(line) {
  return /^\[\d+\/\d+\.\d+:(INFO|WARNING|ERROR|VERBOSE\d*):/.test(line.trim());
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Одна попытка `playwright install chromium` с прогрессом.
 * Промис реджектится с кодом из explainInstallFailure либо browser-cancelled.
 */
function runInstallerOnce({ browsersDir, onProgress, attempt }) {
  return new Promise((resolve, reject) => {
    let cliPath;
    try {
      cliPath = playwrightCliPath();
    } catch (error) {
      reject(makeError({
        code: 'browser-unknown',
        message: 'Не удалось найти установщик браузера.',
        hint: 'Переустановите приложение: в нём нет модуля playwright.',
        details: error && error.message,
      }));
      return;
    }

    const child = spawn(process.execPath, [cliPath, 'install', 'chromium'], {
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        PLAYWRIGHT_BROWSERS_PATH: browsersDir,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    currentChild = child;

    let state = { label: null, percent: 0, downloadedMiB: 0, totalMiB: null };
    let tail = '';
    let lastPercent = null;
    let lastEmitAt = 0;
    let settled = false;

    const remember = (line) => {
      tail = `${tail}${line}\n`.slice(-4000);
    };

    const emit = (event) => {
      if (!event) return;
      const now = Date.now();
      if (event.phase === 'download') {
        if (lastPercent === event.percent && now - lastEmitAt < PROGRESS_THROTTLE_MS) return;
        lastPercent = event.percent;
      } else {
        lastPercent = null;
      }
      lastEmitAt = now;
      try {
        onProgress({ ...event, attempt });
      } catch {
        /* падение обработчика не должно ломать загрузку */
      }
    };

    const handleStdoutLine = (line) => {
      if (!line.trim()) return;
      const parsed = parseProgressLine(line, state);
      state = parsed.state;
      remember(line.trim());
      emit(parsed.event);
    };

    const makeStreamHandler = (isStdout) => {
      let buffer = '';
      return {
        push(chunk) {
          buffer += chunk;
          const parts = buffer.split(/\r\n|\r|\n/);
          buffer = parts.pop() ?? '';
          for (const part of parts) {
            if (isStdout) {
              handleStdoutLine(part);
            } else if (part.trim() && !isElectronNoise(part)) {
              remember(part.trim());
            }
          }
        },
        flush() {
          const rest = buffer;
          buffer = '';
          if (!rest.trim()) return;
          if (isStdout) handleStdoutLine(rest);
          else if (!isElectronNoise(rest)) remember(rest.trim());
        },
      };
    };

    const onStdout = makeStreamHandler(true);
    const onStderr = makeStreamHandler(false);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => onStdout.push(chunk));
    child.stderr.on('data', (chunk) => onStderr.push(chunk));

    const settle = (fn) => {
      if (settled) return;
      settled = true;
      currentChild = null;
      fn();
    };

    child.on('error', (error) => {
      const explanation = explainInstallFailure(`${error.code || ''} ${error.message || ''}`, { browsersDir });
      settle(() => reject(makeError({ ...explanation, details: tail.slice(-2000) || error.message })));
    });

    child.on('close', (code) => {
      onStdout.flush();
      onStderr.flush();
      settle(() => {
        if (cancelRequested) {
          reject(cancelledError());
          return;
        }
        if (code === 0) {
          resolve();
          return;
        }
        const explanation = explainInstallFailure(tail, { browsersDir, exitCode: code });
        reject(makeError({ ...explanation, details: tail.slice(-2000) }));
      });
    });
  });
}

function cancelledError() {
  return makeError({
    code: 'browser-cancelled',
    message: 'Загрузка отменена.',
    hint: 'Запустите установку снова, когда будете готовы.',
  });
}

/**
 * Скачивает Chromium в папку браузеров приложения.
 *
 * Повтор после обрыва: 3 попытки с паузами 1 с и 3 с. Отмена и нехватка
 * места не повторяются — они не пройдут сами.
 */
async function installChromium({ userDataPath, onProgress = () => {}, attempts = 3 } = {}) {
  if (installing) {
    throw makeError({
      code: 'browser-busy',
      message: 'Загрузка уже идёт.',
      hint: 'Дождитесь окончания текущей загрузки.',
    });
  }

  const configured = configureBrowsersPath(userDataPath);
  if (!configured.dir) {
    throw makeError({
      code: 'browser-permissions',
      message: 'Нет доступа к папке браузеров или файл занят антивирусом.',
      hint: 'Проверьте права на папку данных приложения и повторите.',
      details: configured.error && configured.error.message,
    });
  }

  const total = Math.max(1, Number(attempts) || 1);
  installing = true;
  cancelRequested = false;
  try {
    for (let attempt = 1; attempt <= total; attempt += 1) {
      try {
        try {
          fs.mkdirSync(configured.dir, { recursive: true });
        } catch (mkdirError) {
          throw makeError({
            ...explainInstallFailure(mkdirError && mkdirError.message, { browsersDir: configured.dir }),
            details: mkdirError && mkdirError.message,
          });
        }
        await runInstallerOnce({ browsersDir: configured.dir, onProgress, attempt });

        const executablePath = installedChromiumPath();
        if (!executablePath) {
          throw makeError({
            code: 'browser-unknown',
            message: 'Браузер скачался, но файл запуска не найден.',
            hint: 'Проверьте папку браузеров и повторите загрузку.',
            details: configured.dir,
          });
        }

        onProgress({ phase: 'done', label: null, percent: 100, downloadedMiB: null, totalMiB: null, attempt });
        return { executablePath, attempts: attempt };
      } catch (error) {
        if (cancelRequested) {
          cancelRequested = false;
          throw cancelledError();
        }
        const code = error && error.code;
        const retryable = code !== 'browser-cancelled' && code !== 'browser-disk' && attempt < total;
        if (!retryable) throw error;
        console.error(`[NATL] браузер не скачался (попытка ${attempt} из ${total}): ${code || 'ошибка'} — повтор`);
        await delay(RETRY_DELAYS_MS[attempt - 1] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]);
        if (cancelRequested) {
          cancelRequested = false;
          throw cancelledError();
        }
      }
    }
    throw makeError({
      code: 'browser-unknown',
      message: 'Не удалось скачать браузер.',
      hint: 'Повторите позже; если не помогает, скачайте вручную (см. README, раздел про браузер).',
    });
  } finally {
    installing = false;
  }
}

/** Останавливает текущую загрузку. Промис установки реджектится с browser-cancelled. */
function cancelInstall() {
  if (!installing) return false;
  cancelRequested = true;
  if (!currentChild) return true;
  try {
    currentChild.kill();
    return true;
  } catch {
    return false;
  }
}

function isInstalling() {
  return installing;
}

/** Проверяет наличие браузера и ставит его при необходимости. */
async function ensureChromium({ userDataPath, onProgress = () => {} } = {}) {
  const status = getStatus(userDataPath);
  if (status.installed) return status.executablePath;
  const result = await installChromium({ userDataPath, onProgress });
  return result.executablePath;
}

module.exports = {
  browsersDirFor,
  configureBrowsersPath,
  installedChromiumPath,
  getStatus,
  installChromium,
  cancelInstall,
  isInstalling,
  ensureChromium,
  parseProgressLine,
  explainInstallFailure,
};
