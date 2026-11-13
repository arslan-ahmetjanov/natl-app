const fs = require('fs');
const path = require('path');

const BROWSER_FILENAME = 'browser.json';

const DEFAULT_CONFIG = {
  browser: 'custom',
  executablePath: null,
};

function readJsonSafe(filePath, defaultValue = null) {
  try {
    if (!fs.existsSync(filePath)) return defaultValue;
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return defaultValue;
  }
}

function writeJsonAtomic(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmpPath = filePath + '.' + Date.now() + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpPath, filePath);
}

function getConfigPath(userDataPath) {
  return path.join(userDataPath, BROWSER_FILENAME);
}

function normalizeBrowser(value) {
  return 'custom';
}

function getBrowserConfig(userDataPath) {
  const filePath = getConfigPath(userDataPath);
  const raw = readJsonSafe(filePath);
  if (!raw) return { ...DEFAULT_CONFIG };
  return {
    browser: normalizeBrowser(raw.browser),
    executablePath: typeof raw.executablePath === 'string' ? raw.executablePath : null,
  };
}

function saveBrowserConfig(userDataPath, config) {
  const filePath = getConfigPath(userDataPath);
  const merged = getBrowserConfig(userDataPath);
  merged.browser = 'custom';
  if (config && config.executablePath !== undefined) {
    const raw = config.executablePath;
    merged.executablePath =
      raw != null && String(raw).trim() !== '' ? String(raw).trim() : null;
  }
  writeJsonAtomic(filePath, merged);
  return getBrowserConfig(userDataPath);
}

module.exports = {
  getBrowserConfig,
  saveBrowserConfig,
  getConfigPath,
};
