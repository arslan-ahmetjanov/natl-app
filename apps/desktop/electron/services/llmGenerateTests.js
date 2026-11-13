const llmConfig = require('../store/llmConfig');
const filestore = require('../store/filestore');
const { assertHttpsRequestUrl } = require('../utils/requireHttpsUrl');

/**
 * Call OpenRouter (or compatible) chat API with streaming, accumulate content, return full text.
 * @param {object} [options]
 * @param {(info: { phase: 'streaming', totalChars: number }) => void} [options.onStreamProgress] throttled stream updates
 */
async function streamChatCompletion(apiUrl, config, messages, options = {}) {
  const { response_format, onStreamProgress, temperature } = options;
  let lastProgressAt = 0;
  const emitProgress = (totalChars) => {
    if (typeof onStreamProgress !== 'function') return;
    const now = Date.now();
    if (now - lastProgressAt < 120 && totalChars % 512 !== 0) return;
    lastProgressAt = now;
    try {
      onStreamProgress({ phase: 'streaming', totalChars });
    } catch (_) {}
  };

  const body = {
    model: config.modelName,
    messages,
    temperature: temperature ?? 0.3,
    stream: true,
    ...(response_format && { response_format }),
  };
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LLM request failed: ${res.status} ${res.statusText}${errText ? ` - ${errText}` : ''}`);
  }
  let content = '';
  const decoder = new TextDecoder();
  const reader = res.body;
  if (!reader) throw new Error('No response body');
  let buffer = '';
  for await (const chunk of reader) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('data: ')) {
        const data = trimmed.slice(6);
        if (data === '[DONE]') continue;
        try {
          const obj = JSON.parse(data);
          const delta = obj.choices?.[0]?.delta?.content;
          if (typeof delta === 'string') {
            content += delta;
            emitProgress(content.length);
          }
        } catch (_) {}
      }
    }
  }
  if (buffer.trim().startsWith('data: ')) {
    const data = buffer.trim().slice(6);
    if (data !== '[DONE]') {
      try {
        const obj = JSON.parse(data);
        const delta = obj.choices?.[0]?.delta?.content;
        if (typeof delta === 'string') {
          content += delta;
          emitProgress(content.length);
        }
      } catch (_) {}
    }
  }
  return content;
}

/** Strip common ``` / ```json fences (models vary; do not rely on response_format alone). */
function stripMarkdownFences(text) {
  let s = String(text || '').trim();
  if (s.startsWith('```json')) s = s.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
  else if (s.startsWith('```')) s = s.replace(/^```\w*\s*/, '').replace(/\s*```$/, '');
  return s.trim();
}

/**
 * Extract first top-level JSON object by brace depth (handles leading/trailing prose from any model).
 */
function extractFirstJsonObject(text) {
  const s = String(text || '');
  const start = s.indexOf('{');
  if (start === -1) throw new Error('No JSON object found in model output');
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (c === '\\') escape = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  throw new Error('Unbalanced JSON braces in model output');
}

function parseLlmJsonObject(raw) {
  let s = stripMarkdownFences(raw);
  try {
    return JSON.parse(s);
  } catch (_) {
    const extracted = extractFirstJsonObject(s);
    return JSON.parse(extracted);
  }
}

/**
 * Prefer native JSON mode when the gateway supports it; retry once without (Qwen / Minimax / some
 * OpenRouter routes reject response_format while the model still follows instructions).
 */
async function streamChatCompletionJsonModePreferred(apiUrl, config, messages, streamOpts = {}) {
  const { onStreamProgress } = streamOpts;
  try {
    return await streamChatCompletion(apiUrl, config, messages, {
      response_format: { type: 'json_object' },
      onStreamProgress,
    });
  } catch (e1) {
    const m = `${e1 && e1.message ? e1.message : e1}`.toLowerCase();
    const retryWithoutFormat =
      /response_format|json_object|json mode|400|422|unsupported|unknown parameter|invalid_request/.test(m);
    if (!retryWithoutFormat) throw e1;
    return streamChatCompletion(apiUrl, config, messages, { onStreamProgress });
  }
}

const OUTPUT_CONTRACT = `
OUTPUT CONTRACT (follow exactly; works across OpenAI, Anthropic Claude, Google, Qwen, DeepSeek, MiniMax, and other chat APIs):
- Reply with ONE JSON object only. No prose before or after, in any language.
- After trimming whitespace, the first character MUST be "{" and the last MUST be "}".
- Do NOT use markdown code fences (no triple backticks).
- Use standard JSON: double-quoted keys and strings, valid escapes, no trailing commas, no comments.
- Invent no IDs: every webElementId, actionId, pageId, and endpointId MUST appear exactly as given in the user message payload.
`.trim();

