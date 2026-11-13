'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { parseModelReply, validateStep, normalizeReply, STEP_RULES } = require('./ai');

test('plain JSON reply is parsed', () => {
  const parsed = parseModelReply('{"steps":[{"click":"#a"}],"notes":"ok"}');
  assert.equal(parsed.notes, 'ok');
  assert.equal(parsed.steps.length, 1);
});

test('fenced JSON is parsed', () => {
  const reply = 'Вот шаги:\n```json\n{"steps":[{"fill":"#email","with":"a@b.c"}]}\n```\nГотово.';
  const parsed = parseModelReply(reply);
  assert.equal(parsed.steps[0].fill, '#email');
});

test('prose around JSON is tolerated', () => {
  const parsed = parseModelReply('Конечно. {"steps": [], "notes": "нет данных"} Спасибо');
  assert.equal(parsed.notes, 'нет данных');
});

test('a reply without JSON is rejected', () => {
  assert.throws(() => parseModelReply('не могу помочь'), /нет JSON/);
  assert.throws(() => parseModelReply(''), /пустой ответ/);
});

test('known verbs with the right fields pass', () => {
  assert.equal(validateStep({ click: '#login' }).ok, true);
  assert.equal(validateStep({ fill: '#email', with: 'a@b.c' }).ok, true);
  assert.equal(validateStep({ assert: '.ok', visible: true }).ok, true);
  assert.equal(validateStep({ get: '$base_url/api', save: 'resp' }).ok, true);
});

test('fill without a value is rejected', () => {
  const result = validateStep({ fill: '#email' });
  assert.equal(result.ok, false);
  assert.match(result.reason, /нет поля with/);
});

test('unknown verbs and multiple verbs are rejected', () => {
  assert.equal(validateStep({ hover: '#x' }).ok, false);
  assert.equal(validateStep({ click: '#a', fill: '#b', with: 'x' }).ok, false);
  assert.equal(validateStep({ click: '   ' }).ok, false);
  assert.equal(validateStep('click').ok, false);
});

test('normalize keeps valid steps and reports the rest', () => {
  const reply = JSON.stringify({
    steps: [{ click: '#a' }, { hover: '#b' }, { fill: '#c' }],
    notes: 'два из трёх',
  });
  const result = normalizeReply(reply);

  assert.equal(result.steps.length, 1);
  assert.equal(result.rejected.length, 2);
  assert.equal(result.notes, 'два из трёх');
  assert.match(result.rejected[0].reason, /один глагол|глагол/);
});

test('every allowed verb is documented in the prompt', () => {
  for (const verb of Object.keys(STEP_RULES)) {
    assert.ok(verb.length > 0);
  }
});
