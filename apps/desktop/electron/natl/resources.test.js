'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const resources = require('./resources');

function workspace() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'natl-res-'));
}

test('a fresh workspace has no resources', () => {
  assert.deepEqual(resources.listResources(workspace()), []);
});

test('creating a resource writes YAML with elements and actions', () => {
  const root = workspace();
  const created = resources.createResource(root, 'Login page');

  assert.equal(created.relativePath, 'pages/login-page.yaml');
  assert.ok(fs.existsSync(path.join(root, 'pages', 'login-page.yaml')));

  const text = fs.readFileSync(path.join(root, 'pages', 'login-page.yaml'), 'utf8');
  assert.match(text, /elements:/);
  assert.match(text, /actions:/);
});

test('names do not collide', () => {
  const root = workspace();
  resources.createResource(root, 'Login');
  const second = resources.createResource(root, 'Login');
  assert.equal(second.relativePath, 'pages/login-2.yaml');
});

test('listing returns text and a relative path', () => {
  const root = workspace();
  resources.createResource(root, 'Login');
  const list = resources.listResources(root);

  assert.equal(list.length, 1);
  assert.equal(list[0].relativePath, 'pages/login.yaml');
  assert.match(list[0].text, /elements:/);
});

test('resources outside pages/ are refused', () => {
  const root = workspace();
  assert.throws(() => resources.readResource(root, 'tests/login.yaml'), /только в папке pages/);
  assert.throws(() => resources.readResource(root, '../secret.yaml'), /outside the workspace|pages/);
});

test('non-YAML files are refused', () => {
  const root = workspace();
  resources.createResource(root, 'Login');
  assert.throws(() => resources.writeResource(root, 'pages/notes.md', 'x'), /не YAML/);
});

test('writing updates the file', () => {
  const root = workspace();
  resources.createResource(root, 'Login');
  resources.writeResource(root, 'pages/login.yaml', 'elements: {}\n');
  assert.equal(resources.readResource(root, 'pages/login.yaml').text, 'elements: {}\n');
});
