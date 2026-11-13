'use strict';

const { chromium } = require('playwright');

const { stringify } = require('./yaml');

/**
 * Click recorder.
 *
 * The browser is driven by Playwright, the same engine that runs the scenarios,
 * so what you record is what will be replayed. A small script is injected into
 * the page; it turns DOM events into NATL steps and sends them to the main
 * process through an exposed binding.
 *
 * The recorder knows nothing about the app's JSON model: it produces NATL steps
 * directly. That keeps a single format on the path record → save → run.
 */

const STEP_DEBOUNCE_MS = 400;
const NAVIGATION_QUIET_MS = 800;

/** Runs inside the page. Must stay self-contained: no closures over Node state. */
function injectedRecorder() {
  if (window.__natlRecorderInstalled) return;
  window.__natlRecorderInstalled = true;

  const send = (payload) => {
    if (typeof window.__natlRecord === 'function') {
      window.__natlRecord(payload);
    }
  };

  const cssEscape = (value) =>
    window.CSS && typeof window.CSS.escape === 'function'
      ? window.CSS.escape(value)
      : String(value).replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`);

  const shortText = (element) => {
    const text = (element.innerText || element.textContent || '').trim().replace(/\s+/g, ' ');
    return text.length > 40 ? `${text.slice(0, 40)}…` : text;
  };

  /** Prefer stable attributes, fall back to a short structural path. */
  const selectorFor = (element) => {
    if (!element || element.nodeType !== 1) return null;
    const tag = element.tagName.toLowerCase();
    if (tag === 'html' || tag === 'body') return null;

    for (const attr of ['data-testid', 'data-qa', 'data-cy', 'data-test']) {
      const value = element.getAttribute(attr);
      if (value) return `[${attr}="${cssEscape(value)}"]`;
    }

    const id = element.getAttribute('id');
    if (id && !/^\d/.test(id)) return `#${cssEscape(id)}`;

    const name = element.getAttribute('name');
    if (name) return `${tag}[name="${cssEscape(name)}"]`;

    const aria = element.getAttribute('aria-label');
    if (aria) return `${tag}[aria-label="${cssEscape(aria)}"]`;

    const parts = [];
    let node = element;
    let depth = 0;
    while (node && node.nodeType === 1 && depth < 4) {
      const currentTag = node.tagName.toLowerCase();
      if (currentTag === 'body' || currentTag === 'html') break;
      const parent = node.parentElement;
      if (!parent) break;
      const sameTag = Array.from(parent.children).filter(
        (child) => child.tagName === node.tagName,
      );
      const index = sameTag.indexOf(node) + 1;
      parts.unshift(sameTag.length > 1 ? `${currentTag}:nth-of-type(${index})` : currentTag);
      if (node.id && !/^\d/.test(node.id)) {
        parts.unshift(`#${cssEscape(node.id)}`);
        break;
      }
      node = parent;
      depth += 1;
    }
    return parts.length ? parts.join(' > ') : null;
  };

  const timers = new WeakMap();
  const lastValue = new WeakMap();

  const flushFill = (element) => {
    const selector = selectorFor(element);
    if (!selector) return;
    const value = element.value == null ? '' : String(element.value);
    if (lastValue.get(element) === value) return;
    lastValue.set(element, value);
    send({
      type: 'fill',
      selector,
      value,
      secret: element.getAttribute('type') === 'password',
      label: shortText(element) || element.getAttribute('placeholder') || 'input',
    });
  };

  document.addEventListener(
    'click',
    (event) => {
      const target = event.target;
      if (!target || target.nodeType !== 1) return;
      const tag = target.tagName.toLowerCase();
      if (tag === 'select' || tag === 'option') return;
      if (tag === 'input' && !['checkbox', 'radio', 'submit', 'button'].includes(target.type)) {
        return;
      }
      const selector = selectorFor(target);
      if (!selector) return;
      send({ type: 'click', selector, label: shortText(target) || tag });
    },
    true,
  );

  document.addEventListener(
    'input',
    (event) => {
      const target = event.target;
      if (!target || target.nodeType !== 1) return;
      if (target.tagName.toLowerCase() !== 'input' && target.tagName.toLowerCase() !== 'textarea') {
        return;
      }
      const element = target;
      const existing = timers.get(element);
      if (existing) clearTimeout(existing);
      timers.set(
        element,
        setTimeout(() => flushFill(element), STEP_DEBOUNCE_MS),
      );
    },
    true,
  );

  document.addEventListener(
    'change',
    (event) => {
      const target = event.target;
      if (!target || target.nodeType !== 1) return;
      if (target.tagName.toLowerCase() === 'select') {
        const selector = selectorFor(target);
        if (selector) {
          send({ type: 'select', selector, value: String(target.value) });
        }
        return;
      }
      if (target.tagName.toLowerCase() === 'input' || target.tagName.toLowerCase() === 'textarea') {
        flushFill(target);
      }
    },
    true,
  );
}

