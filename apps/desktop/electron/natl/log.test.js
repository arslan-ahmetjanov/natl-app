'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { LogStore, LEVELS } = require('./log');

function tempFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'natl-log-'));
  return path.join(dir, 'logs', 'natl.log');
}

test('entries keep level, scope and a stable id', () => {
  const store = new LogStore();
  const first = store.info('app', 'started');
  const second = store.error('runner', 'boom', { code: 1 });

  assert.equal(first.id, 1);
  assert.equal(second.id, 2);
  assert.equal(second.level, 'error');
  assert.deepEqual(second.details, { code: 1 });
  assert.equal(store.entries.length, 2);
});

test('unknown levels fall back to info instead of breaking', () => {
  const store = new LogStore();
  const entry = store.add('whatever', 'app', 'message');
  assert.equal(entry.level, 'info');
  assert.deepEqual(LEVELS, ['debug', 'info', 'warn', 'error', 'fatal']);
});

test('the ring buffer drops the oldest entries', () => {
  const store = new LogStore({ limit: 3 });
  for (let index = 0; index < 5; index += 1) store.info('app', `entry ${index}`);

  assert.equal(store.entries.length, 3);
  assert.equal(store.entries[0].message, 'entry 2');
  assert.equal(store.entries[2].message, 'entry 4');
});

test('list filters by level, scope and text', () => {
  const store = new LogStore();
  store.info('recorder', 'started recording');
  store.error('runner', 'step failed', { step: 'click' });

  assert.equal(store.list({ level: 'error' }).length, 1);
  assert.equal(store.list({ scope: 'recorder' }).length, 1);
  assert.equal(store.list({ query: 'click' }).length, 1);
  assert.equal(store.list({ query: 'CLICK' }).length, 1);
  assert.equal(store.list({ level: 'all' }).length, 2);
});

test('sinceId returns only new entries, for live tailing', () => {
  const store = new LogStore();
  store.info('app', 'one');
  store.info('app', 'two');
  store.info('app', 'three');
  const fresh = store.list({ sinceId: 2 });
  assert.deepEqual(fresh.map((entry) => entry.message), ['three']);
});

test('subscribers get entries and can unsubscribe', () => {
  const store = new LogStore();
  const seen = [];
  const unsubscribe = store.subscribe((entry) => seen.push(entry.message));
  store.info('app', 'first');
  unsubscribe();
  store.info('app', 'second');

  assert.deepEqual(seen, ['first']);
});

test('a broken subscriber does not break logging', () => {
  const store = new LogStore();
  store.subscribe(() => {
    throw new Error('listener is broken');
  });
  assert.doesNotThrow(() => store.info('app', 'still works'));
  assert.equal(store.entries.length, 1);
});

test('entries are appended to the file in a readable form', () => {
  const filePath = tempFile();
  const store = new LogStore({ filePath });
  store.error('recorder', 'selector missing', { selector: '#login' });

  const text = fs.readFileSync(filePath, 'utf8');
  assert.match(text, / ERROR \[recorder\] selector missing \{"selector":"#login"\}/);
});

test('a broken file path never crashes logging', () => {
  const store = new LogStore({ filePath: path.join('\0', 'bad', 'natl.log') });
  assert.doesNotThrow(() => store.info('app', 'message'));
  assert.equal(store.entries.length, 1);
});

test('toText produces one line per entry', () => {
  const store = new LogStore();
  store.info('app', 'one');
  store.error('runner', 'two', { code: 1 });
  const lines = store.toText().split('\n');
  assert.equal(lines.length, 2);
  assert.match(lines[1], /ERROR \[runner\] two/);
});
