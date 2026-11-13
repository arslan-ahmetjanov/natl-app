import test from 'node:test';
import assert from 'node:assert/strict';

import { humanizeError, humanizeStep } from './errors.js';

test('Playwright timeout becomes an actionable sentence', () => {
  const raw = `FAIL C:/test/tests/a.yaml:17 [playwright] click "#login-button" — locator.click: Timeout 10000ms exceeded. Call log: waiting for locator('#login-button')`;
  const text = humanizeError(raw);
  assert.match(text, /Не удалось нажать на #login-button/);
  assert.match(text, /10 с/);
  assert.doesNotMatch(text, /Call log/);
});

test('IPC wrapper is removed', () => {
  const raw = "Error invoking remote method 'ai:chat': Error: Не настроен ключ LLM. Откройте настройки ИИ.";
  const text = humanizeError(raw);
  assert.equal(text, 'Ключ модели не настроен. Откройте «Настройки» и укажите ключ API.');
});

test('strict mode explains duplicates', () => {
  const text = humanizeError("strict mode violation: locator('#save') resolved to 3 elements");
  assert.match(text, /нашёл несколько элементов/);
});

test('network errors are explained', () => {
  assert.match(humanizeError('net::ERR_NAME_NOT_RESOLVED at https://nope.test'), /Домен не найден/);
  assert.match(humanizeError('connect ECONNREFUSED 127.0.0.1:3000'), /Сервер отказал в соединении/);
});

test('file errors name the file', () => {
  assert.match(humanizeError("ENOENT: no such file or directory, open 'C:/x/tests/a.yaml'"), /Файл не найден/);
  assert.match(humanizeError('EACCES: permission denied'), /Нет доступа/);
});

test('YAML errors are translated', () => {
  assert.match(humanizeError('Missing closing "quote at line 3'), /Незакрытая кавычка/);
});

test('LLM status codes are explained', () => {
  assert.match(humanizeError('LLM 401: {"error":"invalid key"}'), /отклонила ключ/);
  assert.match(humanizeError('LLM 429: too many'), /Слишком много запросов/);
  assert.match(humanizeError('LLM 503: down'), /недоступен/);
});

test('unknown errors are cleaned but kept', () => {
  const text = humanizeError('Что-то странное   случилось\nCall log: много строк');
  assert.equal(text, 'Что-то странное случилось');
});

test('empty input is handled', () => {
  assert.equal(humanizeError(''), 'Неизвестная ошибка');
  assert.equal(humanizeError(null), 'Неизвестная ошибка');
});

test('step errors are humanized without mutating the original', () => {
  const step = { name: 'click', ok: false, error: 'locator.click: Timeout 5000ms exceeded' };
  const next = humanizeStep(step);
  assert.match(next.error, /5 с/);
  assert.match(step.error, /Timeout 5000ms/);
});
