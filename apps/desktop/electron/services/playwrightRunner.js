const fs = require('fs');
const path = require('path');
const playwright = require('playwright');
const filestore = require('../store/filestore');
const reportsStore = require('../store/reports');
const browserConfig = require('../store/browserConfig');
const { assertHttpsRequestUrl, assertHttpsOrAboutBlank } = require('../utils/requireHttpsUrl');

function resolveVariableValue(v) {
  const pattern = v.valuePattern && String(v.valuePattern).trim();
  if (pattern) {
    try {
      const RandExp = require('randexp');
      return new RandExp(new RegExp(pattern)).gen();
    } catch {
      return '';
    }
  }
  const name = v.name != null ? String(v.name).trim() : '';
  if (v.value != null && String(v.value) !== '') return String(v.value);
  return name ? (process.env[name] ?? '') : '';
}

/**
 * Replace {{variableName}} or {{env:VAR_NAME}} in str with values from varsMap or process.env.
 */
function substitute(str, varsMap) {
  if (str == null || typeof str !== 'string') return str;
  return str.replace(/\{\{(env:)?(\w+)\}\}/g, (_, envPrefix, name) => {
    if (envPrefix === 'env:') return process.env[name] ?? '';
    return varsMap && varsMap[name] != null ? String(varsMap[name]) : `{{${name}}}`;
  });
}

/** Build query object from endpoint.parameters (array of { name, value } or { name, in, value }). */
function parametersToQuery(parameters, varsMap) {
  if (!Array.isArray(parameters) || parameters.length === 0) return {};
  const out = {};
  for (const p of parameters) {
    const name = p.name;
    if (!name) continue;
    const inParam = p.in;
    if (inParam && inParam !== 'query') continue;
    const val = p.value != null ? substitute(String(p.value), varsMap) : '';
    out[name] = val;
  }
  return out;
}

/** Build auth headers from endpoint/step auth for fetch (Bearer or Basic). */
function buildAuthHeaders(endpointAuth, stepAuth, varsMap) {
  const auth = stepAuth && (stepAuth.type === 'bearer' || stepAuth.type === 'basic')
    ? stepAuth
    : endpointAuth && (endpointAuth.type === 'bearer' || endpointAuth.type === 'basic')
      ? endpointAuth
      : null;
  if (!auth) return {};
  if (auth.type === 'bearer' && auth.token != null) {
    const token = substitute(String(auth.token), varsMap);
    return { Authorization: `Bearer ${token}` };
  }
  if (auth.type === 'basic' && auth.username != null) {
    const username = substitute(String(auth.username), varsMap);
    const password = substitute(String(auth.password || ''), varsMap);
    const encoded = Buffer.from(`${username}:${password}`, 'utf8').toString('base64');
    return { Authorization: `Basic ${encoded}` };
  }
  return {};
}

function normalizeFormRows(bodyDef) {
  if (!bodyDef) return [];
  if (Array.isArray(bodyDef)) {
    return bodyDef.filter((r) => r && (r.key || r.name));
  }
  if (typeof bodyDef === 'object') {
    return Object.entries(bodyDef).map(([key, value]) => ({ key, value }));
  }
  return [];
}

function buildMultipartObject(bodyDef, varsMap) {
  const rows = normalizeFormRows(bodyDef);
  const out = {};
  for (const row of rows) {
    const name = String(row.key ?? row.name ?? '').trim();
    if (!name) continue;
    const ft = row.fieldType === 'file' || row.type === 'file' ? 'file' : 'text';
    if (ft === 'file') {
      const fp = substitute(String(row.value || ''), varsMap);
      if (!fp || !fs.existsSync(fp)) throw new Error(`Multipart file not found: ${fp}`);
      const buf = fs.readFileSync(fp);
      const base = path.basename(fp);
      out[name] = {
        name: base,
        mimeType: row.mimeType || 'application/octet-stream',
        buffer: buf,
      };
    } else {
      out[name] = substitute(String(row.value ?? ''), varsMap);
    }
  }
  return out;
}

function effectiveBodyMode(endpoint, step) {
  let mode = step.bodyMode ?? endpoint.bodyMode ?? null;
  if (!mode && endpoint.requestBody != null && endpoint.requestBody !== '') return 'raw';
  if (!mode) return 'none';
  return mode;
}

