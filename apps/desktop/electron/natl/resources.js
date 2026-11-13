'use strict';

const fs = require('node:fs');
const path = require('node:path');

const store = require('./store');
const { assertInsideWorkspace } = require('./run');

/**
 * Переиспользуемые ресурсы: локаторы и запросы.
 *
 * Хранятся как page objects NATL — YAML-файлы в pages/ с полями elements
 * и actions. Сценарий подключает их через imports и вызывает шагом do:.
 * Отдельного формата нет: то же, что читает движок.
 */

const RESOURCES_DIR = 'pages';

function resourcesDir(root) {
  return path.join(root, RESOURCES_DIR);
}

function ensureDir(root) {
  fs.mkdirSync(resourcesDir(root), { recursive: true });
}

function listResources(root) {
  const dir = resourcesDir(root);
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter((name) => store.isScenarioFile(name))
    .sort()
    .map((name) => {
      const filePath = path.join(dir, name);
      const read = store.readScenario(filePath);
      let stat = null;
      try {
        stat = fs.statSync(filePath);
      } catch {
        /* файл мог исчезнуть между чтением и stat */
      }
      return {
        fileName: name,
        relativePath: path.relative(root, filePath).split(path.sep).join('/'),
        text: read.text,
        error: read.error,
        updatedAt: stat ? stat.mtime.toISOString() : null,
      };
    });
}

function resolveResource(root, relativePath) {
  const resolved = assertInsideWorkspace(root, path.join(root, String(relativePath || '')));
  const expectedDir = path.resolve(resourcesDir(root));
  const rel = path.relative(expectedDir, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('Ресурсы живут только в папке pages/');
  }
  if (!store.isScenarioFile(resolved)) throw new Error('Это не YAML-файл');
  return resolved;
}

function readResource(root, relativePath) {
  return store.readScenario(resolveResource(root, relativePath));
}

function writeResource(root, relativePath, text) {
  const resolved = resolveResource(root, relativePath);
  store.writeScenario(resolved, text);
  return { relativePath, savedAt: new Date().toISOString() };
}

function createResource(root, name) {  ensureDir(root);
  const base =
    String(name || 'resource')
      .toLowerCase()
      .replace(/[^a-zа-я0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '') || 'resource';

  const dir = resourcesDir(root);
  const taken = new Set(fs.readdirSync(dir).map((item) => item.toLowerCase()));
  let fileName = `${base}.yaml`;
  let counter = 2;
  while (taken.has(fileName.toLowerCase())) {
    fileName = `${base}-${counter}.yaml`;
    counter += 1;
  }

  const filePath = path.join(dir, fileName);
  const text = [
    `# ${name || 'Ресурсы'}`,
    'locator_strategy: css',
    'elements:',
    '  email: "#email"',
    '',
    'actions:',
    '  login:',
    '    - fill: $email',
    '      with: $login',
    '    - click: "#login-btn"',
    '',
  ].join('\n');

  store.writeScenario(filePath, text);
  return {
    fileName,
    relativePath: path.relative(root, filePath).split(path.sep).join('/'),
    text,
  };
}

function slugName(value, fallback) {
  return (
    String(value || fallback)
      .toLowerCase()
      .replace(/[^a-zа-я0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '') || fallback
  );
}

function renameResource(root, relativePath, newName) {
  const from = resolveResource(root, relativePath);
  const fileName = `${slugName(newName, 'resource')}.yaml`;
  const to = path.join(resourcesDir(root), fileName);

  if (path.resolve(from) === path.resolve(to)) {
    return { relativePath, fileName, unchanged: true };
  }
  if (fs.existsSync(to)) throw new Error(`Файл ${fileName} уже существует`);

  fs.renameSync(from, to);
  return {
    relativePath: path.relative(root, to).split(path.sep).join('/'),
    fileName,
  };
}

function deleteResource(root, relativePath) {
  const target = resolveResource(root, relativePath);
  fs.unlinkSync(target);
  return { deleted: true, relativePath };
}

module.exports = {
  RESOURCES_DIR,
  resourcesDir,
  listResources,
  readResource,
  writeResource,
  createResource,
  resolveResource,
  renameResource,
  deleteResource,
};
