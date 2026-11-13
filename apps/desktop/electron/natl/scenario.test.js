'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { nameFromYaml, scenarioSummary } = require('./scenario');

test('the name comes from the YAML document', () => {
  assert.equal(nameFromYaml('name: Login smoke\nengine: playwright\n', 'login.yaml'), 'Login smoke');
  assert.equal(nameFromYaml('  name: "Quoted name"\n', 'x.yaml'), 'Quoted name');
});

test('a scenario without a name falls back to the file name', () => {
  assert.equal(nameFromYaml('engine: playwright\nsteps: []\n', 'login.yaml'), 'login.yaml');
  assert.equal(nameFromYaml('', 'file.yaml'), 'file.yaml');
  assert.equal(nameFromYaml('name: ""\n', 'file.yaml'), 'file.yaml');
});

test('a summary keeps a relative path with forward slashes', () => {
  const root = path.join('C:', 'work', 'project');
  const filePath = path.join(root, 'tests', 'sub', 'login.yaml');

  const summary = scenarioSummary({
    filePath,
    root,
    read: { text: 'name: Login\n', error: null },
    stat: { mtime: new Date('2026-11-13T10:00:00Z'), size: 42 },
  });

  assert.equal(summary.relativePath, 'tests/sub/login.yaml');
  assert.equal(summary.fileName, 'login.yaml');
  assert.equal(summary.name, 'Login');
  assert.equal(summary.size, 42);
  assert.equal(summary.updatedAt, '2026-11-13T10:00:00.000Z');
});

test('a broken file still produces a row', () => {
  const root = path.join('C:', 'work', 'project');
  const summary = scenarioSummary({
    filePath: path.join(root, 'tests', 'bad.yaml'),
    root,
    read: { text: '', error: 'EACCES' },
    stat: null,
  });

  assert.equal(summary.name, 'bad.yaml');
  assert.equal(summary.error, 'EACCES');
  assert.equal(summary.updatedAt, null);
});