function getRawBodyContent(endpoint, step, varsMap) {
  let raw = step.body !== undefined && step.body !== null ? step.body : endpoint.body;
  if (typeof raw === 'string') {
    raw = substitute(raw, varsMap);
    try {
      return raw ? JSON.parse(raw) : undefined;
    } catch {
      return raw;
    }
  }
  if (raw && typeof raw === 'object') return raw;
  if (endpoint.requestBody != null && (step.body === undefined || step.body === null)) {
    let rb = endpoint.requestBody;
    if (typeof rb === 'string') {
      rb = substitute(rb, varsMap);
      try {
        return rb ? JSON.parse(rb) : undefined;
      } catch {
        return rb;
      }
    }
    return rb;
  }
  return undefined;
}

const MAX_SHARED_STEP_DEPTH = 5;

/**
 * Expand sharedStepId references into concrete steps (recursive with depth limit).
 */
function expandSteps(workspacePath, steps, maxDepth = MAX_SHARED_STEP_DEPTH) {
  if (!Array.isArray(steps) || maxDepth <= 0) return steps || [];
  const out = [];
  for (const step of steps) {
    if (step.sharedStepId) {
      const shared = filestore.readSharedStep(workspacePath, step.sharedStepId);
      if (shared && Array.isArray(shared.steps)) {
        out.push(...expandSteps(workspacePath, shared.steps, maxDepth - 1));
      }
    } else {
      out.push(step);
    }
  }
  return out;
}

/**
 * Find the page and web element that contain the given webElementId (search all pages in workspace).
 */
function getPageAndElementForWebElementId(workspacePath, webElementId) {
  if (!webElementId) return null;
  const pages = filestore.listPages(workspacePath);
  for (const p of pages) {
    const el = (p.webElements || []).find((e) => e.id === webElementId);
    if (el) return { page: p, element: el };
  }
  return null;
}

/**
 * Resolve step to selector, title, actionName, value using page webElements and actions list.
 */
function resolveStep(step, page, actions) {
  const webElements = page.webElements || [];
  const actionsList = Array.isArray(actions) ? actions : (actions?.actions || []);
  const el = step.webElementId
    ? webElements.find((e) => e.id === step.webElementId)
    : step.webElement;
  const act = step.actionId
    ? actionsList.find((a) => a.id === step.actionId)
    : (actionsList.find((a) => a.name === step.actionName) || step.action);
  const selector = el?.selector || step.selector;
  const title = el?.title || step.title || 'Step';
  const actionName = act?.name || step.actionName;
  const value = step.value != null ? step.value : '';
  return { selector, title, actionName, value };
}

/**
 * Run a single test and return report.
 * onProgress(stepIndex, total, message, meta?) — meta.runStage: 'step' | 'screenshot' | 'teardown' | 'persist'
 * options.log(line) optional file log for this test.
 */
