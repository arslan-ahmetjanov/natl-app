'use strict';

const fs = require('node:fs');
const path = require('node:path');

/**
 * One place where the app writes down what happened.
 *
 * Debugging a packaged desktop app is otherwise guesswork: the user sees
 * "something failed", and nobody has the console. Every layer — main process,
 * renderer, recorder, runner, IPC — logs here, the screen shows the tail, and
 * the same lines are appended to a file that survives restarts.
 *
 * The store is deliberately dependency-free so it can be tested without Electron.
 */

const LEVELS = ['debug', 'info', 'warn', 'error', 'fatal'];
const MAX_FILE_BYTES = 5 * 1024 * 1024;

function isLevel(value) {
  return LEVELS.includes(value);
}

class LogStore {
  /**
   * @param {object} [options]
   * @param {number} [options.limit] entries kept in memory
   * @param {string|null} [options.filePath] file to append to
   * @param {() => Date} [options.now]
   */
  constructor(options = {}) {
    this.limit = options.limit ?? 2000;
    this.filePath = options.filePath ?? null;
    this.now = options.now ?? (() => new Date());
    this.entries = [];
    this.nextId = 1;
    this.listeners = new Set();
  }

  add(level, scope, message, details) {
    const entry = {
      id: this.nextId++,
      ts: this.now().toISOString(),
      level: isLevel(level) ? level : 'info',
      scope: scope ? String(scope) : 'app',
      message: message == null ? '' : String(message),
      details: details === undefined ? null : safeDetails(details),
    };

    this.entries.push(entry);
    if (this.entries.length > this.limit) {
      this.entries.splice(0, this.entries.length - this.limit);
    }

    this.writeToFile(entry);
    for (const listener of this.listeners) {
      try {
        listener(entry);
      } catch {
        // A broken listener must not break logging.
      }
    }
    return entry;
  }

  debug(scope, message, details) {
    return this.add('debug', scope, message, details);
  }

  info(scope, message, details) {
    return this.add('info', scope, message, details);
  }

  warn(scope, message, details) {
    return this.add('warn', scope, message, details);
  }

  error(scope, message, details) {
    return this.add('error', scope, message, details);
  }

  fatal(scope, message, details) {
    return this.add('fatal', scope, message, details);
  }

  /** @param {{ level?: string, scope?: string, query?: string, limit?: number, sinceId?: number }} [filter] */
  list(filter = {}) {
    const { level, scope, query, limit = 500, sinceId } = filter;
    const needle = query ? String(query).toLowerCase() : '';
    let result = this.entries;

    if (level && level !== 'all') result = result.filter((entry) => entry.level === level);
    if (scope) result = result.filter((entry) => entry.scope === scope);
    if (sinceId) result = result.filter((entry) => entry.id > sinceId);
    if (needle) {
      result = result.filter((entry) =>
        `${entry.scope} ${entry.message} ${entry.details ? JSON.stringify(entry.details) : ''}`
          .toLowerCase()
          .includes(needle),
      );
    }

    return result.slice(-limit);
  }

  clear() {
    this.entries = [];
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Plain text for "copy all" and for bug reports. */
  toText(filter = {}) {
    return this.list({ ...filter, limit: Number.MAX_SAFE_INTEGER })
      .map((entry) => {
        const details = entry.details ? ` ${JSON.stringify(entry.details)}` : '';
        return `${entry.ts} ${entry.level.toUpperCase()} [${entry.scope}] ${entry.message}${details}`;
      })
      .join('\n');
  }

  writeToFile(entry) {
    if (!this.filePath) return;
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      rotateIfNeeded(this.filePath);
      const details = entry.details ? ` ${JSON.stringify(entry.details)}` : '';
      fs.appendFileSync(
        this.filePath,
        `${entry.ts} ${entry.level.toUpperCase()} [${entry.scope}] ${entry.message}${details}\n`,
        'utf8',
      );
    } catch {
      // Logging must never crash the app.
    }
  }
}

function rotateIfNeeded(filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size < MAX_FILE_BYTES) return;
    const rotated = `${filePath}.1`;
    if (fs.existsSync(rotated)) fs.unlinkSync(rotated);
    fs.renameSync(filePath, rotated);
  } catch {
    // Missing file on first write is the normal case.
  }
}

/** Keep details serializable: anything else becomes a string. */
function safeDetails(details) {
  try {
    JSON.stringify(details);
    return details;
  } catch {
    return String(details);
  }
}

module.exports = { LogStore, LEVELS, MAX_FILE_BYTES, isLevel };
