import { parse } from 'yaml';

/**
 * Перевод сценария на человеческий язык.
 *
 * Файл остаётся источником истины, но человеку, который не пишет код, нужен
 * не YAML, а фразы: «нажать на кнопку Войти», «проверить, что видно приветствие».
 */

function target(value) {
  const text = String(value ?? '').trim();
  if (!text) return 'элемент';
  if (text.startsWith('#')) return `элемент ${text.slice(1)}`;
  return text;
}

const VERBS = {
  goto: (step) => `Открыть ${step.goto}`,
  click: (step) => `Нажать на ${target(step.click)}`,
  tap: (step) => `Нажать на ${target(step.tap)}`,
  fill: (step) => `Ввести «${step.with ?? ''}» в ${target(step.fill)}`,
  select: (step) => `Выбрать «${step.with ?? ''}» в ${target(step.select)}`,
  check: (step) => `Поставить отметку в ${target(step.check)}`,
  uncheck: (step) => `Снять отметку в ${target(step.uncheck)}`,
  wait: (step) => {
    if (typeof step.wait === 'number') return `Подождать ${step.wait} мс`;
    if (step.state === 'hidden') return `Дождаться, пока исчезнет ${target(step.wait)}`;
    return `Дождаться ${target(step.wait)}`;
  },
  assert: (step) => {
    if (step.text) return `Проверить, что в ${target(step.assert)} текст «${step.text}»`;
    if (step.contains) return `Проверить, что в ${target(step.assert)} есть «${step.contains}»`;
    if (step.hidden) return `Проверить, что ${target(step.assert)} скрыт`;
    if (step.visible) return `Проверить, что видно ${target(step.assert)}`;
    if (typeof step.assert === 'string') return `Проверить: ${step.assert}`;
    return 'Проверить условие';
  },
  get: (step) => `Запросить ${step.get} и запомнить ответ как ${step.save || 'ответ'}`,
  post: (step) => `Отправить данные на ${step.post}`,
  put: (step) => `Обновить данные на ${step.put}`,
  patch: (step) => `Изменить данные на ${step.patch}`,
  delete: (step) => `Удалить данные на ${step.delete}`,
  log: (step) => `Записать в журнал: ${typeof step.log === 'string' ? step.log : 'сообщение'}`,
  screenshot: () => 'Сделать снимок экрана',
};

/**
 * @param {string} text YAML сценария
 * @returns {{ name: string, items: Array<{ index: number, text: string }>, error: string | null }}
 */
export function describeScenario(text) {
  let doc;
  try {
    doc = parse(text || '');
  } catch (err) {
    return { name: '', items: [], error: err.message || String(err) };
  }
  if (!doc || typeof doc !== 'object') {
    return { name: '', items: [], error: null };
  }

  const steps = Array.isArray(doc.steps) ? doc.steps : [];
  const items = steps.map((step, index) => {
    if (!step || typeof step !== 'object') {
      return { index: index + 1, text: 'Неизвестный шаг' };
    }
    const verb = Object.keys(step).find((key) => key in VERBS);
    if (!verb) {
      return { index: index + 1, text: `Шаг без описания: ${Object.keys(step).join(', ')}` };
    }
    return { index: index + 1, text: VERBS[verb](step) };
  });

  return { name: doc.name || 'Сценарий', items, error: null };
}
