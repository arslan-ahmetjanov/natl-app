const { app } = require('electron');
const { chromium } = require('playwright');
const { JSDOM } = require('jsdom');
const browserConfig = require('../store/browserConfig');

function resolveParseExecutablePath() {
  const userData = app.getPath('userData');
  const config = browserConfig.getBrowserConfig(userData);
  const p = config.executablePath ? String(config.executablePath).trim() : '';
  if (!p) throw new Error('Browser executable path is not set in Settings.');
  return p;
}

function escapeCssSelector(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/[!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~]/g, '\\$&');
}

function getCompactCSSSelector(element, document) {
  if (!element || element.nodeType !== 1) return '';
  const uniqueAttrs = [
    'data-testid', 'data-qa', 'data-cy',
    'id',
    'name', 'aria-label', 'role',
    'href', 'alt', 'title', 'placeholder'
  ];
  for (const attr of uniqueAttrs) {
    const value = element.getAttribute(attr);
    if (value?.trim()) {
      const selector = `[${attr}="${escapeCssSelector(value.trim())}"]`;
      if (isSelectorUnique(selector, document)) return selector;
    }
  }
  if (element.classList.length > 0) {
    const classes = Array.from(element.classList)
      .filter(c => !/^(js|is-)/.test(c))
      .map(escapeCssSelector);
    if (classes.length > 0) {
      const classSelector = `${element.tagName.toLowerCase()}.${classes.join('.')}`;
      if (isSelectorUnique(classSelector, document)) return classSelector;
    }
  }
  const path = [];
  let current = element;
  let depth = 0;
  while (current && depth < 5) {
    const tag = current.tagName.toLowerCase();
    let part = tag;
    if (current.id) {
      part += `#${escapeCssSelector(current.id)}`;
      path.unshift(part);
      break;
    }
    const siblings = Array.from(current.parentElement?.children || [])
      .filter(el => el.tagName === current.tagName);
    if (siblings.length > 1) {
      const index = siblings.indexOf(current) + 1;
      part += `:nth-child(${index})`;
    }
    path.unshift(part);
    current = current.parentElement;
    depth++;
  }
  const hierarchySelector = path.join(' > ');
  return isSelectorUnique(hierarchySelector, document) ? hierarchySelector : '';
}

function isSelectorUnique(selector, document) {
  try {
    return document.querySelectorAll(selector).length === 1;
  } catch {
    return false;
  }
}

function getSuggestedType(el) {
  const tag = (el.tagName || '').toLowerCase();
  if (tag === 'input') return 'input';
  if (tag === 'button' || el.getAttribute('role') === 'button') return 'button';
  if (tag === 'a') return 'link';
  if (tag === 'textarea') return 'textarea';
  if (tag === 'select') return 'select';
  return 'element';
}

function parseInteractiveElements(html) {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  ['style', 'script', 'link', 'meta', 'svg'].forEach(tag => {
    document.querySelectorAll(tag).forEach(el => el.remove());
  });
  const interactiveSelectors = [
    'a[href]',
    'button',
    'input:not([type="hidden"])',
    'textarea',
    'select',
    '[role="button"]',
    '[role="link"]'
  ];
  const elements = document.querySelectorAll(interactiveSelectors.join(','));
  const result = [];
  const uniquePairs = new Map();
  elements.forEach((el) => {
    try {
      const selector = getCompactCSSSelector(el, document);
      if (!selector) return;
      let title = '';
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        title = el.value || el.placeholder || el.title || '';
      } else {
        title = el.textContent.trim() || el.title || el.getAttribute('aria-label') || '';
      }
      title = title.replace(/\s+/g, ' ').substring(0, 100).trim();
      if (!title || title.length < 2) return;
      const existingSelector = uniquePairs.get(title);
      if (existingSelector) {
        if (selector.length < existingSelector.length) {
          uniquePairs.set(title, selector);
          const index = result.findIndex(item => item.title === title);
          if (index !== -1) result[index].selector = selector;
        }
        return;
      }
      uniquePairs.set(title, selector);
      result.push({
        title,
        selector,
        type: getSuggestedType(el),
      });
    } catch (_) {}
  });
  return result;
}

async function parsePageUrl(url, viewport = null, requestOptions = null) {
  const executablePath = resolveParseExecutablePath();
  const launchOptions = { headless: true };
  if (executablePath) launchOptions.executablePath = executablePath;
  const browser = await chromium.launch(launchOptions);
  try {
    const contextOptions = {};
    if (viewport && (viewport.width || viewport.height)) {
      contextOptions.viewport = {
        width: Number(viewport.width) || 1280,
        height: Number(viewport.height) || 720,
      };
    }
    const headers = requestOptions && requestOptions.headers && typeof requestOptions.headers === 'object'
      ? requestOptions.headers
      : null;
    if (headers && Object.keys(headers).length > 0) {
      contextOptions.extraHTTPHeaders = headers;
    }
    const context = await browser.newContext(contextOptions);
    if (
      requestOptions &&
      requestOptions.auth &&
      requestOptions.auth.type === 'basic' &&
      requestOptions.auth.username != null &&
      requestOptions.auth.password != null
    ) {
      await context.setExtraHTTPHeaders({
        ...(headers || {}),
        Authorization: `Basic ${Buffer.from(
          `${String(requestOptions.auth.username)}:${String(requestOptions.auth.password)}`
        ).toString('base64')}`,
      });
    }
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await new Promise((r) => setTimeout(r, 800));
    const html = await page.content();
    await browser.close();
    return parseInteractiveElements(html);
  } catch (err) {
    await browser.close().catch(() => {});
    throw err;
  }
}

function parsePageFromHtml(html) {
  return parseInteractiveElements(html);
}

async function parsePage(url, viewport = null, requestOptions = null) {
  if (typeof url !== 'string' || !url.trim()) {
    throw new Error('Page URL must be a non-empty string');
  }
  return parsePageUrl(url, viewport, requestOptions);
}

module.exports = { parsePage, parsePageUrl, parsePageFromHtml, parseInteractiveElements };
