'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  createArtifactsDir,
  assertInsideWorkspace,
  wrapWithScreenshots,
} = require('./run');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'natl-run-'));
}

test('paths inside the workspace are allowed', () => {
  const root = tempDir();
  assert.equal(
    assertInsideWorkspace(root, path.join(root, 'tests', 'login.yaml')),
    path.resolve(root, 'tests', 'login.yaml'),
  );
});

test('paths outside the workspace are rejected', () => {
  const root = tempDir();
  assert.throws(
    () => assertInsideWorkspace(root, path.join(root, '..', 'secrets.txt')),
    /outside the workspace/,
  );
  assert.throws(() => assertInsideWorkspace(root, 'C:/Windows/win.ini'), /outside the workspace/);
});

test('each run gets its own artifacts directory', () => {
  const root = tempDir();
  const first = createArtifactsDir(root);
  const second = createArtifactsDir(root);

  assert.ok(fs.existsSync(first));
  assert.ok(fs.existsSync(second));
  assert.notEqual(first, second);
  assert.ok(first.startsWith(path.join(root, 'artifacts', 'natl')));
});

function fakeAdapter() {
  const calls = [];
  return {
    calls,
    async screenshot(file) {
      calls.push(['screenshot', path.basename(file)]);
      fs.writeFileSync(file, 'png');
    },
    async click(...args) {
      calls.push(['click', ...args]);
      return 'clicked';
    },
    async waitMs(ms) {
      calls.push(['waitMs', ms]);
      return undefined;
    },
  };
}

test('wrapped actions keep their return value and take two frames', async () => {
  const dir = tempDir();
  const state = { count: 0, shots: [] };
  const base = fakeAdapter();
  const wrapped = wrapWithScreenshots(base, { dir, state });

  const result = await wrapped.click('#login-btn');

  assert.equal(result, 'clicked');
  assert.equal(state.count, 1);
  assert.equal(state.shots.length, 1);
  assert.equal(state.shots[0].action, 'click');
  assert.deepEqual(
    base.calls.map(([kind, name]) => [kind, name]),
    [
      ['screenshot', 'step-1-before.png'],
      ['click', '#login-btn'],
      ['screenshot', 'step-1-after.png'],
    ],
  );
  assert.ok(fs.existsSync(path.join(dir, 'step-1-before.png')));
  assert.ok(fs.existsSync(path.join(dir, 'step-1-after.png')));
});

test('a failing action still leaves the after frame', async () => {
  const dir = tempDir();
  const state = { count: 0, shots: [] };
  const base = fakeAdapter();
  base.click = async () => {
    throw new Error('element not found');
  };
  const wrapped = wrapWithScreenshots(base, { dir, state });

  await assert.rejects(() => wrapped.click('#missing'), /element not found/);
  assert.equal(state.shots.length, 1);
  assert.ok(fs.existsSync(path.join(dir, 'step-1-after.png')));
});

test('a broken screenshot does not break the step', async () => {
  const dir = tempDir();
  const state = { count: 0, shots: [] };
  const base = fakeAdapter();
  base.screenshot = async () => {
    throw new Error('page is closed');
  };
  const wrapped = wrapWithScreenshots(base, { dir, state });

  const result = await wrapped.waitMs(10);
  assert.equal(result, undefined);
  assert.equal(state.shots.length, 1);
});

test('methods that are not actions are not wrapped', () => {
  const dir = tempDir();
  const state = { count: 0, shots: [] };
  const base = fakeAdapter();
  const wrapped = wrapWithScreenshots(base, { dir, state });
  assert.equal(wrapped.screenshot, base.screenshot);
  assert.equal(state.count, 0);
});
