'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { saveScenario, collectElements } = require('./save');

const ACTIONS = [
  { id: 'a-click', name: 'click' },
  { id: 'a-hover', name: 'hover' },
];

function workspace() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'natl-save-'));
}

function pagesFixture() {
  return [
    {
      id: 'p1',
      url: 'https://example.com/login',
      webElements: [
        { id: 'e-btn', title: 'Login button', selector: '#login-btn' },
      ],
    },
  ];
}

test('writes a YAML file under tests/ and reports the relative path', () => {
  const root = workspace();
  const result = saveScenario({
    root,
    test: {
      title: 'Login',
      steps: [{ actionId: 'a-click', webElementId: 'e-btn' }],
    },
    actions: ACTIONS,
    pages: pagesFixture(),
  });

  assert.equal(result.relativePath, 'tests/login.yaml');
  assert.equal(result.fileName, 'login.yaml');
  assert.equal(result.overwritten, false);
  assert.ok(fs.existsSync(path.join(root, 'tests', 'login.yaml')));

  const text = fs.readFileSync(result.filePath, 'utf8');
  assert.match(text, /^name: Login$/m);
  assert.match(text, /- goto: \$base_url/);
  assert.match(text, /- click: "#login-btn"/);
});

test('second scenario with the same title does not overwrite the first', () => {
  const root = workspace();
  const args = {
    root,
    test: { title: 'Login', steps: [] },
    actions: ACTIONS,
    pages: pagesFixture(),
  };

  const first = saveScenario(args);
  const second = saveScenario(args);

  assert.equal(first.fileName, 'login.yaml');
  assert.equal(second.fileName, 'login-2.yaml');
  assert.ok(fs.existsSync(path.join(root, 'tests', 'login.yaml')));
  assert.ok(fs.existsSync(path.join(root, 'tests', 'login-2.yaml')));
});

test('overwrite rewrites the same file on purpose', () => {
  const root = workspace();
  const args = {
    root,
    test: { title: 'Login', steps: [] },
    actions: ACTIONS,
    pages: pagesFixture(),
  };

  saveScenario(args);
  const again = saveScenario({ ...args, overwrite: true });

  assert.equal(again.fileName, 'login.yaml');
  assert.equal(again.overwritten, true);
  assert.deepEqual(
    fs.readdirSync(path.join(root, 'tests')),
    ['login.yaml'],
  );
});

test('unsupported steps are reported to the caller, file still saved', () => {
  const root = workspace();
  const result = saveScenario({
    root,
    test: {
      title: 'Hover',
      steps: [
        { actionId: 'a-click', webElementId: 'e-btn' },
        { actionId: 'a-hover', webElementId: 'e-btn' },
      ],
    },
    actions: ACTIONS,
    pages: pagesFixture(),
  });

  assert.equal(result.unsupported.length, 1);
  assert.equal(result.unsupported[0].action, 'hover');
  assert.ok(fs.existsSync(result.filePath));
});

test('explicit file name is sanitized', () => {
  const root = workspace();
  const result = saveScenario({
    root,
    test: { title: 'Whatever', steps: [] },
    actions: ACTIONS,
    pages: pagesFixture(),
    fileName: 'Checkout: cart / payment',
  });

  assert.equal(result.fileName, 'checkout-cart-payment.yaml');
});

test('elements are flattened from pages and keep their page id', () => {
  const elements = collectElements(pagesFixture());
  assert.equal(elements.length, 1);
  assert.equal(elements[0].pageId, 'p1');
  assert.equal(elements[0].selector, '#login-btn');
});

test('a test without a start URL produces no goto and no vars', () => {
  const root = workspace();
  saveScenario({
    root,
    test: { title: 'Bare', steps: [] },
    actions: ACTIONS,
    pages: [],
  });

  const text = fs.readFileSync(path.join(root, 'tests', 'bare.yaml'), 'utf8');
  assert.doesNotMatch(text, /goto/);
  assert.doesNotMatch(text, /base_url/);
});