const SYSTEM_PROMPT = `
You are a senior QA automation engineer. Generate 3–10 test scenarios that resemble realistic end-user flows for the page described in the user message.

The user message is JSON with fields elements[] and actions[] only (saved selectors and action definitions). It never contains raw HTML.

${OUTPUT_CONTRACT}

Scenario rules:
- Each scenario must have at least 2 steps that follow a sensible user order (e.g. focus or navigate before type; submit after fill when applicable).
- Prefer fewer, stronger scenarios over noisy one-step checks.
- For each step: set "value" to a concrete string only when the matching action has withValue true; otherwise use "".

Required root shape (fill "test_cases" only; no other top-level keys):
{
  "test_cases": [
    {
      "title": "Short scenario name",
      "steps": [
        {
          "webElementId": "id from Elements list",
          "actionId": "id from Actions list",
          "value": ""
        }
      ]
    }
  ]
}
`.trim();

const SYSTEM_PROMPT_SELECTION = `
You are a senior QA automation engineer. The user message is JSON with pages[], endpoints[], and actions[] only (structured fixtures). It never contains raw HTML, DOM snapshots, or full OpenAPI documents.

${OUTPUT_CONTRACT}

Input shape (for your reasoning; do not echo it back):
- pages: [ { pageId, title, elements: [ { id, title, selector } ] } ]
- endpoints: [ { id, method, path, summary } ]
- actions: [ { id, name, withValue } ]

Volume: produce 2–6 scenarios total across UI and API (fewer is fine if the inputs are small).

Required root shape — always include BOTH arrays (use [] when that side has no inputs):
{
  "ui_tests": [
    {
      "title": "Scenario name",
      "pageId": "pageId from pages",
      "steps": [
        {
          "webElementId": "element id from that page's elements",
          "actionId": "action id from actions",
          "pageId": "optional; default is the scenario pageId",
          "value": ""
        }
      ]
    }
  ],
  "api_tests": [
    {
      "title": "API scenario name",
      "steps": [
        { "type": "request", "endpointId": "id from endpoints", "body": "{}" },
        { "type": "assertStatus", "value": "200" },
        { "type": "assertBody", "jsonPath": "path", "value": "expected" }
      ]
    }
  ]
}

API step types you may use (only these strings for "type"): "request", "assertStatus", "assertBody".
- "request": include endpointId from endpoints; body is a JSON string (use "{}" or a minimal valid JSON object string when unknown).
- "assertStatus": value is HTTP status code as a string (e.g. "200", "201", "404").
- "assertBody": jsonPath is a simple dot path when possible; value is the expected scalar or stringified fragment; only assert what you can justify from endpoint summary/path.

If pages is empty: set "ui_tests" to []. If endpoints is empty: set "api_tests" to [].
`.trim();

function safeReport(reportProgress, payload) {
  if (typeof reportProgress !== 'function') return;
  try {
    reportProgress(payload);
  } catch (_) {}
}

async function generateTestsWithAI(userDataPath, workspacePath, pageId, customPrompt = null, reportProgress) {
  require('dotenv').config({
    path: require('path').join(workspacePath, '.env'),
    override: true,
  });
  const config = llmConfig.getEffectiveConfig(userDataPath, workspacePath);
  if (!llmConfig.isConfigValid(config)) {
    throw new Error('LLM configuration is not set. Configure in Settings (OpenRouter API key, model, URL).');
  }
  const page = filestore.readPage(workspacePath, pageId);
  if (!page) throw new Error('Page not found');
  const elements = (page.webElements || []).map((el) => ({
    id: el.id,
    title: el.title,
    selector: el.selector,
    type: el.type || 'element',
  }));
  const actions = filestore.readActions(workspacePath);
  const actionsPayload = actions.map((a) => ({ id: a.id, name: a.name, withValue: a.withValue }));

  safeReport(reportProgress, {
    phase: 'preparing',
    message: 'Building prompt from saved page elements (no HTML).',
    stats: { elements: elements.length, actions: actionsPayload.length },
  });

  let systemPrompt = SYSTEM_PROMPT;
  if (customPrompt && customPrompt.trim()) {
    systemPrompt += `\n\nAdditional instructions:\n${customPrompt.trim()}`;
  }
  const userPrompt = JSON.stringify({
    source: 'testblox_saved_fixtures',
    note: 'Only structured fields below are sent. Raw page HTML or DOM snapshots are never included.',
    pageId: page.id,
    pageTitle: page.title || '',
    pageUrl: page.url || '',
    elements,
    actions: actionsPayload,
  });
  const apiUrl = config.apiBaseUrl.endsWith('/chat/completions')
    ? config.apiBaseUrl
    : `${config.apiBaseUrl.replace(/\/$/, '')}/chat/completions`;
  assertHttpsRequestUrl(apiUrl, 'LLM API URL');

  safeReport(reportProgress, {
    phase: 'llm_request',
    message: 'Streaming from model (HTTP stream: true).',
    model: config.modelName,
  });

  let content = await streamChatCompletionJsonModePreferred(
    apiUrl,
    config,
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    {
      onStreamProgress: ({ totalChars }) =>
        safeReport(reportProgress, { phase: 'streaming', message: 'Receiving JSON from model…', totalChars }),
    }
  );
  if (!content) throw new Error('Empty response from LLM');
  safeReport(reportProgress, { phase: 'parsing', message: 'Parsing model JSON…' });
  const parsed = parseLlmJsonObject(content);
  if (!parsed.test_cases) throw new Error('Invalid response: missing test_cases');
  safeReport(reportProgress, { phase: 'done', ok: true });
  return parsed.test_cases;
}

