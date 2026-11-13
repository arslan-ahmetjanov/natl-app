'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  backupPathFor,
  beforeRestorePathFor,
  listBackups,
  restoreBackup,
} = require('./backup');

const SCENARIO = 'tests/login.yaml';
const GOOD = 'name: login\nsteps:\n  - click: "#go"\n';
const BROKEN = 'name: login\nsteps: [\n';

function tempWorkspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'natl-backup-'));
  fs.mkdirSync(path.join(root, 'tests'), { recursive: true });
  fs.mkdirSync(path.join(root, 'pages'), { recursive: true });
  return root;
}

function write(root, relativePath, text) {
  const file = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, 'utf8');
  return file;
}

test('backup paths sit next to the file', () => {
  const file = path.join('ws', 'tests', 'login.yaml');
  assert.equal(backupPathFor(file), `${file}.bak`);
  assert.equal(beforeRestorePathFor(file), `${file}.before-restore`);
});

test('listBackups finds scenarios and pages that have a .bak', () => {
  const root = tempWorkspace();
  write(root, SCENARIO, GOOD);
  write(root, `${SCENARIO}.bak`, BROKEN);
  write(root, 'tests/plain.yaml', GOOD);
  write(root, 'pages/home.yaml', 'elements:\n  go: "#go"\n');
  write(root, 'pages/home.yaml.bak', 'elements:\n  go: "#go"\n  back: "#back"\n');

  const items = listBackups(root);
  assert.deepEqual(
    items.map((item) => item.relativePath).sort(),
    ['pages/home.yaml', 'tests/login.yaml'],
  );

  const login = items.find((item) => item.relativePath === SCENARIO);
  assert.equal(login.backupRelativePath, `${SCENARIO}.bak`);
  assert.equal(login.size, fs.statSync(path.join(root, `${SCENARIO}.bak`)).size);
  assert.equal(login.mainSize, fs.statSync(path.join(root, SCENARIO)).size);
  assert.match(login.mtime, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(login.mainMtime, /^\d{4}-\d{2}-\d{2}T/);
});

test('an empty workspace has no backups', () => {
  assert.deepEqual(listBackups(tempWorkspace()), []);
  assert.deepEqual(listBackups(null), []);
});

test('a .bak identical to the file is not a previous version', () => {
  const root = tempWorkspace();
  write(root, SCENARIO, GOOD);
  write(root, `${SCENARIO}.bak`, GOOD);
  assert.deepEqual(listBackups(root), []);
});

test('restore puts the previous version back and keeps the current one', () => {
  const root = tempWorkspace();
  write(root, SCENARIO, BROKEN);
  write(root, `${SCENARIO}.bak`, GOOD);

  const result = restoreBackup(root, SCENARIO);

  assert.equal(result.restored, true);
  assert.equal(result.relativePath, SCENARIO);
  assert.equal(result.savedTo, `${SCENARIO}.before-restore`);
  assert.equal(result.backupRelativePath, `${SCENARIO}.bak`);
  assert.equal(fs.readFileSync(path.join(root, SCENARIO), 'utf8'), GOOD);
  assert.equal(fs.readFileSync(path.join(root, `${SCENARIO}.before-restore`), 'utf8'), BROKEN);
});

test('a second restore overwrites the previous .before-restore', () => {
  const root = tempWorkspace();
  write(root, SCENARIO, BROKEN);
  write(root, `${SCENARIO}.bak`, GOOD);

  restoreBackup(root, SCENARIO);
  write(root, SCENARIO, 'name: second\nsteps: [\n');
  const result = restoreBackup(root, SCENARIO);

  assert.equal(result.savedTo, `${SCENARIO}.before-restore`);
  assert.equal(
    fs.readFileSync(path.join(root, `${SCENARIO}.before-restore`), 'utf8'),
    'name: second\nsteps: [\n',
  );
});

test('restoring a file that does not exist yet restores it from the .bak', () => {
  const root = tempWorkspace();
  write(root, `${SCENARIO}.bak`, GOOD);

  const result = restoreBackup(root, SCENARIO);

  assert.equal(result.savedTo, null);
  assert.equal(fs.readFileSync(path.join(root, SCENARIO), 'utf8'), GOOD);
});

test('restoring without a .bak fails with a readable message', () => {
  const root = tempWorkspace();
  write(root, SCENARIO, GOOD);
  assert.throws(() => restoreBackup(root, SCENARIO), /нет предыдущей версии/);
});

test('an empty .bak is refused instead of wiping the file', () => {
  const root = tempWorkspace();
  write(root, SCENARIO, GOOD);
  write(root, `${SCENARIO}.bak`, '   \n');

  assert.throws(() => restoreBackup(root, SCENARIO), /пустая/);
  assert.equal(fs.readFileSync(path.join(root, SCENARIO), 'utf8'), GOOD);
});

test('a path outside the workspace is refused', () => {
  const root = tempWorkspace();
  const outside = path.join(path.dirname(root), `natl-outside-${process.pid}.yaml`);
  fs.writeFileSync(outside, GOOD, 'utf8');
  fs.writeFileSync(`${outside}.bak`, GOOD, 'utf8');

  try {
    assert.throws(
      () => restoreBackup(root, `../${path.basename(outside)}`),
      /outside the workspace/,
    );
  } finally {
    fs.rmSync(outside, { force: true });
    fs.rmSync(`${outside}.bak`, { force: true });
  }
});
