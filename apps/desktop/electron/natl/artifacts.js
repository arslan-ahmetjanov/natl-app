'use strict';

const fs = require('node:fs');
const path = require('node:path');

/**
 * Скриншоты и трассы прогонов.
 *
 * Каждый прогон пишет свой каталог, и без уборки они копятся гигабайтами.
 * Здесь только две операции: посчитать и удалить.
 */

function artifactsRoot(root) {
  return path.join(root, 'artifacts');
}

function dirSize(dir) {
  let files = 0;
  let bytes = 0;

  const walk = (current) => {
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else {
        files += 1;
        try {
          bytes += fs.statSync(full).size;
        } catch {
          /* файл могли удалить во время подсчёта */
        }
      }
    }
  };

  walk(dir);
  return { files, bytes };
}

/** @returns {{ runs: number, files: number, bytes: number }} */
function artifactsInfo(root) {
  const base = artifactsRoot(root);
  if (!fs.existsSync(base)) return { runs: 0, files: 0, bytes: 0 };

  let runs = 0;
  try {
    runs = fs.readdirSync(base).filter((name) => fs.statSync(path.join(base, name)).isDirectory()).length;
  } catch {
    runs = 0;
  }

  const { files, bytes } = dirSize(base);
  return { runs, files, bytes };
}

/**
 * Удаляет каталоги прогонов.
 * @param {object} input
 * @param {string} input.root
 * @param {number} [input.keepLast] сколько последних прогонов оставить
 * @returns {{ removed: number, freedBytes: number }}
 */
function cleanArtifacts({ root, keepLast = 0 }) {
  const base = artifactsRoot(root);
  if (!fs.existsSync(base)) return { removed: 0, freedBytes: 0 };

  const dirs = fs
    .readdirSync(base, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      full: path.join(base, entry.name),
      time: (() => {
        try {
          return fs.statSync(path.join(base, entry.name)).mtimeMs;
        } catch {
          return 0;
        }
      })(),
    }))
    .sort((a, b) => b.time - a.time);

  const targets = dirs.slice(Math.max(0, keepLast));
  let freedBytes = 0;
  for (const target of targets) {
    freedBytes += dirSize(target.full).bytes;
    fs.rmSync(target.full, { recursive: true, force: true });
  }

  return { removed: targets.length, freedBytes };
}

module.exports = { artifactsRoot, artifactsInfo, cleanArtifacts, dirSize };
