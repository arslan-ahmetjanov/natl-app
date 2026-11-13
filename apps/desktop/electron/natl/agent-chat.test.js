'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { executeTool, TOOLS, MAX_TURNS } = require('./agent-chat');

function workspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'natl-agent-'));
  fs.mkdirSync(path.join(root, 'tests'), { recursive: true });
  fs.writeFileSync(path.join(root, 'tests', 'login.yaml'), 'name: Login\nsteps: []\n');
  return root;
}

test('list_scenarios returns workspace-relative paths', async () => {
  const root = workspace();
  const result = await executeTool({ name: 'list_scenarios', args: {}, root });
  assert.equal(result.ok, true);
  assert.deepEqual(result.result, ['tests/login.yaml']);
});

test('read_scenario returns the file text', async () => {
  const root = workspace();
  const result = await executeTool({ name: 'read_scenario', args: { relativePath: 'tests/login.yaml' }, root });
  assert.equal(result.ok, true);
  assert.match(result.result, /name: Login/);
});

test('write_scenario writes only inside tests', async () => {
  const root = workspace();
  const result = await executeTool({
    name: 'write_scenario',
    args: { relativePath: 'tests/new.yaml', yaml: 'name: New\nsteps: []\n' },
    root,
  });
  assert.equal(result.ok, true);
  assert.ok(fs.existsSync(path.join(root, 'tests', 'new.yaml')));
});

test('a path outside the workspace is refused', async () => {
  const root = workspace();
  const result = await executeTool({
    name: 'read_scenario',
    args: { relativePath: '../secrets.txt' },
    root,
  });
  assert.equal(result.ok, false);
  assert.match(result.error, /outside the workspace/);
});

test('writing a non-scenario extension is refused', async () => {
  const root = workspace();
  const result = await executeTool({
    name: 'write_scenario',
    args: { relativePath: 'tests/notes.md', yaml: 'x' },
    root,
  });
  assert.equal(result.ok, false);
  assert.match(result.error, /не файл сценария/);
});

test('an unknown tool is reported, not silently ignored', async () => {
  const root = workspace();
  const result = await executeTool({ name: 'delete_everything', args: {}, root });
  assert.equal(result.ok, false);
  assert.match(result.error, /неизвестный инструмент/);
});

test('the tool list has unique names and a bounded loop', () => {
  const names = TOOLS.map((tool) => tool.function.name);
  assert.equal(new Set(names).size, names.length);
  assert.ok(names.includes('run_scenario'));
  assert.ok(MAX_TURNS >= 1 && MAX_TURNS <= 10);
});
