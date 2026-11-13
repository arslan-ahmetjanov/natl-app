const fs = require('fs');
const path = require('path');
const { PREDEFINED_ACTIONS, DEFAULT_VIEWPORTS } = require('./constants');

const TESTBLOX_DIR = '.testblox';
const WORKSPACE_FILE = 'workspace.json';
const ACTIONS_FILE = 'actions.json';
const DEFAULT_IGNORE = ['node_modules', '.git', 'reports'];
const VARIABLES_FILE = 'variables.json';
const ENV_FILE = '.env';
const SHARED_STEPS_FILE = 'sharedSteps.json';
const PAGES_DIR = 'pages';
const TESTS_DIR = 'tests';
const ENDPOINTS_DIR = 'endpoints';
const API_BASES_DIR = 'apiBases';
const ENV_VAR_PREFIX = 'TESTBLOX_VAR__';
const ENV_PATTERN_PREFIX = 'TESTBLOX_VAR_PATTERN__';
const ENV_NAME_PREFIX = 'TESTBLOX_VAR_NAME__';
const ENV_ID_PREFIX = 'TESTBLOX_VAR_ID__';

function genId() {
  return require('crypto').randomUUID();
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function readJsonSafe(filePath, defaultValue = null) {
  try {
    if (!fs.existsSync(filePath)) return defaultValue;
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('readJsonSafe', filePath, e);
    return defaultValue;
  }
}

function writeJsonAtomic(filePath, data) {
  const dir = path.dirname(filePath);
  ensureDir(dir);
  const tmpPath = filePath + '.' + Date.now() + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpPath, filePath);
}

function getPaths(rootPath) {
  const base = path.join(rootPath, TESTBLOX_DIR);
  return {
    base,
    workspace: path.join(base, WORKSPACE_FILE),
    actions: path.join(base, ACTIONS_FILE),
    variables: path.join(base, VARIABLES_FILE),
    sharedSteps: path.join(base, SHARED_STEPS_FILE),
    pagesDir: path.join(rootPath, PAGES_DIR),
    testsDir: path.join(rootPath, TESTS_DIR),
    endpointsDir: path.join(rootPath, ENDPOINTS_DIR),
    apiBasesDir: path.join(rootPath, API_BASES_DIR),
  };
}

/** UUID-shaped ids from genId() / crypto.randomUUID() */
const ENTITY_ID_RE = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

function assertValidEntityId(id) {
  if (!id || typeof id !== 'string' || !ENTITY_ID_RE.test(id)) {
    throw new Error('Invalid entity id');
  }
}

/**
 * Remove `{id}.json` under parentDir if it lies inside resolved parentDir.
 * @returns {boolean} true if file existed and was removed
 */
function safeUnlinkJsonInDir(parentDir, id) {
  assertValidEntityId(id);
  const resolvedParent = path.resolve(parentDir);
  const filePath = path.resolve(path.join(resolvedParent, `${id}.json`));
  const rel = path.relative(resolvedParent, filePath);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('Invalid path');
  }
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}

function testReferencesPage(test, pageId) {
  if (!test || typeof test !== 'object') return false;
  if (test.pageId === pageId) return true;
  for (const s of test.steps || []) {
    if (s && typeof s === 'object' && s.pageId === pageId) return true;
  }
  return false;
}

function isApiStep(step) {
  if (!step || typeof step !== 'object') return false;
  return step.type === 'api' || step.type === 'request' || step.type === 'assertStatus' || step.type === 'assertBody';
}

function inferTestTypeFromSteps(test) {
  const steps = Array.isArray(test?.steps) ? test.steps : [];
  if (steps.length === 0) {
    const fallback = String(test?.type || 'ui').toLowerCase();
    return fallback === 'api' || fallback === 'hybrid' ? fallback : 'ui';
  }

  let hasApi = false;
  let hasUi = false;
  for (const step of steps) {
    if (isApiStep(step)) hasApi = true;
    else hasUi = true;
    if (hasApi && hasUi) return 'hybrid';
  }
  if (hasApi) return 'api';
  if (hasUi) return 'ui';
  const fallback = String(test?.type || 'ui').toLowerCase();
  return fallback === 'api' || fallback === 'hybrid' ? fallback : 'ui';
}

