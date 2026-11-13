'use strict';

const { stringify } = require('./yaml');

/**
 * Convert a TestBlox scenario (JSON model) into a NATL YAML document.
 *
 * The app keeps its editor model: steps point at actions and elements by id.
 * NATL knows nothing about ids, so the converter is the only place where the
 * two models meet. Everything it cannot express is reported back instead of
 * being silently dropped — a recorder that loses steps without saying so is
 * worse than no recorder.
 */

/** TestBlox action name -> NATL step builder. */
const VERBS = {
  click: (step, selector) => ({ click: selector }),
  fill: (step, selector) => ({ fill: selector, with: text(step.value) }),
  clearInput: (step, selector) => ({ fill: selector, with: '' }),
  selectOption: (step, selector) => ({ select: selector, with: text(step.value) }),
  checkText: (step, selector) =>
    text(step.value) === ''
      ? { assert: selector, visible: true }
      : { assert: selector, text: text(step.value) },
  checkVisibility: (step, selector) => ({ assert: selector, visible: true }),
  waitForElement: (step, selector) => ({ wait: selector, state: 'visible' }),
  takeScreenshot: (step) => ({ screenshot: text(step.value) || 'screenshot.png' }),
};

/** Actions that exist in the old editor but have no NATL verb yet. */
const UNSUPPORTED = {
  hover: 'в NATL нет наведения курсора',
  doubleClick: 'двойной клик пока не выражается одним шагом',
  rightClick: 'правый клик пока не выражается одним шагом',
  goBack: 'навигация назад не входит в язык',
  goForward: 'навигация вперёд не входит в язык',
  pressKey: 'нажатия клавиш пока не выражаются шагом',
  focus: 'фокус без действия не выражается',
  blur: 'снятие фокуса не выражается',
};

function text(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function indexById(items) {
  const map = new Map();
  for (const item of items || []) {
    if (item && item.id) map.set(item.id, item);
  }
  return map;
}

function slugFromTitle(title) {
  const base = text(title)
    .toLowerCase()
    .replace(/[^a-zа-я0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'scenario';
}

/**
 * @param {object} input
 * @param {object} input.test      TestBlox test: { title, steps: [] }
 * @param {Array}  [input.actions] Actions catalog: [{ id, name }]
 * @param {Array}  [input.elements] Elements: [{ id, pageId, selector, title }]
 * @param {Array}  [input.pages]   Pages: [{ id, url, title }]
 * @param {string} [input.baseUrl] Explicit start URL, wins over the first page
 * @returns {{ yaml: string, doc: object, fileName: string, unsupported: Array }}
 */
function convertTest(input) {
  const { test, actions, elements, pages, baseUrl } = input || {};
  if (!test || typeof test !== 'object') {
    throw new TypeError('convertTest: test is required');
  }
  const steps = Array.isArray(test.steps) ? test.steps : [];
  const actionsById = indexById(actions);
  const elementsById = indexById(elements);
  const pagesById = indexById(pages);

  const unsupported = [];
  const out = [];

  const startUrl =
    text(baseUrl) ||
    text((pages || []).find((page) => page && page.url)?.url) ||
    '';

  for (const [index, step] of steps.entries()) {
    if (!step || typeof step !== 'object') {
      unsupported.push({ index, reason: 'шаг пустой' });
      continue;
    }
    if (step.sharedStepId) {
      unsupported.push({
        index,
        action: 'shared',
        reason: 'общие шаги переносятся вручную',
      });
      continue;
    }

    const action = actionsById.get(step.actionId);
    const actionName = action?.name || step.actionName || '';

    if (UNSUPPORTED[actionName]) {
      unsupported.push({ index, action: actionName, reason: UNSUPPORTED[actionName] });
      continue;
    }

    const build = VERBS[actionName];
    if (!build) {
      unsupported.push({
        index,
        action: actionName || '(неизвестное действие)',
        reason: 'действие не поддерживается',
      });
      continue;
    }

    if (actionName === 'takeScreenshot') {
      out.push(build(step, ''));
      continue;
    }

    const element = elementsById.get(step.webElementId);
    const selector = text(element?.selector);
    if (!selector) {
      unsupported.push({
        index,
        action: actionName,
        reason: 'у шага нет элемента с селектором',
      });
      continue;
    }

    out.push(build(step, selector));
  }

  // NATL has no implicit navigation: a scenario starts where `goto` points.
  if (startUrl && !out.some((step) => 'goto' in step)) {
    out.unshift({ goto: '$base_url' });
  }

  const doc = { name: text(test.title) || 'Scenario' };
  doc.engine = 'playwright';
  if (startUrl) doc.vars = { base_url: startUrl };
  doc.steps = out;

  return {
    yaml: stringify(doc),
    doc,
    fileName: `${slugFromTitle(doc.name)}.yaml`,
    unsupported,
  };
}

module.exports = { convertTest, VERBS, UNSUPPORTED, slugFromTitle };