async function runTest(workspacePath, testId, options = {}) {
  const { onProgress: onProgressCb = () => {}, saveReportToFile = true, screenshotOnFailureOnly = false } = options;
  const log = typeof options.log === 'function' ? options.log : () => {};
  const onProgress = (stepIndex, total, message, meta) => onProgressCb(stepIndex, total, message, meta);
  require('dotenv').config({
    path: path.join(workspacePath, '.env'),
    override: true,
  });
  const test = filestore.readTest(workspacePath, testId);
  if (!test) throw new Error(`Test ${testId} not found`);
  log(`Start testId=${testId} title=${test.title || '(untitled)'}`);
  const actions = filestore.readActions(workspacePath);
  const variablesList = filestore.readVariables(workspacePath) || [];
  // varsMap is built fresh for each runTest() call, so variables with valuePattern get a new generated value on every test run.
  const varsMap = Object.fromEntries(
    (variablesList || [])
      .filter((v) => v && v.name != null && String(v.name).trim() !== '')
      .map((v) => [String(v.name).trim(), resolveVariableValue(v)])
  );
  const steps = expandSteps(workspacePath, test.steps || []);
  const progressTotal = Math.max(1, steps.length + 1);
  log(`Expanded steps count=${steps.length} progressTotal=${progressTotal}`);

  const hasUiSteps = steps.some((s) => !s.type || s.type === 'ui');
  const hasApiSteps = steps.some((s) => s.type === 'api' || ['request', 'assertStatus', 'assertBody'].includes(s.type));

  // Test is not tied to a single page; resolve page from first UI step that has a web element
  let page = null;
  let viewport = { width: 1920, height: 1080 };
  if (hasUiSteps) {
    const firstUiStepWithElement = steps.find((s) => (!s.type || s.type === 'ui') && s.webElementId);
    if (firstUiStepWithElement && firstUiStepWithElement.webElementId) {
      const found = getPageAndElementForWebElementId(workspacePath, firstUiStepWithElement.webElementId);
      if (found) {
        page = found.page;
        viewport = page.viewport || viewport;
      }
    }
    if (!page) {
      throw new Error('UI test has no step that uses a web element from any page; add steps that reference page elements.');
    }
  }

  const reportId = require('crypto').randomUUID();
  const reportSteps = [];
  let browser = null;
  let requestContext = null;
  let requestContextOwned = false; // true when we created request via playwright.request.newContext (no browser)
  const startTime = Date.now();
  let success = false;

  let lastResponse = null; // { status, headers, data, bodyText } for API steps

  try {
    let pwPage = null;

    if (hasUiSteps) {
      const userDataPath = options.userDataPath;
      const config = userDataPath ? browserConfig.getBrowserConfig(userDataPath) : { browser: 'custom', executablePath: null };
      const headless = options.headless !== false;
      const engine = playwright.chromium;
      const launchOpts = { headless };
      const p = config.executablePath != null ? String(config.executablePath).trim() : '';
      if (!p) throw new Error('Browser executable path is not set in Settings.');
      launchOpts.executablePath = p;
      browser = await engine.launch(launchOpts);
      const viewportSize = { width: viewport.width || 1920, height: viewport.height || 1080 };
      const context = await browser.newContext({ viewport: viewportSize });
      requestContext = context.request;
      pwPage = await context.newPage();
      await pwPage.setViewportSize(viewportSize);
    } else if (hasApiSteps) {
      requestContext = await playwright.request.newContext();
      requestContextOwned = true;
    }

    const reportDir = saveReportToFile ? reportsStore.getReportDir(workspacePath, reportId) : null;
    const captureScreenshot = async (stepIndex, suffix = '') => {
      if (!reportDir || !pwPage) return null;
      const onFailure = suffix === 'failure';
      if (screenshotOnFailureOnly && !onFailure) return null;
      const filename = `step-${stepIndex}${suffix ? '-' + suffix : ''}.png`;
      const filePath = require('path').join(reportDir, filename);
      await pwPage.screenshot({ path: filePath }).catch(() => null);
      return filename;
    };

    let currentPageId = page?.id || null;
    if (hasUiSteps && pwPage && page) {
      onProgress(0, progressTotal, 'Opening page...');
      log(`Opening page url=${page.url}`);
      assertHttpsOrAboutBlank(page.url, 'Page URL');
      await pwPage.goto(page.url || 'about:blank', { timeout: 30000 });
      log('Opening page: navigation done');
      reportSteps.push({ value: `Open ${page.url}`, status: 'passed', error: null, screenshotPath: await captureScreenshot(0) });
    }

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const isApiStep = step.type === 'api' || ['request', 'assertStatus', 'assertBody'].includes(step.type);
      const apiAction = step.type === 'api' ? (step.actionId || step.type) : step.type;

      // API steps (via Playwright request context)
      if (isApiStep && requestContext) {
        const apiMsg = apiAction === 'request' ? `Request: ${step.endpointId || step.targetId}` : apiAction;
        log(`API step ${i + 1}/${steps.length} ${apiMsg}`);
        onProgress(i + 1, progressTotal, apiMsg);
        let stepSuccess = false;
        let stepError = null;
        let stepValue = '';
        let stepRequest = null;
        let stepResponse = null;
        try {
          if (apiAction === 'request') {
            const endpointId = step.endpointId || step.targetId;
            const endpoint = filestore.readEndpoint(workspacePath, endpointId);
            if (!endpoint) throw new Error(`Endpoint ${endpointId} not found`);
            let baseUrlStr = endpoint.baseUrl || '';
            // Step-level baseId overrides endpoint base (like pageId for UI steps)
            const effectiveBaseId = step.baseId ?? endpoint.baseId;
            if (effectiveBaseId) {
              const base = filestore.readBase(workspacePath, effectiveBaseId);
              if (base) baseUrlStr = base.baseUrl || baseUrlStr;
            }
            const baseUrl = substitute(baseUrlStr, varsMap).trim() || '';
            let path = substitute(endpoint.path || '/', varsMap);
            const method = (endpoint.method || 'GET').toUpperCase();
            const bodyMode = effectiveBodyMode(endpoint, step);

            const endpointHeaders = endpoint.headers && typeof endpoint.headers === 'object' ? endpoint.headers : {};
            const stepHeaders = step.headers && typeof step.headers === 'object' ? step.headers : {};
            const authHeaders = buildAuthHeaders(endpoint.auth, step.auth, varsMap);
            let allHeaders = { ...endpointHeaders, ...stepHeaders, ...authHeaders };

            const endpointQuery = parametersToQuery(endpoint.parameters, varsMap);
            const stepQuery = step.query && typeof step.query === 'object' ? step.query : {};
            const query = { ...endpointQuery, ...stepQuery };
            const queryStr = Object.keys(query).length
              ? '?' + new URLSearchParams(query).toString()
              : '';
            const url = (baseUrl + path).replace(/([^:]\/)\/+/g, '$1') + queryStr;
            assertHttpsRequestUrl(url, 'API request URL');

            const fetchOptions = {
              method,
              headers: { ...allHeaders },
              timeout: 30000,
            };

            const sendBody = method !== 'GET' && method !== 'HEAD' && bodyMode !== 'none';

            if (sendBody && bodyMode === 'raw') {
              if (!fetchOptions.headers['Content-Type'] && !fetchOptions.headers['content-type']) {
                fetchOptions.headers['Content-Type'] = 'application/json';
              }
              fetchOptions.data = getRawBodyContent(endpoint, step, varsMap);
            } else if (sendBody && bodyMode === 'x-www-form-urlencoded') {
              delete fetchOptions.headers['Content-Type'];
              delete fetchOptions.headers['content-type'];
              const bodySrc = step.body !== undefined && step.body !== null ? step.body : endpoint.body;
              const rows = normalizeFormRows(bodySrc);
              const formObj = {};
              for (const row of rows) {
                const k = String(row.key ?? row.name ?? '').trim();
                if (k) formObj[k] = substitute(String(row.value ?? ''), varsMap);
              }
              fetchOptions.form = formObj;
            } else if (sendBody && bodyMode === 'form-data') {
              delete fetchOptions.headers['Content-Type'];
              delete fetchOptions.headers['content-type'];
              const bodySrc = step.body !== undefined && step.body !== null ? step.body : endpoint.body;
              fetchOptions.multipart = buildMultipartObject(bodySrc, varsMap);
            }

            let bodyPreview = undefined;
            if (fetchOptions.data !== undefined) {
              bodyPreview =
                typeof fetchOptions.data === 'string'
                  ? fetchOptions.data
                  : JSON.stringify(fetchOptions.data);
            } else if (fetchOptions.form) {
              bodyPreview = JSON.stringify(fetchOptions.form);
            } else if (fetchOptions.multipart) {
              bodyPreview = '[multipart/form-data]';
            }

            stepRequest = {
              method,
              url,
              headers: fetchOptions.headers,
              body: bodyPreview,
            };

            const res = await requestContext.fetch(url, fetchOptions);

            const resBodyText = await res.text();
            let resData;
            try {
              resData = resBodyText ? JSON.parse(resBodyText) : null;
            } catch {
              resData = resBodyText;
            }

            const resHeaders = {};
            for (const [k, v] of Object.entries(res.headers())) resHeaders[k] = v;

            stepResponse = {
              status: res.status(),
              headers: resHeaders,
              body: resBodyText.length > 10000 ? resBodyText.slice(0, 10000) + '\n... (truncated)' : resBodyText,
            };
            lastResponse = { status: res.status(), headers: resHeaders, data: resData, bodyText: resBodyText };
            stepValue = `${method} ${path} → ${res.status()}`;
            stepSuccess = true;
          } else if (apiAction === 'assertStatus') {
            const expected = substitute(String(step.value ?? ''), varsMap).trim();
            const actual = lastResponse ? lastResponse.status : null;
            if (actual === null) throw new Error('No previous response');
            const expectedNum = parseInt(expected, 10);
            if (String(actual) !== expected && actual !== expectedNum) {
              throw new Error(`Expected status ${expected}, got ${actual}`);
            }
            stepValue = `Status ${actual}`;
            stepResponse = lastResponse ? { status: lastResponse.status, headers: lastResponse.headers, body: lastResponse.bodyText } : null;
            stepSuccess = true;
          } else if (apiAction === 'assertBody') {
            if (!lastResponse) throw new Error('No previous response');
            const data = lastResponse.data;
            const jsonPath = step.jsonPath || step.path;
            const expected = substitute(String(step.value ?? ''), varsMap);
            let actual;
            if (jsonPath) {
              const parts = jsonPath.replace(/^\./, '').split('.');
              actual = parts.reduce((o, k) => (o && o[k] != null ? o[k] : undefined), data);
            } else {
              actual = data;
            }
            const actualStr = typeof actual === 'object' ? JSON.stringify(actual) : String(actual);
            if (actualStr !== expected && actual !== expected) {
              throw new Error(`Expected: ${expected}, got: ${actualStr}`);
            }
            stepValue = jsonPath ? `Body ${jsonPath}` : 'Body';
            stepResponse = lastResponse ? { status: lastResponse.status, headers: lastResponse.headers, body: lastResponse.bodyText } : null;
            stepSuccess = true;
          }
        } catch (err) {
          stepError = err.message || String(err);
        }
        reportSteps.push({
          value: stepValue || apiAction,
          status: stepSuccess ? 'passed' : 'failed',
          error: stepError,
          request: stepRequest || undefined,
          response: stepResponse || undefined,
        });
        log(`API step ${i + 1} result=${stepSuccess ? 'passed' : 'failed'}${stepError ? ` error=${stepError}` : ''}`);
        if (!stepSuccess) break;
        continue;
      }

      // UI steps
      if (!hasUiSteps || !pwPage) {
        reportSteps.push({
          value: `Step ${i + 1}`,
          status: 'failed',
          error: 'UI step cannot run without page/browser',
        });
        success = false;
        break;
      }

      // Resolve step's webElementId to (page, element) by searching all pages
      const webElementId = step.webElementId;
      const stepPageAndEl = webElementId ? getPageAndElementForWebElementId(workspacePath, webElementId) : null;
      const stepPage = stepPageAndEl ? stepPageAndEl.page : page;
      if (!stepPage) {
        reportSteps.push({
          value: `Step ${i + 1}`,
          status: 'failed',
          error: webElementId ? `Web element ${webElementId} not found in any page` : 'Step has no web element',
          screenshotPath: await captureScreenshot(i + 1, 'failure'),
        });
        success = false;
        break;
      }
      if (stepPage.id !== currentPageId) {
        log(`Navigating to step page url=${stepPage.url}`);
        assertHttpsOrAboutBlank(stepPage.url, 'Page URL');
        await pwPage.goto(stepPage.url || 'about:blank', { timeout: 30000 });
        currentPageId = stepPage.id;
      }
      const resolved = resolveStep(step, stepPage, actions);
      const { selector, title, actionName, value: rawValue } = resolved;
      const value = substitute(rawValue, varsMap);
      log(`UI step ${i + 1}/${steps.length} ${actionName}: ${title}`);
      onProgress(i + 1, progressTotal, `${actionName}: ${title}`);
      let stepSuccess = false;
      let stepError = null;
      try {
        await executeStep(pwPage, actionName, selector, value, title);
        stepSuccess = true;
      } catch (err) {
        stepError = err.message || String(err);
      }
      const willCaptureShot = !!(reportDir && pwPage && !(screenshotOnFailureOnly && stepSuccess));
      if (willCaptureShot) {
        onProgress(i + 1, progressTotal, 'Capturing screenshot…', { runStage: 'screenshot' });
        log('Capturing screenshot...');
      }
      const screenshotPath = await captureScreenshot(i + 1, stepSuccess ? '' : 'failure');
      if (willCaptureShot) log(`Screenshot done path=${screenshotPath || 'none'}`);
      reportSteps.push({
        value: `${actionName}(${title})${value ? ': ' + value : ''}`,
        status: stepSuccess ? 'passed' : 'failed',
        error: stepError,
        screenshotPath: screenshotPath || undefined,
      });
      log(`UI step ${i + 1} result=${stepSuccess ? 'passed' : 'failed'}${stepError ? ` error=${stepError}` : ''}`);
      if (!stepSuccess) break;
    }
    success = reportSteps.every((s) => s.status === 'passed');
  } finally {
    const teardownMsg = browser ? 'Closing browser…' : 'Releasing resources…';
    onProgress(progressTotal, progressTotal, teardownMsg, { runStage: 'teardown' });
    log(teardownMsg.replace('…', '...'));
    if (requestContextOwned && requestContext) await requestContext.dispose().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    log('Teardown finished');
  }

  const executionTime = Date.now() - startTime;
  const report = {
    id: reportId,
    testId,
    testTitle: test.title,
    status: success ? 'passed' : 'failed',
    executionTime,
    steps: reportSteps,
    createdAt: new Date().toISOString(),
  };
  if (saveReportToFile) {
    onProgress(progressTotal, progressTotal, 'Saving report…', { runStage: 'persist' });
    log('Saving report...');
    reportsStore.saveReport(workspacePath, report);
    log(`Report saved id=${report.id} status=${report.status}`);
  }
  return report;
}

