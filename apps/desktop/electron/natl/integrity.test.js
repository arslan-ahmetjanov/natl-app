'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { checkWorkspace } = require('./integrity');

const GOOD = 'name: login\nsteps:\n  - click: "#go"\n';

function tempWorkspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'natl-integrity-'));
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

function problemFor(result, relativePath) {
  return result.problems.find((item) => item.relativePath === relativePath);
}

test('a clean workspace has no problems', () => {
  const root = tempWorkspace();
  write(root, 'tests/login.yaml', GOOD);
  write(root, 'pages/home.yaml', 'elements:\n  go: "#go"\n');

  const result = checkWorkspace(root);

  assert.equal(result.ok, true);
  assert.equal(result.checked, 2);
  assert.deepEqual(result.problems, []);
});

test('an empty file is an error', () => {
  const root = tempWorkspace();
  write(root, 'tests/empty.yaml', '   \n');

  const result = checkWorkspace(root);

  assert.equal(result.ok, false);
  assert.equal(result.checked, 1);
  const problem = problemFor(result, 'tests/empty.yaml');
  assert.equal(problem.level, 'error');
  assert.match(problem.message, /пустой/);
});

test('broken YAML is reported, not thrown', () => {
  const root = tempWorkspace();
  write(root, 'tests/broken.yaml', 'name: [\n');

  const result = checkWorkspace(root);

  assert.equal(result.ok, false);
  assert.match(problemFor(result, 'tests/broken.yaml').message, /YAML не разбирается/);
});

test('a scenario without steps and actions is an error', () => {
  const root = tempWorkspace();
  write(root, 'tests/nothing.yaml', 'name: nothing\n');

  const result = checkWorkspace(root);

  assert.equal(result.ok, false);
  assert.match(problemFor(result, 'tests/nothing.yaml').message, /Нет ни steps, ни actions/);
});

test('a page without steps is fine: page objects live by their own rules', () => {
  const root = tempWorkspace();
  write(root, 'pages/home.yaml', 'elements:\n  go: "#go"\n');

  const result = checkWorkspace(root);

  assert.equal(result.ok, true);
  assert.deepEqual(result.problems, []);
});

test('a missing import is an error', () => {
  const root = tempWorkspace();
  write(root, 'tests/checkout.yaml', `${GOOD}imports:\n  - login\n`);

  const result = checkWorkspace(root);

  assert.equal(result.ok, false);
  assert.match(problemFor(result, 'tests/checkout.yaml').message, /Импорт не найден: login/);
});

test('an import that exists in pages/ is accepted', () => {
  const root = tempWorkspace();
  write(root, 'tests/checkout.yaml', `${GOOD}imports:\n  - login\n`);
  write(root, 'pages/login.yaml', 'elements:\n  go: "#go"\n');

  const result = checkWorkspace(root);

  assert.equal(result.ok, true);
  assert.deepEqual(result.problems, []);
});

test('an import next to the scenario is accepted', () => {
  const root = tempWorkspace();
  write(root, 'tests/checkout.yaml', `${GOOD}imports:\n  - home\n`);

  assert.match(problemFor(checkWorkspace(root), 'tests/checkout.yaml').message, /Импорт не найден/);

  write(root, 'tests/home.yaml', 'name: home\nsteps:\n  - click: "#go"\n');
  assert.deepEqual(checkWorkspace(root).problems, []);
});

test('a .bak is a warning, not an error', () => {
  const root = tempWorkspace();
  write(root, 'tests/login.yaml', GOOD);
  write(root, 'tests/login.yaml.bak', 'name: login\nsteps:\n  - click: "#back"\n');

  const result = checkWorkspace(root);

  assert.equal(result.ok, true);
  const problem = problemFor(result, 'tests/login.yaml');
  assert.equal(problem.level, 'warning');
  assert.match(problem.message, /Есть предыдущая версия/);
});

test('one broken file does not stop the check of the rest', () => {
  const root = tempWorkspace();
  write(root, 'tests/broken.yaml', 'name: [\n');
  write(root, 'tests/empty.yaml', '');
  write(root, 'tests/login.yaml', GOOD);

  const result = checkWorkspace(root);

  assert.equal(result.checked, 3);
  assert.equal(result.problems.length, 2);
  assert.equal(result.ok, false);
});

test('a missing workspace is not a crash', () => {
  assert.deepEqual(checkWorkspace(null), { ok: true, checked: 0, problems: [] });

  const result = checkWorkspace(path.join(os.tmpdir(), 'natl-integrity-does-not-exist'));
  assert.equal(result.checked, 0);
  assert.deepEqual(result.problems, []);
});
