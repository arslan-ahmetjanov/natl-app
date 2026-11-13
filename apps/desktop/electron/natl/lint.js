'use strict';

const { parse } = require('yaml');

/**
 * Проверка сценария до запуска.
 *
 * Задача — поймать то, что всё равно упадёт: неизвестный глагол, `fill` без
 * значения, пустой шаг. Это дешевле, чем запускать браузер и ждать ошибку.
 */

const VERBS = new Set([
  'goto', 'click', 'tap', 'fill', 'select', 'check', 'uncheck', 'wait',
  'assert', 'screenshot', 'get', 'post', 'put', 'patch', 'delete', 'log',
  'set', 'scroll', 'swipe', 'long_press', 'do', 'include', 'if', 'for',
  'repeat', 'parallel', 'with',
]);

const NEEDS_VALUE = new Set(['fill', 'select']);

/**
 * @param {string} text YAML сценария
 * @returns {{ ok: boolean, issues: Array<{ severity: string, message: string, action?: string }> }}
 */
function lintYaml(text) {
  const issues = [];

  if (!String(text || '').trim()) {
    return { ok: false, issues: [{ severity: 'error', message: 'Сценарий пустой' }] };
  }

  let doc;
  try {
    doc = parse(text);
  } catch (err) {
    return {
      ok: false,
      issues: [{ severity: 'error', message: `YAML не разбирается: ${err.message || err}` }],
    };
  }

  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    return { ok: false, issues: [{ severity: 'error', message: 'Ожидался объект с полями сценария' }] };
  }

  if (!doc.name) issues.push({ severity: 'warning', message: 'Нет поля name — в отчёте будет имя файла' });
  if (!doc.steps && !doc.actions) {
    issues.push({ severity: 'error', message: 'Нет ни steps, ни actions' });
  }

  const steps = Array.isArray(doc.steps) ? doc.steps : [];
  steps.forEach((step, index) => {
    const place = `шаг ${index + 1}`;
    if (!step || typeof step !== 'object' || Array.isArray(step)) {
      issues.push({ severity: 'error', message: `${place}: ожидался объект`, action: place });
      return;
    }
    const verbs = Object.keys(step);
    if (verbs.length === 0) {
      issues.push({ severity: 'error', message: `${place}: пустой шаг`, action: place });
      return;
    }
    for (const verb of verbs) {
      if (!VERBS.has(verb)) {
        issues.push({
          severity: 'warning',
          message: `${place}: неизвестный глагол «${verb}»`,
          action: place,
        });
      }
      if (NEEDS_VALUE.has(verb) && (step.with === undefined || step.with === '')) {
        issues.push({
          severity: 'error',
          message: `${place}: у «${verb}» нет значения with`,
          action: place,
        });
      }
      if (typeof step[verb] !== 'string' && verb !== 'wait' && verb !== 'assert' && verb !== 'screenshot') {
        issues.push({
          severity: 'warning',
          message: `${place}: «${verb}» ожидает строку с селектором`,
          action: place,
        });
      }
    }
  });

  const actions = doc.actions && typeof doc.actions === 'object' ? doc.actions : {};
  for (const [name, list] of Object.entries(actions)) {
    if (!Array.isArray(list)) {
      issues.push({ severity: 'error', message: `действие «${name}»: ожидался список шагов` });
    }
  }

  return { ok: issues.every((issue) => issue.severity !== 'error'), issues };
}

module.exports = { lintYaml, VERBS };