/** Only http(s) URLs: a recorder must not open file:// or javascript: links. */
function assertRecordableUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Некорректный адрес');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Можно записывать только http и https');
  }
  return parsed.toString();
}

/** Recorded steps become a NATL document. */
function buildScenario({ steps, baseUrl, name }) {
  const doc = { name: name || 'Recorded scenario' };
  doc.engine = 'playwright';
  if (baseUrl) doc.vars = { base_url: baseUrl };
  doc.steps = Array.isArray(steps) && steps.length ? steps : [];
  return doc;
}

function createRecorderState() {
  return { steps: [], warnings: [], lastActionAt: 0, browser: null, page: null };
}

/**
 * Start recording. Resolves once the browser is open on the page.
 * The caller owns `stop()` / `close()`.
 */
async function startRecording({ url, onStep = () => {}, headless = false } = {}) {
  const target = assertRecordableUrl(url);
  const state = createRecorderState();

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(5000);

  state.browser = browser;
  state.page = page;

  await page.exposeFunction('__natlRecord', (payload) => {
    state.lastActionAt = Date.now();
    if (payload.type === 'click') {
      state.steps.push({ click: payload.selector });
      if (payload.label) onStep({ action: 'click', target: payload.label });
      return;
    }
    if (payload.type === 'fill') {
      if (payload.secret) {
        state.warnings.push(
          'В поле пароля записано введённое значение. Замените его на переменную из .env перед коммитом.',
        );
      }
      state.steps.push({ fill: payload.selector, with: payload.value });
      onStep({ action: 'fill', target: payload.label });
      return;
    }
    if (payload.type === 'select') {
      state.steps.push({ select: payload.selector, with: payload.value });
      onStep({ action: 'select', target: payload.selector });
    }
  });

  page.on('framenavigated', (frame) => {
    if (frame !== page.mainFrame()) return;
    // The first load is the scenario's start URL, not a recorded step.
    if (state.suppressNavigation) return;
    // A click that triggers navigation is already recorded as a click.
    if (Date.now() - state.lastActionAt < NAVIGATION_QUIET_MS) return;
    state.steps.push({ goto: frame.url() });
    onStep({ action: 'goto', target: frame.url() });
  });

  await page.addInitScript(injectedRecorder);

  const firstStep = { goto: '$base_url' };
  state.steps.push(firstStep);
  onStep({ action: 'goto', target });

  state.suppressNavigation = true;
  await page.goto(target, { waitUntil: 'domcontentloaded' });
  state.suppressNavigation = false;

  return {
    url: target,
    warnings: state.warnings,
    /** Used by the smoke script; the app never needs the raw page. */
    page,
    async stop({ name } = {}) {
      const doc = buildScenario({ steps: state.steps, baseUrl: target, name });
      await browser.close().catch(() => {});
      return {
        yaml: stringify(doc),
        steps: doc.steps,
        warnings: state.warnings,
      };
    },
    async close() {
      await browser.close().catch(() => {});
    },
  };
}

module.exports = { startRecording, buildScenario, assertRecordableUrl, injectedRecorder };
