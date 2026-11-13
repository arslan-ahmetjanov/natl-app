'use strict';

const path = require('node:path');

const store = require('./store');
const { runScenario, assertInsideWorkspace } = require('./run');

/**
 * Агент для работы с тестами: чат, у которого есть инструменты.
 *
 * Это тот же цикл, что у кодинг-агентов: модель просит вызвать инструмент,
 * приложение выполняет его в пределах рабочей папки, результат возвращается
 * модели. Харнесс можно заменить на Mastra или headless-агент — контракт
 * остаётся: сообщения на входе, текст и список вызовов на выходе.
 */

const MAX_TURNS = 6;

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'list_scenarios',
      description: 'Список файлов сценариев в рабочей папке',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_scenario',
      description: 'Прочитать YAML сценария по относительному пути',
      parameters: {
        type: 'object',
        properties: { relativePath: { type: 'string' } },
        required: ['relativePath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_scenario',
      description: 'Записать YAML сценария по относительному пути',
      parameters: {
        type: 'object',
        properties: {
          relativePath: { type: 'string' },
          yaml: { type: 'string' },
        },
        required: ['relativePath', 'yaml'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_scenario',
      description: 'Запустить сценарий и получить статус и шаги',
      parameters: {
        type: 'object',
        properties: { relativePath: { type: 'string' } },
        required: ['relativePath'],
      },
    },
  },
];

const SYSTEM_PROMPT = [
  'Ты агент по тестам NATL. Рабочая папка пользователя — его проект.',
  'Ты можешь читать и писать сценарии в папке tests/ и запускать их.',
  'Сценарий — YAML: name, engine, vars, steps. Шаги: goto, click, fill+with, select+with,',
  'check, uncheck, wait, assert (text | visible | hidden), get/post/put/patch/delete+save, log.',
  'Правила: не выдумывай селекторы — если не знаешь, спроси; не меняй файлы вне tests/;',
  'после изменений предложи запустить сценарий и покажи результат. Отвечай по-русски, коротко.',
].join('\n');

function toolByName(name) {
  return TOOLS.find((tool) => tool.function.name === name);
}

/** Выполнение одного вызова инструмента в пределах рабочей папки. */
async function executeTool({ name, args, root }) {
  if (!toolByName(name)) return { ok: false, error: `неизвестный инструмент: ${name}` };

  try {
    if (name === 'list_scenarios') {
      const dir = store.testsDir(root);
      const files = store.listScenarios(dir).map((file) =>
        path.relative(root, file).split(path.sep).join('/'),
      );
      return { ok: true, result: files };
    }

    if (name === 'read_scenario') {
      const resolved = assertInsideWorkspace(root, path.join(root, String(args.relativePath || '')));
      const read = store.readScenario(resolved);
      return read.error ? { ok: false, error: read.error } : { ok: true, result: read.text };
    }

    if (name === 'write_scenario') {
      const resolved = assertInsideWorkspace(root, path.join(root, String(args.relativePath || '')));
      if (!store.isScenarioFile(resolved)) return { ok: false, error: 'это не файл сценария' };
      store.writeScenario(resolved, String(args.yaml || ''));
      return { ok: true, result: 'записано' };
    }

    if (name === 'run_scenario') {
      const resolved = assertInsideWorkspace(root, path.join(root, String(args.relativePath || '')));
      const result = await runScenario({ root, file: resolved, headless: true });
      return {
        ok: true,
        result: {
          ok: result.ok,
          error: result.error || null,
          durationMs: result.durationMs,
          steps: (result.steps || []).map((step) => ({
            name: step.name,
            ok: step.ok,
            error: step.error || null,
          })),
        },
      };
    }

    return { ok: false, error: 'инструмент не реализован' };
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : String(err) };
  }
}

async function callModel({ config, messages, tools }) {
  const base = String(config.apiBaseUrl || 'https://openrouter.ai/api/v1').replace(/\/+$/, '');
  const response = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.modelName || 'openai/gpt-4o-mini',
      temperature: 0,
      messages,
      tools,
      tool_choice: 'auto',
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`LLM ${response.status}: ${body.slice(0, 200)}`);
  }
  const data = await response.json();
  return data?.choices?.[0]?.message;
}

/**
 * @param {object} input
 * @param {Array<{role: string, content: string}>} input.messages
 * @param {string} input.root
 * @param {object} input.config
 * @returns {Promise<{ reply: string, calls: Array<{ name: string, args: object, ok: boolean, error?: string }> }>}
 */
async function chat({ messages, root, config }) {
  if (!config || !config.apiKey) throw new Error('Не настроен ключ LLM. Откройте настройки ИИ.');

  const history = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages.map((message) => ({ role: message.role, content: message.content })),
  ];
  const calls = [];

  for (let turn = 0; turn < MAX_TURNS; turn += 1) {
    const message = await callModel({ config, messages: history, tools: TOOLS });
    if (!message) throw new Error('модель вернула пустой ответ');

    const toolCalls = message.tool_calls || [];
    if (toolCalls.length === 0) {
      return { reply: message.content || '', calls };
    }

    history.push({ role: 'assistant', content: message.content || '', tool_calls: toolCalls });

    for (const call of toolCalls) {
      let args = {};
      try {
        args = JSON.parse(call.function.arguments || '{}');
      } catch {
        args = {};
      }
      const result = await executeTool({ name: call.function.name, args, root });
      calls.push({ name: call.function.name, args, ok: result.ok, error: result.error });

      history.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(result.ok ? result.result : { error: result.error }),
      });
    }
  }

  return { reply: 'Не удалось завершить за отведённое число шагов. Уточните задачу.', calls };
}

module.exports = { chat, executeTool, TOOLS, SYSTEM_PROMPT, MAX_TURNS };
