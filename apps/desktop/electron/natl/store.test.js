'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const store = require('./store');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'natl-store-'));
}

test('write then read returns the same text', () => {
  const dir = tempDir();
  const file = path.join(dir, 'tests', 'login.yaml');
  store.writeScenario(file, 'name: Login\n');

  const read = store.readScenario(file);
  assert.equal(read.error, null);
  assert.equal(read.text, 'name: Login\n');
});

test('written file always ends with a newline', () => {
  const dir = tempDir();
  const file = path.join(dir, 'tests', 'a.yaml');
  store.writeScenario(file, 'name: A');
  assert.ok(fs.readFileSync(file, 'utf8').endsWith('\n'));
});

test('writing creates missing directories', () => {
  const dir = tempDir();
  const file = path.join(dir, 'tests', 'deep', 'nested', 'a.yaml');
  store.writeScenario(file, 'name: A\n');
  assert.ok(fs.existsSync(file));
});

test('reading a missing file returns an error instead of throwing', () => {
  const dir = tempDir();
  const read = store.readScenario(path.join(dir, 'nope.yaml'));
  assert.equal(read.text, '');
  assert.ok(read.error);
});

test('listing finds yaml recursively and skips artifacts, node_modules and dotfiles', () => {
  const dir = tempDir();
  store.writeScenario(path.join(dir, 'tests', 'a.yaml'), 'name: A\n');
  store.writeScenario(path.join(dir, 'tests', 'sub', 'b.yml'), 'name: B\n');
  store.writeScenario(path.join(dir, 'tests', 'artifacts', 'c.yaml'), 'name: C\n');
  store.writeScenario(path.join(dir, 'tests', 'node_modules', 'd.yaml'), 'name: D\n');
  store.writeScenario(path.join(dir, 'tests', '.hidden', 'e.yaml'), 'name: E\n');
  fs.writeFileSync(path.join(dir, 'tests', 'notes.txt'), 'not a scenario');

  const names = store
    .listScenarios(path.join(dir, 'tests'))
    .map((file) => path.basename(file));

  assert.deepEqual(names, ['a.yaml', 'b.yml']);
});

test('file names never collide with existing ones', () => {
  assert.equal(store.scenarioFileName('Login'), 'login.yaml');
  assert.equal(store.scenarioFileName('Login', ['login.yaml']), 'login-2.yaml');
  assert.equal(
    store.scenarioFileName('Login', ['login.yaml', 'login-2.yaml']),
    'login-3.yaml',
  );
});

test('file names are safe on Windows', () => {
  assert.equal(store.scenarioFileName('Checkout: cart / payment'), 'checkout-cart-payment.yaml');
  assert.equal(store.scenarioFileName(''), 'scenario.yaml');
});
