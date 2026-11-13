'use strict';

/**
 * AI step generation.
 *
 * The model is not trusted: its answer is parsed, every step is checked against
 * the verbs the language actually has, and only then the renderer sees it. A
 * step that fails the check never reaches the file.
 */

/** Verbs a generated step may use, and what each one requires. */
const STEP_RULES = {
  goto: { needs: [] },
  click: { needs: [] },
  fill: { needs: ['with'] },
  select: { needs: ['with'] },
  check: { needs: [] },
  uncheck: { needs: [] },
  wait: { needs: [] },
  assert: { needs: [] },
  get: { needs: [] },
  post: { needs: [] },
  put: { needs: [] },
  patch: { needs: [] },
  delete: { needs: [] },
  log: { needs: [] },
};

const SYSTEM_PROMPT = [
  'Ты пишешь шаги UI-тестов для языка NATL (YAML).',
  'Отвечай только JSON: {"steps": [...], "notes": "короткое пояснение"}.',
  'Разрешённые шаги и их поля:',
  '- {goto: "<url или $base_url>"}',
  '- {click: "<css>"}',
  '- {fill: "<css>", with: "<значение>"}',
  '- {select: "<css>", with: "<значение>"}',
  '- {check: "<css>"}, {uncheck: "<css>"}',
  '- {wait: "<css>", state: "visible|hidden|attached|detached"}',
  '- {assert: "<css>", text: "<текст>"} или {assert: "<css>", visible: true}',
  '- {get|post|put|patch|delete: "<url>", save: "<имя>"}',
  '- {log: "<сообщение>"}',
  'Правила: селекторы — CSS, предпочитай [data-testid=...] и #id; без markdown, без комментариев,',
  'без лишних полей. Если по описанию нельзя понять селектор, верни пустой steps и объясни в notes.',
].join('\n');

/** Pull JSON out of a model reply: fenced blocks and prose happen. */
function parseModelReply(text) {
  const raw = String(text || '').trim();
  if (!raw) throw new Error('модель вернула пустой ответ');

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw;

  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1));
    }
    throw new Error('в ответе модели нет JSON');
  }
}

/** @returns {{ ok: true, step: object } | { ok: false, reason: string }} */
function validateStep(step) {
  if (!step || typeof step !== 'object' || Array.isArray(step)) {
    return { ok: false, reason: 'шаг не объект' };
  }
  const verbs = Object.keys(step).filter((key) => key in STEP_RULES);
  if (verbs.length !== 1) {
    return { ok: false, reason: `ожидался один глагол, получено: ${Object.keys(step).join(', ') || 'ничего'}` };
  }

  const verb = verbs[0];
  const value = step[verb];
  if (typeof value !== 'string' || !value.trim()) {
    return { ok: false, reason: `${verb}: нужен непустой селектор или адрес` };
  }
  for (const field of STEP_RULES[verb].needs) {
    if (typeof step[field] !== 'string') {
      return { ok: false, reason: `${verb}: нет поля ${field}` };
    }
  }
  return { ok: true, step };
}

/**
 * @param {object} input
 * @param {string} input.content Model reply text.
 * @returns {{ steps: object[], notes: string, rejected: Array<{ step: unknown, reason: string }> }}
 */
function normalizeReply(content) {
  const parsed = parseModelReply(content);
  const rawSteps = Array.isArray(parsed.steps) ? parsed.steps : [];
  const steps = [];
  const rejected = [];

  for (const raw of rawSteps) {
    const result = validateStep(raw);
    if (result.ok) steps.push(result.step);
    else rejected.push({ step: raw, reason: result.reason });
  }

  return {
    steps,
    notes: typeof parsed.notes === 'string' ? parsed.notes : '',
    rejected,
  };
}

async function callModel({ config, prompt }) {
  const base = String(config.apiBaseUrl || 'https://openrouter.ai/api/v1').replace(/\/+$/, '');
  const model = config.modelName || 'openai/gpt-4o-mini';

  const response = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`LLM ${response.status}: ${body.slice(0, 200)}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('модель вернула ответ без содержания');
  return content;
}

async function generateSteps({ description, currentYaml, config }) {
  const text = String(description || '').trim();
  if (text.length < 5) throw new Error('Опишите, что нужно проверить');
  if (!config || !config.apiKey) throw new Error('Не настроен ключ LLM. Откройте настройки ИИ.');

  const prompt = [
    `Что проверить: ${text}`,
    currentYaml ? `Текущий сценарий:\n${String(currentYaml).slice(0, 2000)}` : '',
    'Верни только новые шаги, которые нужно добавить в конец.',
  ]
    .filter(Boolean)
    .join('\n\n');

  const content = await callModel({ config, prompt });
  return normalizeReply(content);
}

module.exports = {
  STEP_RULES,
  SYSTEM_PROMPT,
  parseModelReply,
  validateStep,
  normalizeReply,
  generateSteps,
};
