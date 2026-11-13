'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('yaml');

const store = require('./store');
const { pendingBackup, backupPathFor } = require('./backup');

/**
 * Проверка файлов при открытии рабочей папки.
 *
 * Папку мог править кто угодно: другой редактор, git merge, ИИ-агент, обрыв
 * записи. Приложение всё равно должно открыться, поэтому проверка никогда не
 * бросает: битый файл — это строка в списке, а не падение.
 *
 * Здесь только чтение и разбор YAML. Браузер не запускается, ничего не пишется.
 */

const SCENARIO_DIRS = ['tests', 'pages'];
// Список в диалоге не должен превращаться в километровую простыню.
const MAX_PROBLEMS = 200;

function toRelative(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join('/');
}

function messageOf(err) {
  return err && err.message ? err.message : String(err);
}

/**
 * Куда может указывать запись `imports`.
 *
 * Порядок кандидатов повторяет движок (`resolveImportPath` в `@natl/core`):
 * сначала рядом с файлом, потом `pages/` рядом и на уровень выше. Выдумывать
 * свои правила нельзя — проверка должна совпадать с прогоном.
 */
function importCandidates(fileDir, importPath) {
  return [
    path.resolve(fileDir, importPath),
    path.resolve(fileDir, `${importPath}.yaml`),
    path.resolve(fileDir, `${importPath}.yml`),
    path.resolve(fileDir, 'pages', `${importPath}.yaml`),
    path.resolve(fileDir, 'pages', `${importPath}.yml`),
    path.resolve(fileDir, '..', 'pages', `${importPath}.yaml`),
    path.resolve(fileDir, '..', 'pages', `${importPath}.yml`),
  ];
}

function importExists(fileDir, importPath) {
  return importCandidates(fileDir, importPath).some((candidate) => fs.existsSync(candidate));
}

/**
 * @param {string} root
 * @param {string} file
 * @param {boolean} isScenario файл из tests/, а не ресурс из pages/
 * @returns {Array<{ relativePath: string, level: 'error'|'warning', message: string }>}
 */
function checkFile(root, file, isScenario) {
  const relativePath = toRelative(root, file);
  const problems = [];
  const push = (level, message) => problems.push({ relativePath, level, message });

  const read = store.readScenario(file);
  if (read.error) {
    push('error', `Файл не читается: ${read.error}`);
  } else if (!read.text.trim()) {
    push('error', 'Файл пустой — сценария в нём нет');
  } else {
    let doc;
    try {
      doc = parse(read.text);
    } catch (err) {
      // Хвост ошибки парсера занимает пол-диалога — оставляем первую строку.
      push('error', `YAML не разбирается: ${messageOf(err).split('\n')[0]}`);
      doc = undefined;
    }

    if (doc !== undefined) {
      if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
        push('error', 'Ожидался объект с полями сценария');
      } else {
        // Правило из lint.js: сценарий без steps допустим только с actions.
        if (isScenario && !doc.steps && !doc.actions) {
          push('error', 'Нет ни steps, ни actions');
        }

        for (const item of Array.isArray(doc.imports) ? doc.imports : []) {
          if (typeof item !== 'string' || !item.trim()) {
            push('warning', 'Пустая ссылка в imports');
            continue;
          }
          if (!importExists(path.dirname(file), item.trim())) {
            push('error', `Импорт не найден: ${item}`);
          }
        }
      }
    }
  }

  // Бэкап — не ошибка: подсказка, что прошлую версию можно вернуть.
  if (pendingBackup(file).stat) {
    push('warning', `Есть предыдущая версия: ${path.basename(backupPathFor(file))}`);
  }

  return problems;
}

/**
 * @param {string} root рабочая папка
 * @returns {{ ok: boolean, checked: number, problems: Array<{ relativePath: string, level: string, message: string }> }}
 */
function checkWorkspace(root) {
  const problems = [];
  let checked = 0;

  if (!root) return { ok: true, checked, problems };

  try {
    for (const dirName of SCENARIO_DIRS) {
      const isScenario = dirName === 'tests';
      for (const file of store.listScenarios(path.join(root, dirName))) {
        checked += 1;
        try {
          problems.push(...checkFile(root, file, isScenario));
        } catch (err) {
          problems.push({
            relativePath: toRelative(root, file),
            level: 'error',
            message: `Файл не проверен: ${messageOf(err)}`,
          });
        }
      }
    }
  } catch (err) {
    problems.push({
      relativePath: '.',
      level: 'error',
      message: `Не удалось прочитать рабочую папку: ${messageOf(err)}`,
    });
  }

  return {
    ok: problems.every((item) => item.level !== 'error'),
    checked,
    problems: problems.slice(0, MAX_PROBLEMS),
  };
}

module.exports = { MAX_PROBLEMS, importCandidates, importExists, checkWorkspace };