async function executeStep(page, actionName, selector, value, title) {
  const timeout = 15000;
  switch (actionName) {
    case 'click':
      await page.waitForSelector(selector, { state: 'visible', timeout });
      await page.click(selector);
      break;
    case 'fill':
      await page.waitForSelector(selector, { state: 'visible', timeout });
      await page.fill(selector, value || '');
      break;
    case 'hover':
      await page.waitForSelector(selector, { state: 'visible', timeout });
      await page.hover(selector);
      break;
    case 'checkText':
      await page.waitForSelector(selector, { timeout });
      const text = await page.textContent(selector);
      if ((text || '').trim() !== (value || '').trim()) {
        throw new Error(`Text mismatch. Expected: "${value}", Got: "${text}"`);
      }
      break;
    case 'waitForElement':
      await page.waitForSelector(selector, { timeout: parseInt(value, 10) || 5000 });
      break;
    case 'goBack':
      await page.goBack();
      break;
    case 'goForward':
      await page.goForward();
      break;
    case 'selectOption':
      await page.waitForSelector(selector, { timeout });
      await page.selectOption(selector, value || { index: 0 });
      break;
    case 'checkVisibility':
      const visible = await page.isVisible(selector);
      if (!visible) throw new Error('Element not visible');
      break;
    case 'pressKey':
      await page.waitForSelector(selector, { timeout });
      await page.press(selector, value || 'Enter');
      break;
    case 'clearInput':
      await page.waitForSelector(selector, { timeout });
      await page.fill(selector, '');
      break;
    case 'doubleClick':
      await page.waitForSelector(selector, { state: 'visible', timeout });
      await page.dblclick(selector);
      break;
    case 'rightClick':
      await page.waitForSelector(selector, { state: 'visible', timeout });
      await page.click(selector, { button: 'right' });
      break;
    case 'focus':
      await page.waitForSelector(selector, { timeout });
      await page.focus(selector);
      break;
    case 'blur':
      await page.evaluate((sel) => document.querySelector(sel)?.blur(), selector);
      break;
    case 'takeScreenshot':
      await page.screenshot({ path: undefined });
      break;
    default:
      throw new Error(`Unknown action: ${actionName}`);
  }
}

module.exports = {
  runTest,
  substitute,
  effectiveBodyMode,
  getRawBodyContent,
  normalizeFormRows,
  buildMultipartObject,
};
