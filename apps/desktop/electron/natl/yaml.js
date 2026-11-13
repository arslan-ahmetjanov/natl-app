'use strict';

/**
 * Minimal YAML emitter for NATL scenarios.
 *
 * Why not a library: the desktop app must stay dependency-light in the main
 * process, and NATL documents are a fixed, small shape (map of scalars,
 * a list of single-verb maps). Everything else stays out.
 *
 * The emitter is strict on purpose: if a value cannot be written as a plain
 * scalar, it gets double quotes, so a selector like `#email` never turns into
 * a comment and `on` never turns into a boolean.
 */

const RESERVED = new Set([
  'true',
  'false',
  'null',
  'yes',
  'no',
  'on',
  'off',
  '~',
]);

const NUMERIC = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

/** True when the string can be written without quotes and read back the same. */
function isPlainSafe(value) {
  if (value === '') return false;
  if (RESERVED.has(value.toLowerCase())) return false;
  if (NUMERIC.test(value)) return false;
  // Leading indicators: # comment, - sequence, ?/: mapping, quotes, anchors…
  if (/^[\s\-?:,[\]{}#&*!|>'"%@`]/.test(value)) return false;
  // `: ` or ` #` anywhere opens a new token in plain scalars
  if (/:\s/.test(value) || /\s#/.test(value)) return false;
  if (/^\s|\s$/.test(value)) return false;
  if (value.includes('\n')) return false;
  return true;
}

/** Render one scalar. Strings that are not plain-safe become quoted. */
function scalar(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError(`cannot serialize non-finite number: ${value}`);
    }
    return String(value);
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  const text = String(value);
  return isPlainSafe(text) ? text : JSON.stringify(text);
}

function indent(level) {
  return '  '.repeat(level);
}

/**
 * Render a map entry `key: value`.
 * Nested maps and lists are rendered on following lines.
 */
function entry(key, value, level) {
  const pad = indent(level);
  if (Array.isArray(value)) {
    if (value.length === 0) return `${pad}${scalar(key)}: []`;
    return [
      `${pad}${scalar(key)}:`,
      ...value.map((item) => listItem(item, level + 1)),
    ].join('\n');
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) return `${pad}${scalar(key)}: {}`;
    return [
      `${pad}${scalar(key)}:`,
      ...keys.map((k) => entry(k, value[k], level + 1)),
    ].join('\n');
  }
  return `${pad}${scalar(key)}: ${scalar(value)}`;
}

/** Render a list item. Maps keep the first key on the dash line for readability. */
function listItem(item, level) {
  const pad = indent(level);
  if (item === null || typeof item !== 'object') {
    return `${pad}- ${scalar(item)}`;
  }
  if (Array.isArray(item)) {
    if (item.length === 0) return `${pad}- []`;
    return [
      `${pad}-`,
      ...item.map((child) => listItem(child, level + 1)),
    ].join('\n');
  }
  const keys = Object.keys(item);
  if (keys.length === 0) return `${pad}- {}`;
  const [first, ...rest] = keys;
  const head = `${pad}- ${scalar(first)}: ${
    item[first] !== null && typeof item[first] === 'object'
      ? ''
      : scalar(item[first])
  }`;
  const body = rest.map((k) => entry(k, item[k], level + 1));
  const firstIsObject =
    item[first] !== null && typeof item[first] === 'object';
  const nested = firstIsObject ? entry(first, item[first], level + 1) : null;

  if (firstIsObject) {
    const nestedLines = nested.split('\n');
    // Replace the empty `key:` line produced above with the nested block.
    return [
      `${pad}-`,
      nestedLines[0].startsWith(indent(level + 1))
        ? nestedLines[0]
        : `${indent(level + 1)}${nestedLines[0].trimStart()}`,
      ...nestedLines.slice(1),
      ...body,
    ].join('\n');
  }
  return [head, ...body].join('\n');
}

/**
 * Serialize a document map. Key order is preserved, so callers decide what
 * a reader sees first (name, engine, steps).
 */
function stringify(doc) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    throw new TypeError('document must be a plain object');
  }
  const lines = Object.keys(doc).map((key) => entry(key, doc[key], 0));
  return `${lines.join('\n')}\n`;
}

module.exports = { stringify, scalar, isPlainSafe };
