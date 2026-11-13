'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildScenario,
  assertRecordableUrl,
  injectedRecorder,
} = require('./recorder');

test('only http and https URLs can be recorded', () => {
  assert.equal(assertRecordableUrl('https://example.com/login'), 'https://example.com/login');
  assert.equal(assertRecordableUrl('http://127.0.0.1:8080/a'), 'http://127.0.0.1:8080/a');

  assert.throws(() => assertRecordableUrl('file:///C:/Windows/win.ini'), /http и https/);
  assert.throws(() => assertRecordableUrl('javascript:alert(1)'), /http и https/);
  assert.throws(() => assertRecordableUrl('не ссылка'), /Некорректный адрес/);
});

test('recorded steps become a NATL document with a start URL', () => {
  const doc = buildScenario({
    steps: [{ goto: '$base_url' }, { click: '#login' }],
    baseUrl: 'https://example.com',
    name: 'Login',
  });

  assert.deepEqual(doc, {
    name: 'Login',
    engine: 'playwright',
    vars: { base_url: 'https://example.com' },
    steps: [{ goto: '$base_url' }, { click: '#login' }],
  });
});

test('a scenario without a start URL has no vars', () => {
  const doc = buildScenario({ steps: [], baseUrl: '', name: '' });
  assert.equal(doc.name, 'Recorded scenario');
  assert.equal(doc.vars, undefined);
  assert.deepEqual(doc.steps, []);
});

test('the injected recorder is valid JavaScript', () => {
  assert.equal(typeof injectedRecorder, 'function');
  assert.doesNotThrow(() => new Function(`(${injectedRecorder.toString()})`));
});
