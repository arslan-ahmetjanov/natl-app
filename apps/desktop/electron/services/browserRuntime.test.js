'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  browsersDirFor,
  configureBrowsersPath,
  parseProgressLine,
  explainInstallFailure,
} = require('./browserRuntime');

const ENV_KEY = 'PLAYWRIGHT_BROWSERS_PATH';

/** Сохраняет и восстанавливает переменную окружения вокруг теста. */
function withEnv(value, fn) {
  const saved = process.env[ENV_KEY];
  if (value === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = value;
  try {
    return fn();
  } finally {
    if (saved === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = saved;
  }
}

test('browsers live in the app data folder', () => {
  assert.equal(
    browsersDirFor(path.join('C:', 'Users', 'me', 'AppData', 'Roaming', 'NATL')),
    path.join('C:', 'Users', 'me', 'AppData', 'Roaming', 'NATL', 'browsers'),
  );
});

test('configureBrowsersPath sets the variable when it is absent', () => withEnv(undefined, () => {
  const userData = path.join('C:', 'data', 'NATL');
  const result = configureBrowsersPath(userData);

  assert.equal(result.dir, path.join(userData, 'browsers'));
  assert.equal(result.owned, true);
  assert.equal(process.env[ENV_KEY], path.join(userData, 'browsers'));

  // Повторный вызов ничего не ломает и остаётся нашим.
  const again = configureBrowsersPath(userData);
  assert.equal(again.dir, result.dir);
  assert.equal(again.owned, true);
}));

test('configureBrowsersPath keeps an external folder', () => withEnv(path.join('C:', 'ci', 'pw'), () => {
  const result = configureBrowsersPath(path.join('C:', 'data', 'NATL'));

  assert.equal(result.dir, path.join('C:', 'ci', 'pw'));
  assert.equal(result.owned, false);
  assert.equal(process.env[ENV_KEY], path.join('C:', 'ci', 'pw'));
}));

test('a Downloading line gives the file label', () => {
  const line = 'Downloading Chrome for Testing 145.0.7632.6 (playwright chromium v1208) from https://cdn.example';
  const { state, event } = parseProgressLine(line, {});

  assert.equal(state.label, 'Chrome for Testing 145.0.7632.6 (playwright chromium v1208)');
  assert.equal(event.phase, 'download');
  assert.match(event.label, /Chrome for Testing/);
});

test('a percent line gives percent and total size', () => {
  const line = '|■■■■■■■■        |  40% of 172.8 MiB';
  const { state, event } = parseProgressLine(line, { label: 'Chrome for Testing' });

  assert.equal(event.phase, 'download');
  assert.equal(event.percent, 40);
  assert.equal(event.totalMiB, 172.8);
  assert.equal(event.label, 'Chrome for Testing');
  assert.equal(state.percent, 40);
});

test('a downloaded line means unpacking', () => {
  const line = 'Chrome for Testing 145.0.7632.6 (playwright chromium v1208) downloaded to C:\\cache\\chromium-1208';
  const { event } = parseProgressLine(line, { label: 'Chrome for Testing', percent: 100, totalMiB: 172.8 });

  assert.equal(event.phase, 'unpack');
  assert.equal(event.percent, 100);
});

test('garbage produces no event and keeps the state', () => {
  const input = { label: 'FFmpeg', percent: 10, downloadedMiB: 0.1, totalMiB: 1.3 };
  const { state, event } = parseProgressLine('[1114/034116.578:ERROR:registration_protocol_win.cc(107)] CreateFile', input);

  assert.equal(event, null);
  assert.deepEqual(state, input);
  assert.notEqual(state, input, 'state must be a copy');
});

test('parseProgressLine does not mutate the caller state', () => {
  const input = { label: 'Chrome', percent: 0, downloadedMiB: 0, totalMiB: null };
  parseProgressLine(' 50% of 100 MiB', input);
  assert.deepEqual(input, { label: 'Chrome', percent: 0, downloadedMiB: 0, totalMiB: null });
});

const SAMPLES = [
  ['browser-offline', 'Error: getaddrinfo ENOTFOUND cdn.playwright.dev'],
  ['browser-proxy', 'Proxy connection failed: 407 Proxy Authentication Required'],
  ['browser-tls', 'unable to verify the first certificate: UNABLE_TO_GET_ISSUER_CERT_LOCALLY'],
  ['browser-disk', 'Error: ENOSPC: no space left on device, write'],
  ['browser-permissions', 'Error: EPERM: operation not permitted, open C:\\cache\\chrome.exe'],
  ['browser-unknown', 'child process exited with code 1'],
];

test('install failures get a code and a plain reason', () => {
  for (const [code, output] of SAMPLES) {
    const explanation = explainInstallFailure(output);
    assert.equal(explanation.code, code, `sample: ${output}`);
    assert.ok(explanation.message.length > 0);
    assert.ok(explanation.hint.length > 0);
  }
});

test('network failures mention the internet and the proxy', () => {
  const offline = explainInstallFailure('ETIMEDOUT connecting to cdn.playwright.dev');
  assert.match(offline.message, /интернет/i);
  assert.match(offline.message, /прокси/i);

  const proxy = explainInstallFailure('CONNECT tunnel failed, response 407');
  assert.equal(proxy.code, 'browser-proxy');
  assert.match(proxy.hint, /HTTPS_PROXY/);
});