async function generateFromSelection(userDataPath, workspacePath, options = {}, reportProgress) {
  require('dotenv').config({
    path: require('path').join(workspacePath, '.env'),
    override: true,
  });
  const { pageIds = [], endpointIds = [], customPrompt = '' } = options;
  const config = llmConfig.getEffectiveConfig(userDataPath, workspacePath);
  if (!llmConfig.isConfigValid(config)) {
    throw new Error('LLM configuration is not set. Configure in Settings (OpenRouter API key, model, URL).');
  }
  const pages = (pageIds || []).map((id) => {
    const p = filestore.readPage(workspacePath, id);
    return p
      ? {
          pageId: p.id,
          title: p.title,
          elements: (p.webElements || []).map((el) => ({
            id: el.id,
            title: el.title,
            selector: el.selector,
          })),
        }
      : null;
  }).filter(Boolean);
  const endpoints = (endpointIds || []).map((id) => {
    const ep = filestore.readEndpoint(workspacePath, id);
    return ep ? { id: ep.id, method: ep.method, path: ep.path, summary: ep.summary || ep.title } : null;
  }).filter(Boolean);
  const actions = filestore.readActions(workspacePath);
  const actionsPayload = actions.map((a) => ({ id: a.id, name: a.name, withValue: a.withValue }));

  if (pages.length === 0 && endpoints.length === 0) {
    throw new Error('Select at least one page or endpoint.');
  }

  const elementCount = pages.reduce((n, pg) => n + (pg.elements?.length || 0), 0);
  safeReport(reportProgress, {
    phase: 'preparing',
    message: 'Building prompt from saved elements and API metadata (no HTML).',
    stats: { pages: pages.length, elements: elementCount, endpoints: endpoints.length, actions: actionsPayload.length },
  });

  let systemPrompt = SYSTEM_PROMPT_SELECTION;
  if (customPrompt && customPrompt.trim()) {
    systemPrompt += `\n\nAdditional instructions:\n${customPrompt.trim()}`;
  }
  const userPrompt = JSON.stringify({
    source: 'testblox_saved_fixtures',
    note: 'Only structured fields below are sent. Raw page HTML, DOM snapshots, and OpenAPI raw documents are not included.',
    pages,
    endpoints,
    actions: actionsPayload,
  });
  const apiUrl = config.apiBaseUrl.endsWith('/chat/completions')
    ? config.apiBaseUrl
    : `${config.apiBaseUrl.replace(/\/$/, '')}/chat/completions`;
  assertHttpsRequestUrl(apiUrl, 'LLM API URL');

  safeReport(reportProgress, {
    phase: 'llm_request',
    message: 'Streaming from model (HTTP stream: true).',
    model: config.modelName,
  });

  let content = await streamChatCompletionJsonModePreferred(
    apiUrl,
    config,
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    {
      onStreamProgress: ({ totalChars }) =>
        safeReport(reportProgress, { phase: 'streaming', message: 'Receiving JSON from model…', totalChars }),
    }
  );
  if (!content) throw new Error('Empty response from LLM');
  safeReport(reportProgress, { phase: 'parsing', message: 'Parsing model JSON…' });
  const parsed = parseLlmJsonObject(content);
  const uiTests = Array.isArray(parsed.ui_tests) ? parsed.ui_tests : [];
  const apiTests = Array.isArray(parsed.api_tests) ? parsed.api_tests : [];
  const created = [];
  safeReport(reportProgress, {
    phase: 'saving',
    message: 'Writing tests to workspace…',
    counts: { uiTests: uiTests.length, apiTests: apiTests.length },
  });
  for (const t of uiTests) {
    const test = filestore.createTest(workspacePath, { title: t.title || 'UI Test', type: 'ui', pageId: t.pageId || pages[0]?.pageId });
    const steps = (t.steps || []).map((s) => ({ pageId: s.pageId || t.pageId, webElementId: s.webElementId, actionId: s.actionId, value: s.value ?? '' }));
    filestore.updateTest(workspacePath, test.id, { steps });
    created.push({ id: test.id, title: test.title, type: 'ui' });
  }
  for (const t of apiTests) {
    const test = filestore.createTest(workspacePath, { title: t.title || 'API Test', type: 'api', pageId: null });
    filestore.updateTest(workspacePath, test.id, { steps: t.steps || [] });
    created.push({ id: test.id, title: test.title, type: 'api' });
  }
  safeReport(reportProgress, { phase: 'done', ok: true, created: created.length });
  return created;
}

module.exports = { generateTestsWithAI, generateFromSelection };
