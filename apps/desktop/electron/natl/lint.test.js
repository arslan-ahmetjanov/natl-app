'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { lintYaml } = require('./lint');

test('a valid scenario passes', () => {
  const result = lintYaml('name: Login\nengine: playwright\nsteps:\n  - goto: https://example.com\n  - click: "#login"\n');
  assert.equal(result.ok, true);
  assert.deepEqual(result.issues, []);
});

test('broken YAML is reported, not thrown', () => {
  const result = lintYaml('name: [unclosed\nsteps:\n');
  assert.equal(result.ok, false);
  assert.match(result.issues[0].message, /YAML не разбирается/);
});

test('an empty document is an error', () => {
  assert.equal(lintYaml('').ok, false);
  assert.equal(lintYaml('   ').ok, false);
});

test('missing name is a warning, not an error', () => {
  const result = lintYaml('steps:\n  - click: "#a"\n');
  assert.equal(result.ok, true);
  assert.equal(result.issues[0].severity, 'warning');
});

test('fill without a value is an error', () => {
  const result = lintYaml('name: A\nsteps:\n  - fill: "#email"\n');
  assert.equal(result.ok, false);
  assert.match(result.issues[0].message, /нет значения with/);
});

test('an unknown verb is a warning with the step number', () => {
  const result = lintYaml('name: A\nsteps:\n  - hover: "#a"\n');
  assert.equal(result.ok, true);
  assert.equal(result.issues[0].severity, 'warning');
  assert.match(result.issues[0].message, /шаг 1/);
  assert.match(result.issues[0].message, /hover/);
});

test('an empty step is an error', () => {
  const result = lintYaml('name: A\nsteps:\n  - {}\n');
  assert.equal(result.ok, false);
  assert.match(result.issues[0].message, /пустой шаг/);
});

test('actions must be lists', () => {
  const result = lintYaml('name: A\nactions:\n  login: "#x"\n');
  assert.equal(result.ok, false);
  assert.match(result.issues[0].message, /список шагов/);
});

test('a scenario with actions and no steps is allowed', () => {
  const result = lintYaml('name: Page\nactions:\n  login:\n    - click: "#a"\n');
  assert.equal(result.ok, true);
});
