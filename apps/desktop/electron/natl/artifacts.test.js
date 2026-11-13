'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { artifactsInfo, cleanArtifacts } = require('./artifacts');

function workspaceWithRuns(count) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'natl-art-'));
  for (let index = 0; index < count; index += 1) {
    const dir = path.join(root, 'artifacts', `run-${index}`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'step-1-before.png'), 'x'.repeat(100));
    fs.writeFileSync(path.join(dir, 'step-1-after.png'), 'x'.repeat(100));
  }
  return root;
}

test('an empty workspace has no artifacts', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'natl-art-'));
  assert.deepEqual(artifactsInfo(root), { runs: 0, files: 0, bytes: 0 });
});

test('info counts runs, files and size', () => {
  const root = workspaceWithRuns(2);
  const info = artifactsInfo(root);
  assert.equal(info.runs, 2);
  assert.equal(info.files, 4);
  assert.equal(info.bytes, 400);
});

test('clean removes everything by default', () => {
  const root = workspaceWithRuns(3);
  const result = cleanArtifacts({ root });

  assert.equal(result.removed, 3);
  assert.equal(result.freedBytes, 600);
  assert.equal(artifactsInfo(root).runs, 0);
});

test('keepLast keeps the newest runs', () => {
  const root = workspaceWithRuns(3);
  const base = path.join(root, 'artifacts');
  // разные mtime, иначе «новее» не определить
  fs.utimesSync(path.join(base, 'run-0'), new Date('2026-01-01'), new Date('2026-01-01'));
  fs.utimesSync(path.join(base, 'run-1'), new Date('2026-01-02'), new Date('2026-01-02'));
  fs.utimesSync(path.join(base, 'run-2'), new Date('2026-01-03'), new Date('2026-01-03'));

  const result = cleanArtifacts({ root, keepLast: 1 });
  assert.equal(result.removed, 2);
  assert.equal(artifactsInfo(root).runs, 1);
  assert.ok(fs.existsSync(path.join(base, 'run-2')));
});

test('cleaning an empty workspace is safe', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'natl-art-'));
  assert.deepEqual(cleanArtifacts({ root }), { removed: 0, freedBytes: 0 });
});