function initWorkspace(rootPath, title = 'My Workspace') {
  const p = getPaths(rootPath);
  ensureDir(p.base);
  ensureDir(p.pagesDir);
  ensureDir(p.testsDir);
  ensureDir(p.endpointsDir);
  ensureDir(p.apiBasesDir);

  const viewports = DEFAULT_VIEWPORTS.map((v, i) => ({
    id: genId(),
    title: v.title,
    width: v.width,
    height: v.height,
    createdAt: new Date().toISOString(),
  }));

  const workspace = {
    id: genId(),
    title,
    description: null,
    viewports,
    defaultViewportId: viewports[0]?.id || null,
    ignore: DEFAULT_IGNORE.slice(),
    createdAt: new Date().toISOString(),
  };
  writeJsonAtomic(p.workspace, workspace);

  const actions = PREDEFINED_ACTIONS.map((a, i) => ({
    id: genId(),
    name: a.name,
    withValue: a.withValue,
  }));
  writeJsonAtomic(p.actions, { actions });
  writeJsonAtomic(p.sharedSteps, { sharedSteps: [] });

  const envPath = getEnvPath(rootPath);
  if (!fs.existsSync(envPath)) fs.writeFileSync(envPath, '# TestBlox variables\n', 'utf8');

  const gitignorePath = path.join(rootPath, '.gitignore');
  try {
    let content = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';
    if (content && !content.includes('reports/')) content += '\nreports/\n';
    else if (!content.trim()) content = 'reports/\n';
    if (!content.includes('.env')) content += '\n.env\n';
    if (!content.includes('.env.local')) content += '\n.env.local\n';
    if (content.trim()) fs.writeFileSync(gitignorePath, content, 'utf8');
  } catch (_) {}

  return workspace;
}

function readWorkspaceMeta(rootPath) {
  const p = getPaths(rootPath);
  const workspace = readJsonSafe(p.workspace);
  if (!workspace) return null;
  return workspace;
}

/**
 * Return list of directory names to ignore when traversing the workspace (e.g. clone, export).
 * @param {string} rootPath
 * @returns {string[]}
 */
function getWorkspaceIgnore(rootPath) {
  const workspace = readWorkspaceMeta(rootPath);
  if (!workspace || !Array.isArray(workspace.ignore)) return DEFAULT_IGNORE.slice();
  return workspace.ignore;
}

function writeWorkspaceMeta(rootPath, data) {
  const p = getPaths(rootPath);
  ensureDir(p.base);
  writeJsonAtomic(p.workspace, data);
}

/**
 * Path to .env file in workspace root.
 * @param {string} rootPath
 * @returns {string}
 */
function getEnvPath(rootPath) {
  return path.join(rootPath, ENV_FILE);
}

/**
 * Read .env file and return key-value object. Returns {} if file missing or empty.
 * @param {string} rootPath
 * @returns {Record<string, string>}
 */
function readEnvFile(rootPath) {
  const envPath = getEnvPath(rootPath);
  try {
    if (!fs.existsSync(envPath)) return {};
    const raw = fs.readFileSync(envPath, 'utf8');
    const { parse } = require('dotenv');
    return parse(raw) || {};
  } catch (e) {
    console.error('readEnvFile', envPath, e);
    return {};
  }
}

/**
 * Write .env file. Merges with existing: updates/adds keys from keyValueObj, removes keys in keysToRemove. Preserves other keys in .env.
 * @param {string} rootPath
 * @param {Record<string, string>} keyValueObj variable name -> value (only variables without pattern)
 * @param {string[]} [keysToRemove] variable names that were in .env but should be removed (e.g. deleted variables)
 */
