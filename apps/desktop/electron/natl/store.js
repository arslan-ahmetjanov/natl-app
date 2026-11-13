'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Scenario files on disk.
 *
 * A scenario is a file, not a database row: the user's repository is the only
 * store. Reading is tolerant (broken YAML must not crash the explorer),
 * writing is atomic (a half-written file would look like a broken test).
 */

const SCENARIO_EXTENSIONS = new Set(['.yaml', '.yml']);

function isScenarioFile(filePath) {
  return SCENARIO_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function testsDir(rootPath) {
  return path.join(rootPath, 'tests');
}

/** Recursively collect scenario paths under a directory, sorted by name. */
function listScenarios(dirPath) {
  const found = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      if (entry.name === 'node_modules' || entry.name === 'artifacts') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && isScenarioFile(entry.name)) {
        found.push(full);
      }
    }
  };
  walk(dirPath);
  return found.sort((a, b) => a.localeCompare(b));
}

/** Read a scenario file. Returns `{ path, text, error }` — never throws. */
function readScenario(filePath) {
  try {
    return { path: filePath, text: fs.readFileSync(filePath, 'utf8'), error: null };
  } catch (err) {
    return { path: filePath, text: '', error: err.message };
  }
}

/** Write a scenario atomically: temp file in the same directory, then rename. */
function writeScenario(filePath, text) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(filePath)}.${process.pid}.tmp`);
  const body = text.endsWith('\n') ? text : `${text}\n`;
  try {
    fs.writeFileSync(tmp, body, 'utf8');
    fs.renameSync(tmp, filePath);
  } catch (err) {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* the temp file is already gone */
    }
    throw err;
  }
  return filePath;
}

/** Turn a scenario title into a file name that is safe on Windows and git. */
function scenarioFileName(title, existingNames = []) {
  const base =
    String(title || '')
      .toLowerCase()
      .replace(/[^a-zа-я0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '') || 'scenario';
  const taken = new Set(existingNames.map((name) => name.toLowerCase()));
  let candidate = `${base}.yaml`;
  let counter = 2;
  while (taken.has(candidate.toLowerCase())) {
    candidate = `${base}-${counter}.yaml`;
    counter += 1;
  }
  return candidate;
}

module.exports = {
  SCENARIO_EXTENSIONS,
  isScenarioFile,
  testsDir,
  listScenarios,
  readScenario,
  writeScenario,
  scenarioFileName,
};
