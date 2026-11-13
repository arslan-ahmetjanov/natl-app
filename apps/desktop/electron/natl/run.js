'use strict';

const fs = require('node:fs');
const path = require('node:path');

/**
 * Run a NATL scenario file from the desktop app.
 *
 * The engine is `@natl/core` — the same code the CLI uses — so the app and CI
 * cannot drift. Core is ESM and the Electron main process is CommonJS, so it is
 * loaded with a dynamic import at call time.
 *
 * Per-step screenshots are not a core feature. They are produced here by
 * wrapping the engine adapter: before and after every action the app takes a
 * frame. No core changes, and the wrapper is the only place that knows about
 * screenshots at all.
 */

const ACTION_METHODS = [
  'goto',
  'click',
  'fill',
  'select',
  'check',
  'uncheck',
  'wait',
  'waitMs',
  'scroll',
  'swipe',
  'longPress',
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/** A new artifacts directory per run, so nothing from the previous run leaks in. */
function createArtifactsDir(root) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.join(root, 'artifacts', 'natl', stamp);
  ensureDir(dir);
  return dir;
}

/** Reject any path outside the workspace: the app must never read or write there. */
function assertInsideWorkspace(root, target) {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(target);
  const relative = path.relative(resolvedRoot, resolved);
  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
    return resolved;
  }
  throw new Error('Path is outside the workspace');
}

/**
 * Wrap an adapter so every action leaves a before/after frame on disk.
 * The result and errors of the wrapped call are passed through untouched.
 */
function wrapWithScreenshots(adapter, { dir, state }) {
  const wrapped = Object.create(adapter);

  for (const method of ACTION_METHODS) {
    const original = adapter[method];
    if (typeof original !== 'function') continue;

    wrapped[method] = async (...args) => {
      state.count += 1;
      const index = state.count;
      const before = path.join(dir, `step-${index}-before.png`);
      const after = path.join(dir, `step-${index}-after.png`);

      try {
        await adapter.screenshot(before);
      } catch {
        // A screenshot must never fail the step it documents.
      }

      try {
        return await original.apply(adapter, args);
      } finally {
        try {
          await adapter.screenshot(after);
        } catch {
          /* see above */
        }
        state.shots.push({ index, action: method, before, after });
      }
    };
  }

  return wrapped;
}

/**
 * @param {object} input
 * @param {string} input.root   Workspace root
 * @param {string} input.file   Scenario path (inside the workspace)
 * @param {boolean} [input.headless]
 * @param {function} [input.onProgress] Called with step events
 * @returns {Promise<object>} RunResult plus artifactsDir and screenshots
 */
async function runScenario(input) {
  const { root, file, headless = true, onProgress = () => {} } = input || {};
  if (!root) throw new Error('runScenario: root is required');
  if (!file) throw new Error('runScenario: file is required');

  const scenarioPath = assertInsideWorkspace(root, file);
  const { runNatlFile } = await import('@natl/core');
  const { createAdapter } = await import('@natl/adapter-playwright');

  const artifactsDir = createArtifactsDir(root);
  const state = { count: 0, shots: [] };
  const relativeArtifacts = path
    .relative(path.dirname(scenarioPath), artifactsDir)
    .split(path.sep)
    .join('/');

  const result = await runNatlFile({
    file: scenarioPath,
    headless,
    artifactsDir: relativeArtifacts,
    adapters: {
      playwright: async (options) =>
        wrapWithScreenshots(await createAdapter(options), { dir: artifactsDir, state }),
    },
    reporter: {
      stepStart: (info) => onProgress({ type: 'step-start', name: info.name }),
      stepEnd: (info) => onProgress({ type: 'step-end', name: info.name, ok: info.ok, error: info.error }),
    },
  });

  return { ...result, artifactsDir, screenshots: state.shots };
}

module.exports = {
  ACTION_METHODS,
  createArtifactsDir,
  assertInsideWorkspace,
  wrapWithScreenshots,
  runScenario,
};
