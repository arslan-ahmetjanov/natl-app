const path = require('path');
const fs = require('fs');

const MAX_ENTRIES = 10;
const FILENAME = 'last-opened-workspaces.json';

let storePath = null;

function getStorePath() {
  if (storePath) return storePath;
  try {
    const { app } = require('electron');
    const userData = app.getPath('userData');
    storePath = path.join(userData, FILENAME);
    return storePath;
  } catch (e) {
    return path.join(process.cwd(), FILENAME);
  }
}

function readRaw() {
  const filePath = getStorePath();
  try {
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error('lastOpenedWorkspaces read', e);
    return [];
  }
}

function writeRaw(entries) {
  const filePath = getStorePath();
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(entries, null, 2), 'utf8');
  } catch (e) {
    console.error('lastOpenedWorkspaces write', e);
  }
}

/**
 * @returns {string[]} Paths, newest first (most recent at index 0).
 */
function getAll() {
  const entries = readRaw();
  return entries.map((p) => path.resolve(p)).filter((p) => p && typeof p === 'string');
}

/**
 * Add path to the list; move to front; keep at most MAX_ENTRIES.
 * @param {string} workspacePath
 */
function add(workspacePath) {
  if (!workspacePath || typeof workspacePath !== 'string') return;
  const resolved = path.resolve(workspacePath);
  let entries = readRaw().map((p) => path.resolve(p));
  entries = entries.filter((p) => p !== resolved);
  entries.unshift(resolved);
  entries = entries.slice(0, MAX_ENTRIES);
  writeRaw(entries);
}

/**
 * Remove path from the list.
 * @param {string} workspacePath
 */
function remove(workspacePath) {
  if (!workspacePath) return;
  const resolved = path.resolve(workspacePath);
  const entries = readRaw()
    .map((p) => path.resolve(p))
    .filter((p) => p !== resolved);
  writeRaw(entries);
}

/**
 * Return only paths that exist on disk and are valid workspaces.
 * @param { (p: string) => boolean } isWorkspace - e.g. filestore.isWorkspace
 */
function getValid(isWorkspace) {
  const entries = getAll();
  if (!isWorkspace) return entries;
  return entries.filter((p) => {
    try {
      return require('fs').existsSync(p) && isWorkspace(p);
    } catch (_) {
      return false;
    }
  });
}

module.exports = {
  getAll,
  add,
  remove,
  getValid,
  getStorePath,
};