function writeEnvFile(rootPath, keyValueObj, keysToRemove = []) {
  const envPath = getEnvPath(rootPath);
  const current = readEnvFile(rootPath);
  const next = { ...current };
  for (const k of keysToRemove) delete next[k];
  for (const [k, v] of Object.entries(keyValueObj)) next[k] = String(v);
  const lines = [];
  for (const [k, v] of Object.entries(next)) {
    if (/[\r\n"\\]/.test(v)) {
      const escaped = v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
      lines.push(`${k}="${escaped}"`);
    } else {
      lines.push(`${k}=${v}`);
    }
  }
  ensureDir(path.dirname(envPath));
  fs.writeFileSync(envPath, lines.join('\n') + (lines.length ? '\n' : ''), 'utf8');
}

function readActions(rootPath) {
  const p = getPaths(rootPath);
  const obj = readJsonSafe(p.actions, { actions: [] });
  if (obj.actions && obj.actions.length > 0) return obj.actions;
  return PREDEFINED_ACTIONS.map((a) => ({
    id: genId(),
    name: a.name,
    withValue: a.withValue,
  }));
}

function encodeVarNameKey(name) {
  return Buffer.from(String(name), 'utf8').toString('hex').toUpperCase();
}

function decodeVarNameKey(encoded) {
  try {
    return Buffer.from(String(encoded), 'hex').toString('utf8');
  } catch {
    return null;
  }
}

function extractEnvVariables(envObj) {
  const byEncoded = new Map();
  for (const [k, v] of Object.entries(envObj || {})) {
    if (k.startsWith(ENV_ID_PREFIX)) {
      const encoded = k.slice(ENV_ID_PREFIX.length);
      const entry = byEncoded.get(encoded) || {};
      entry.id = String(v);
      byEncoded.set(encoded, entry);
      continue;
    }
    if (k.startsWith(ENV_NAME_PREFIX)) {
      const encoded = k.slice(ENV_NAME_PREFIX.length);
      const entry = byEncoded.get(encoded) || {};
      entry.name = String(v);
      byEncoded.set(encoded, entry);
      continue;
    }
    if (k.startsWith(ENV_VAR_PREFIX)) {
      const encoded = k.slice(ENV_VAR_PREFIX.length);
      const entry = byEncoded.get(encoded) || {};
      entry.value = String(v);
      byEncoded.set(encoded, entry);
      continue;
    }
    if (k.startsWith(ENV_PATTERN_PREFIX)) {
      const encoded = k.slice(ENV_PATTERN_PREFIX.length);
      const entry = byEncoded.get(encoded) || {};
      entry.valuePattern = String(v);
      byEncoded.set(encoded, entry);
    }
  }
  const out = [];
  for (const [encoded, entry] of byEncoded.entries()) {
    const fallbackName = decodeVarNameKey(encoded);
    const name = entry.name || fallbackName;
    if (!name || String(name).trim() === '') continue;
    out.push({
      id: entry.id && ENTITY_ID_RE.test(entry.id) ? entry.id : genId(),
      name: String(name).trim(),
      valuePattern:
        entry.valuePattern != null && String(entry.valuePattern).trim() !== ''
          ? String(entry.valuePattern).trim()
          : undefined,
      value: entry.value != null ? String(entry.value) : '',
    });
  }
  return out;
}

function readVariables(rootPath) {
  const p = getPaths(rootPath);
  const envObj = readEnvFile(rootPath);
  const envBacked = extractEnvVariables(envObj);
  if (envBacked.length > 0) return envBacked;

  // Legacy fallback: metadata in variables.json + plain name keys in .env.
  const obj = readJsonSafe(p.variables, { variables: [] });
  const list = Array.isArray(obj.variables) ? obj.variables : [];
  return list
    .filter((v) => v && v.name != null && String(v.name).trim() !== '')
    .map((v) => {
      const name = String(v.name).trim();
      const hasPattern = v.valuePattern != null && String(v.valuePattern).trim() !== '';
      const def = { id: v.id || genId(), name, valuePattern: hasPattern ? String(v.valuePattern).trim() : undefined };
      if (hasPattern) return { ...def, value: '' };
      const value = envObj[name] != null ? String(envObj[name]) : (v.value != null ? String(v.value) : '');
      return { ...def, value };
    });
}

function writeVariables(rootPath, variables) {
  const p = getPaths(rootPath);
  ensureDir(p.base);
  const envPath = getEnvPath(rootPath);
  if (!fs.existsSync(envPath)) fs.writeFileSync(envPath, '# TestBlox variables\n', 'utf8');

  const currentEnv = readEnvFile(rootPath);
  const keysToRemove = Object.keys(currentEnv).filter(
    (k) =>
      k.startsWith(ENV_VAR_PREFIX) ||
      k.startsWith(ENV_PATTERN_PREFIX) ||
      k.startsWith(ENV_NAME_PREFIX) ||
      k.startsWith(ENV_ID_PREFIX)
  );

  const nextEnvEntries = {};
  const normalized = (Array.isArray(variables) ? variables : [])
    .filter((v) => v && v.name != null && String(v.name).trim() !== '')
    .map((v) => ({
      id: v.id || genId(),
      name: String(v.name).trim(),
      valuePattern: v.valuePattern != null && String(v.valuePattern).trim() !== '' ? String(v.valuePattern).trim() : undefined,
      value: v.value != null ? String(v.value) : '',
    }));

  normalized.forEach((v) => {
    const encoded = encodeVarNameKey(v.name);
    nextEnvEntries[`${ENV_ID_PREFIX}${encoded}`] = v.id;
    nextEnvEntries[`${ENV_NAME_PREFIX}${encoded}`] = v.name;
    if (v.valuePattern) {
      nextEnvEntries[`${ENV_PATTERN_PREFIX}${encoded}`] = v.valuePattern;
    } else {
      nextEnvEntries[`${ENV_VAR_PREFIX}${encoded}`] = v.value || '';
    }
  });

  writeEnvFile(rootPath, nextEnvEntries, keysToRemove);
  return readVariables(rootPath);
}

function listSharedSteps(rootPath) {
  const p = getPaths(rootPath);
  const obj = readJsonSafe(p.sharedSteps, { sharedSteps: [] });
  return Array.isArray(obj.sharedSteps) ? obj.sharedSteps : [];
}

function readSharedStep(rootPath, sharedStepId) {
  const list = listSharedSteps(rootPath);
  return list.find((s) => s.id === sharedStepId) || null;
}

function writeSharedSteps(rootPath, sharedSteps) {
  const p = getPaths(rootPath);
  ensureDir(p.base);
  writeJsonAtomic(p.sharedSteps, { sharedSteps: Array.isArray(sharedSteps) ? sharedSteps : [] });
  return sharedSteps;
}

function createSharedStep(rootPath, data) {
  const list = listSharedSteps(rootPath);
  const step = {
    id: genId(),
    title: data.title || 'New shared step',
    steps: Array.isArray(data.steps) ? data.steps : [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  list.push(step);
  writeSharedSteps(rootPath, list);
  return step;
}

function updateSharedStep(rootPath, sharedStepId, data) {
  const list = listSharedSteps(rootPath);
  const idx = list.findIndex((s) => s.id === sharedStepId);
  if (idx < 0) return null;
  if (data.title !== undefined) list[idx].title = data.title;
  if (Array.isArray(data.steps)) list[idx].steps = data.steps;
  list[idx].updatedAt = new Date().toISOString();
  writeSharedSteps(rootPath, list);
  return list[idx];
}

function deleteSharedStep(rootPath, sharedStepId) {
  const list = listSharedSteps(rootPath).filter((s) => s.id !== sharedStepId);
  writeSharedSteps(rootPath, list);
  return true;
}

function listPages(rootPath) {
  const p = getPaths(rootPath);
  if (!fs.existsSync(p.pagesDir)) return [];
  const files = fs.readdirSync(p.pagesDir).filter((f) => f.endsWith('.json'));
  const pages = [];
  for (const f of files) {
    const page = readJsonSafe(path.join(p.pagesDir, f));
    if (page && !page.deleted) pages.push(page);
  }
  return pages;
}

function readPage(rootPath, pageId) {
  const p = getPaths(rootPath);
  const filePath = path.join(p.pagesDir, pageId + '.json');
  return readJsonSafe(filePath);
}

function writePage(rootPath, page) {
  const p = getPaths(rootPath);
  ensureDir(p.pagesDir);
  const filePath = path.join(p.pagesDir, page.id + '.json');
  page.updatedAt = new Date().toISOString();
  writeJsonAtomic(filePath, page);
  return page;
}

function createPage(rootPath, data) {
  const workspace = readWorkspaceMeta(rootPath);
  if (!workspace) throw new Error('Workspace not initialized');
  const viewportId = data.viewportId || workspace.defaultViewportId || workspace.viewports?.[0]?.id;
  const viewport = workspace.viewports?.find((v) => v.id === viewportId) || workspace.viewports?.[0];
  const page = {
    id: genId(),
    title: data.title || 'New Page',
    url: data.url || '',
    viewportId: viewport?.id || viewportId,
    viewport: viewport || { id: viewportId, title: 'Desktop', width: 1920, height: 1080 },
    webElements: [],
    folders: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deleted: false,
  };
  writePage(rootPath, page);
  return page;
}

function updatePage(rootPath, pageId, data) {
  const page = readPage(rootPath, pageId);
  if (!page) return null;
  if (data.title !== undefined) page.title = data.title;
  if (data.url !== undefined) page.url = data.url;
  if (data.viewportId !== undefined) {
    const workspace = readWorkspaceMeta(rootPath);
    const v = workspace?.viewports?.find((x) => x.id === data.viewportId);
    page.viewportId = data.viewportId;
    if (v) page.viewport = v;
  }
  if (Array.isArray(data.webElements)) page.webElements = data.webElements;
  if (!Array.isArray(page.webElements)) page.webElements = [];
  writePage(rootPath, page);
  return page;
}

function deletePage(rootPath, pageId) {
  assertValidEntityId(pageId);
  const page = readPage(rootPath, pageId);
  if (!page) return null;
  const p = getPaths(rootPath);
  if (fs.existsSync(p.testsDir)) {
    const files = fs.readdirSync(p.testsDir).filter((f) => f.endsWith('.json'));
    for (const f of files) {
      const tid = f.replace(/\.json$/i, '');
      if (!ENTITY_ID_RE.test(tid)) continue;
      const test = readJsonSafe(path.join(p.testsDir, f));
      if (!testReferencesPage(test, pageId)) continue;
      safeUnlinkJsonInDir(p.testsDir, tid);
    }
  }
  safeUnlinkJsonInDir(p.pagesDir, pageId);
  return page;
}

function listTests(rootPath, pageOrOptions = null) {
  const options =
    pageOrOptions && typeof pageOrOptions === 'object' && !Array.isArray(pageOrOptions)
      ? pageOrOptions
      : { pageId: pageOrOptions };
  const pageId = options.pageId ?? null;
  const titleQuery = options.titleQuery != null ? String(options.titleQuery).trim().toLowerCase() : '';
  const typeFilter = options.type != null ? String(options.type).trim().toLowerCase() : '';
  const limit = Number.isFinite(Number(options.limit)) ? Math.max(0, Number(options.limit)) : null;
  const offset = Number.isFinite(Number(options.offset)) ? Math.max(0, Number(options.offset)) : 0;
  const fieldsMode = options.fields != null ? String(options.fields).trim().toLowerCase() : '';
  const idsOnly = fieldsMode === 'id' || fieldsMode === 'ids' || options.onlyIds === true;

  const p = getPaths(rootPath);
  if (!fs.existsSync(p.testsDir)) return [];
  const files = fs.readdirSync(p.testsDir).filter((f) => f.endsWith('.json'));
  let pageWebElementIds = null;
  if (pageId != null) {
    const page = readPage(rootPath, pageId);
    if (!page) return [];
    pageWebElementIds = (page.webElements || []).map((e) => e.id);
  }
  const tests = [];
  for (const f of files) {
    const test = readJsonSafe(path.join(p.testsDir, f));
    if (!test || test.deleted) continue;
    const effectiveType = inferTestTypeFromSteps(test);
    if (typeFilter && effectiveType !== typeFilter) continue;
    if (titleQuery && !String(test.title || '').toLowerCase().includes(titleQuery)) continue;
    const normalized = { ...test, type: effectiveType };
    if (pageId == null) {
      tests.push(normalized);
    } else {
      const stepElementIds = (test.steps || []).map((s) => s.webElementId).filter(Boolean);
      if (stepElementIds.some((id) => pageWebElementIds.includes(id))) tests.push(normalized);
    }
  }
  const sliced =
    !offset && (limit == null || limit <= 0)
      ? tests
      : (limit != null && limit >= 0 ? tests.slice(offset, offset + limit) : tests.slice(offset));
  if (!idsOnly) return sliced;
  return sliced.map((t) => ({ id: t.id }));
}

function readTest(rootPath, testId) {
  const p = getPaths(rootPath);
  const filePath = path.join(p.testsDir, testId + '.json');
  return readJsonSafe(filePath);
}

function writeTest(rootPath, test) {
  const p = getPaths(rootPath);
  ensureDir(p.testsDir);
  const filePath = path.join(p.testsDir, test.id + '.json');
  test.updatedAt = new Date().toISOString();
  writeJsonAtomic(filePath, test);
  return test;
}

function createTest(rootPath, data) {
  const test = {
    id: genId(),
    title: data.title || 'New Test',
    type: data.type || 'ui',
    pageId: data.pageId ?? null,
    steps: [],
    folderId: data.folderId || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deleted: false,
    isRunning: false,
  };
  writeTest(rootPath, test);
  return test;
}

function updateTest(rootPath, testId, data) {
  const test = readTest(rootPath, testId);
  if (!test) return null;
  if (data.title !== undefined) test.title = data.title;
  if (data.type !== undefined) test.type = data.type;
  if (data.pageId !== undefined) test.pageId = data.pageId;
  if (data.folderId !== undefined) test.folderId = data.folderId;
  if (Array.isArray(data.steps)) test.steps = data.steps;
  writeTest(rootPath, test);
  return test;
}

function deleteTest(rootPath, testId) {
  assertValidEntityId(testId);
  const test = readTest(rootPath, testId);
  if (!test) return null;
  const p = getPaths(rootPath);
  safeUnlinkJsonInDir(p.testsDir, testId);
  return test;
}

/**
 * Build a stable JSON string for a test (excluding id, createdAt, updatedAt) for duplicate detection.
 */
function testSignature(test) {
  const obj = {
    title: test.title || '',
    type: test.type || 'ui',
    pageId: test.pageId ?? null,
    folderId: test.folderId ?? null,
    steps: (test.steps || []).map((step) => {
      const keys = Object.keys(step).sort();
      const sorted = {};
      for (const k of keys) sorted[k] = step[k];
      return sorted;
    }),
  };
  return JSON.stringify(obj);
}

/**
 * Find groups of duplicate tests (same title, type, pageId, steps). Returns array of groups; each group is array of test objects.
 */
function findDuplicateTests(rootPath) {
  const tests = listTests(rootPath);
  const bySignature = new Map();
  for (const test of tests) {
    const sig = testSignature(test);
    if (!bySignature.has(sig)) bySignature.set(sig, []);
    bySignature.get(sig).push(test);
  }
  return [...bySignature.values()].filter((group) => group.length > 1);
}

function listBases(rootPath) {
  const p = getPaths(rootPath);
  if (!fs.existsSync(p.apiBasesDir)) return [];
  const files = fs.readdirSync(p.apiBasesDir).filter((f) => f.endsWith('.json'));
  const list = [];
  for (const f of files) {
    const base = readJsonSafe(path.join(p.apiBasesDir, f));
    if (base && !base.deleted) list.push(base);
  }
  return list;
}

function readBase(rootPath, baseId) {
  const p = getPaths(rootPath);
  const filePath = path.join(p.apiBasesDir, baseId + '.json');
  return readJsonSafe(filePath);
}

function writeBase(rootPath, base) {
  const p = getPaths(rootPath);
  ensureDir(p.apiBasesDir);
  const filePath = path.join(p.apiBasesDir, base.id + '.json');
  base.updatedAt = new Date().toISOString();
  writeJsonAtomic(filePath, base);
  return base;
}

function createBase(rootPath, data) {
  const base = {
    id: genId(),
    title: data.title || 'New API Base',
    baseUrl: data.baseUrl || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deleted: false,
  };
  writeBase(rootPath, base);
  return base;
}

function updateBase(rootPath, baseId, data) {
  const base = readBase(rootPath, baseId);
  if (!base) return null;
  if (data.title !== undefined) base.title = data.title;
  if (data.baseUrl !== undefined) base.baseUrl = data.baseUrl;
  writeBase(rootPath, base);
  return base;
}

function deleteBase(rootPath, baseId) {
  assertValidEntityId(baseId);
  const base = readBase(rootPath, baseId);
  if (!base) return null;
  const p = getPaths(rootPath);
  if (fs.existsSync(p.endpointsDir)) {
    const files = fs.readdirSync(p.endpointsDir).filter((f) => f.endsWith('.json'));
    for (const f of files) {
      const ep = readJsonSafe(path.join(p.endpointsDir, f));
      if (!ep || ep.baseId !== baseId || !ep.id || !ENTITY_ID_RE.test(ep.id)) continue;
      safeUnlinkJsonInDir(p.endpointsDir, ep.id);
    }
  }
  safeUnlinkJsonInDir(p.apiBasesDir, baseId);
  return base;
}

function listEndpoints(rootPath, baseId = null) {
  const p = getPaths(rootPath);
  if (!fs.existsSync(p.endpointsDir)) return [];
  const files = fs.readdirSync(p.endpointsDir).filter((f) => f.endsWith('.json'));
  const list = [];
  for (const f of files) {
    const ep = readJsonSafe(path.join(p.endpointsDir, f));
    if (ep && !ep.deleted && (baseId == null || ep.baseId === baseId)) list.push(ep);
  }
  return list;
}

function normalizeEndpointBody(ep) {
  if (!ep) return ep;
  let bodyMode = ep.bodyMode;
  let body = ep.body;
  if (!bodyMode && ep.requestBody != null && ep.requestBody !== '') {
    bodyMode = 'raw';
    body = body !== undefined && body !== null ? body : ep.requestBody;
  }
  if (!bodyMode) bodyMode = 'none';
  return { ...ep, bodyMode, body };
}

function readEndpoint(rootPath, endpointId) {
  const p = getPaths(rootPath);
  const filePath = path.join(p.endpointsDir, endpointId + '.json');
  const ep = readJsonSafe(filePath);
  return ep ? normalizeEndpointBody(ep) : null;
}

function writeEndpoint(rootPath, endpoint) {
  const p = getPaths(rootPath);
  ensureDir(p.endpointsDir);
  const filePath = path.join(p.endpointsDir, endpoint.id + '.json');
  endpoint.updatedAt = new Date().toISOString();
  writeJsonAtomic(filePath, endpoint);
  return endpoint;
}

function createEndpoint(rootPath, data) {
  const endpoint = {
    id: genId(),
    title: data.title || 'New Endpoint',
    method: (data.method || 'GET').toUpperCase(),
    path: data.path || '/',
    summary: data.summary || '',
    baseId: data.baseId ?? null,
    baseUrl: data.baseUrl || '',
    requestBody: data.requestBody || null,
    bodyMode: data.bodyMode || 'none',
    body: data.body !== undefined ? data.body : null,
    parameters: data.parameters || [],
    headers: data.headers && typeof data.headers === 'object' ? data.headers : {},
    auth: data.auth && typeof data.auth === 'object' ? data.auth : null,
    responses: data.responses || {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deleted: false,
  };
  writeEndpoint(rootPath, endpoint);
  return endpoint;
}

function updateEndpoint(rootPath, endpointId, data) {
  const endpoint = readEndpoint(rootPath, endpointId);
  if (!endpoint) return null;
  if (data.title !== undefined) endpoint.title = data.title;
  if (data.method !== undefined) endpoint.method = (data.method || 'GET').toUpperCase();
  if (data.path !== undefined) endpoint.path = data.path;
  if (data.summary !== undefined) endpoint.summary = data.summary;
  if (data.baseId !== undefined) endpoint.baseId = data.baseId;
  if (data.baseUrl !== undefined) endpoint.baseUrl = data.baseUrl;
  if (data.requestBody !== undefined) endpoint.requestBody = data.requestBody;
  if (data.bodyMode !== undefined) endpoint.bodyMode = data.bodyMode;
  if (data.body !== undefined) endpoint.body = data.body;
  if (Array.isArray(data.parameters)) endpoint.parameters = data.parameters;
  if (data.headers !== undefined) endpoint.headers = data.headers && typeof data.headers === 'object' ? data.headers : {};
  if (data.auth !== undefined) endpoint.auth = data.auth && typeof data.auth === 'object' ? data.auth : null;
  if (data.responses !== undefined) endpoint.responses = data.responses;
  writeEndpoint(rootPath, endpoint);
  return endpoint;
}

function deleteEndpoint(rootPath, endpointId) {
  assertValidEntityId(endpointId);
  const endpoint = readEndpoint(rootPath, endpointId);
  if (!endpoint) return null;
  const p = getPaths(rootPath);
  safeUnlinkJsonInDir(p.endpointsDir, endpointId);
  return endpoint;
}

/**
 * Remove JSON files that were soft-deleted (deleted: true). One-time cleanup for workspaces before hard-delete migration.
 * @returns {{ pages: number, tests: number, apiBases: number, endpoints: number }}
 */
function pruneSoftDeletedEntities(rootPath) {
  const p = getPaths(rootPath);
  const counts = { pages: 0, tests: 0, apiBases: 0, endpoints: 0 };

  function pruneDir(dirPath, key) {
    if (!fs.existsSync(dirPath)) return;
    for (const f of fs.readdirSync(dirPath).filter((x) => x.endsWith('.json'))) {
      const id = f.slice(0, -5);
      if (!ENTITY_ID_RE.test(id)) continue;
      const data = readJsonSafe(path.join(dirPath, f));
      if (data && data.deleted === true) {
        try {
          if (safeUnlinkJsonInDir(dirPath, id)) counts[key] += 1;
        } catch (_) {}
      }
    }
  }

  pruneDir(p.pagesDir, 'pages');
  pruneDir(p.testsDir, 'tests');
  pruneDir(p.apiBasesDir, 'apiBases');
  pruneDir(p.endpointsDir, 'endpoints');
  return counts;
}

function isWorkspace(rootPath) {
  const p = getPaths(rootPath);
  return fs.existsSync(p.workspace);
}

module.exports = {
  getPaths,
  getEnvPath,
  readEnvFile,
  writeEnvFile,
  initWorkspace,
  readWorkspaceMeta,
  writeWorkspaceMeta,
  getWorkspaceIgnore,
  readActions,
  readVariables,
  writeVariables,
  listSharedSteps,
  readSharedStep,
  writeSharedSteps,
  createSharedStep,
  updateSharedStep,
  deleteSharedStep,
  listPages,
  readPage,
  writePage,
  createPage,
  updatePage,
  deletePage,
  listBases,
  readBase,
  writeBase,
  createBase,
  updateBase,
  deleteBase,
  listEndpoints,
  readEndpoint,
  writeEndpoint,
  createEndpoint,
  updateEndpoint,
  deleteEndpoint,
  listTests,
  readTest,
  writeTest,
  createTest,
  updateTest,
  deleteTest,
  findDuplicateTests,
  pruneSoftDeletedEntities,
  isWorkspace,
  genId,
};
