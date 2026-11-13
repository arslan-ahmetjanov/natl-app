'use strict';

const path = require('node:path');

/**
 * Scenario files are the product's only store, so listing them must be cheap
 * and fault-tolerant: a broken YAML still gets a row with its file name.
 */

/** The title lives in the YAML; the file name is only a fallback. */
function nameFromYaml(text, fallback) {
  const match = String(text || '').match(/^\s*name:\s*(.+)$/m);
  if (!match) return fallback;
  const value = match[1].trim().replace(/^["']|["']$/g, '');
  return value || fallback;
}

/**
 * @param {object} input
 * @param {string} input.filePath
 * @param {string} input.root
 * @param {{ text: string, error: string|null }} input.read
 * @param {{ mtime: Date, size: number } | null} [input.stat]
 */
function scenarioSummary({ filePath, root, read, stat }) {
  const fileName = path.basename(filePath);
  return {
    relativePath: path.relative(root, filePath).split(path.sep).join('/'),
    fileName,
    name: nameFromYaml(read && read.text, fileName),
    error: (read && read.error) || null,
    updatedAt: stat ? stat.mtime.toISOString() : null,
    size: stat ? stat.size : 0,
  };
}

module.exports = { nameFromYaml, scenarioSummary };
