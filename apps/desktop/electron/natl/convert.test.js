'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { convertTest, slugFromTitle } = require('./convert');

const ACTIONS = [
  { id: 'a-click', name: 'click' },
  { id: 'a-fill', name: 'fill' },
  { id: 'a-text', name: 'checkText' },
  { id: 'a-hover', name: 'hover' },
];

const ELEMENTS = [
  { id: 'e-email', pageId: 'p1', selector: '#email' },
  { id: 'e-pass', pageId: 'p1', selector: '#password' },
  { id: 'e-btn', pageId: 'p1', selector: '#login-btn' },
  { id: 'e-welcome', pageId: 'p1', selector: '.welcome' },
];

const PAGES = [{ id: 'p1', title: 'Login', url: 'https://example.com/login' }];

function loginTest() {
  return {
    title: 'Login',
    steps: [
      { actionId: 'a-fill', webElementId: 'e-email', value: 'user@example.com' },
      { actionId: 'a-fill', webElementId: 'e-pass', value: 'secret' },
      { actionId: 'a-click', webElementId: 'e-btn' },
      { actionId: 'a-text', webElementId: 'e-welcome', value: 'Welcome, demo' },
    ],
  };
}

test('login scenario becomes a NATL document', () => {
  const result = convertTest({
    test: loginTest(),
    actions: ACTIONS,
    elements: ELEMENTS,
    pages: PAGES,
  });

  assert.equal(
    result.yaml,
    [
      'name: Login',
      'engine: playwright',
      'vars:',
      '  base_url: https://example.com/login',
      'steps:',
      '  - goto: $base_url',
      '  - fill: "#email"',
      '    with: user@example.com',
      '  - fill: "#password"',
      '    with: secret',
      '  - click: "#login-btn"',
      '  - assert: .welcome',
      '    text: Welcome, demo',
      '',
    ].join('\n'),
  );
  assert.deepEqual(result.unsupported, []);
  assert.equal(result.fileName, 'login.yaml');
});

test('selectors starting with # are quoted, not read as comments', () => {
  const { yaml } = convertTest({
    test: { title: 'Quote', steps: [{ actionId: 'a-click', webElementId: 'e-email' }] },
    actions: ACTIONS,
    elements: ELEMENTS,
    pages: PAGES,
  });
  assert.match(yaml, /- click: "#email"/);
});

test('empty value stays an explicit empty string', () => {
  const { yaml } = convertTest({
    test: {
      title: 'Clear',
      steps: [{ actionId: 'a-fill', webElementId: 'e-email', value: '' }],
    },
    actions: ACTIONS,
    elements: ELEMENTS,
    pages: PAGES,
  });
  assert.match(yaml, /with: ""/);
});

test('unsupported actions are reported, not dropped silently', () => {
  const { yaml, unsupported } = convertTest({
    test: {
      title: 'Hover',
      steps: [
        { actionId: 'a-click', webElementId: 'e-btn' },
        { actionId: 'a-hover', webElementId: 'e-btn' },
      ],
    },
    actions: ACTIONS,
    elements: ELEMENTS,
    pages: PAGES,
  });

  assert.equal(unsupported.length, 1);
  assert.equal(unsupported[0].action, 'hover');
  assert.match(unsupported[0].reason, /наведени/);
  assert.doesNotMatch(yaml, /hover/);
});

test('a step without a resolvable element is reported with its index', () => {
  const { unsupported } = convertTest({
    test: { title: 'Broken', steps: [{ actionId: 'a-click', webElementId: 'missing' }] },
    actions: ACTIONS,
    elements: ELEMENTS,
    pages: PAGES,
  });

  assert.equal(unsupported.length, 1);
  assert.equal(unsupported[0].index, 0);
  assert.equal(unsupported[0].reason, 'у шага нет элемента с селектором');
});

test('shared steps are reported as manual work', () => {
  const { unsupported } = convertTest({
    test: { title: 'Shared', steps: [{ sharedStepId: 's1' }] },
    actions: ACTIONS,
    elements: ELEMENTS,
    pages: PAGES,
  });

  assert.equal(unsupported[0].action, 'shared');
});

test('explicit base URL wins over the first page', () => {
  const { yaml } = convertTest({
    test: loginTest(),
    actions: ACTIONS,
    elements: ELEMENTS,
    pages: PAGES,
    baseUrl: 'https://staging.example.com/login',
  });
  assert.match(yaml, /base_url: https:\/\/staging\.example\.com\/login/);
});

test('file names are slugged for Windows and git', () => {
  assert.equal(slugFromTitle('Login: happy path!'), 'login-happy-path');
  assert.equal(slugFromTitle('   '), 'scenario');
});
