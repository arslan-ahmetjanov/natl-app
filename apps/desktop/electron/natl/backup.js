'use strict';

const fs = require('node:fs');
const path = require('node:path');

const store = require('./store');
const { assertInsideWorkspace } = require('./run');

/**
 * Предыдущие версии сценариев.
 *
 * Когда `natl:writeScenario` получает YAML, который не разбирается, он кладёт
 * прошлое содержимое файла рядом в `<файл>.bak`: пользователь остаётся с
 * рабочим сценарием и битой правкой, а не с одним битым файлом. Здесь — вторая
 * половина: найти такие бэкапы и вернуть один из них на место.
 *
 * При восстановлении текущая версия не выбрасывается, а уезжает в
 * `<файл>.before-restore`. Поэтому «Восстановить» никогда не теряет данные,
 * даже если нажали не тот файл.
 */

const BACKUP_SUFFIX = '.bak';
const BEFORE_RESTORE_SUFFIX = '.before-restore';
// Бэкап появляется только там, куда пишет приложение: tests/ и pages/.
const SEARCH_DIRS = ['tests', 'pages'];

function backupPathFor(filePath) {
  return `${filePath}${BACKUP_SUFFIX}`;
}

function beforeRestorePathFor(filePath) {
  return `${filePath}${BEFORE_RESTORE_SUFFIX}`;
}

function toRelative(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join('/');
}

function statOrNull(filePath) {
  try {
    return fs.statSync(filePath);
  } catch {
    return null;
  }
}

function sameText(left, right) {
  try {
    return fs.readFileSync(left, 'utf8') === fs.readFileSync(right, 'utf8');
  } catch {
    return false;
  }
}

/**
 * Бэкап, который действительно отличается от файла.
 *
 * Если содержимое совпадает, восстанавливать нечего: так бывает сразу после
 * восстановления. Показывать «есть предыдущая версия» в этот момент — обман.
 *
 * @returns {{ backup: string, stat: fs.Stats|null, mainStat: fs.Stats|null }}
 */
function pendingBackup(filePath) {
  const backup = backupPathFor(filePath);
  const backupStat = statOrNull(backup);
  if (!backupStat) return { backup, stat: null, mainStat: null };

  const mainStat = statOrNull(filePath);
  if (mainStat && mainStat.size === backupStat.size && sameText(filePath, backup)) {
    return { backup, stat: null, mainStat };
  }
  return { backup, stat: backupStat, mainStat };
}

/**
 * Все сценарии и ресурсы рабочей папки, у которых есть отличающийся `.bak`.
 *
 * @param {string} root
 * @returns {Array<{ relativePath: string, backupRelativePath: string, size: number,
 *   mtime: string, mainSize: number|null, mainMtime: string|null }>}
 */
function listBackups(root) {
  if (!root) return [];
  const items = [];

  for (const dirName of SEARCH_DIRS) {
    for (const file of store.listScenarios(path.join(root, dirName))) {
      const pending = pendingBackup(file);
      if (!pending.stat) continue;
      items.push({
        relativePath: toRelative(root, file),
        backupRelativePath: toRelative(root, pending.backup),
        size: pending.stat.size,
        mtime: pending.stat.mtime.toISOString(),
        mainSize: pending.mainStat ? pending.mainStat.size : null,
        mainMtime: pending.mainStat ? pending.mainStat.mtime.toISOString() : null,
      });
    }
  }

  // Свежие бэкапы первыми: обычно чинить нужно последний сбой.
  items.sort((a, b) =>
    a.mtime === b.mtime
      ? a.relativePath.localeCompare(b.relativePath)
      : b.mtime.localeCompare(a.mtime),
  );
  return items;
}

/**
 * Вернуть содержимое `.bak` в файл, а текущую версию сохранить рядом.
 *
 * @param {string} root рабочая папка
 * @param {string} relativePath путь сценария внутри рабочей папки
 * @returns {{ restored: true, relativePath: string, savedTo: string|null, backupRelativePath: string }}
 */
function restoreBackup(root, relativePath) {
  if (!root) throw new Error('Рабочая папка не открыта');

  const resolved = assertInsideWorkspace(root, path.join(root, String(relativePath || '')));
  if (!store.isScenarioFile(resolved)) throw new Error('Это не файл сценария');

  const backup = backupPathFor(resolved);
  if (!fs.existsSync(backup)) {
    throw new Error(`Для файла ${toRelative(root, resolved)} нет предыдущей версии (.bak)`);
  }

  const previous = fs.readFileSync(backup, 'utf8');
  if (!previous.trim()) throw new Error('Предыдущая версия пустая — восстанавливать нечего');

  const savedTo = beforeRestorePathFor(resolved);
  let savedRelative = null;
  if (fs.existsSync(resolved)) {
    fs.copyFileSync(resolved, savedTo);
    savedRelative = toRelative(root, savedTo);
  }

  store.writeScenario(resolved, previous);

  return {
    restored: true,
    relativePath: toRelative(root, resolved),
    savedTo: savedRelative,
    backupRelativePath: toRelative(root, backup),
  };
}

module.exports = {
  BACKUP_SUFFIX,
  BEFORE_RESTORE_SUFFIX,
  backupPathFor,
  beforeRestorePathFor,
  pendingBackup,
  listBackups,
  restoreBackup,
};
