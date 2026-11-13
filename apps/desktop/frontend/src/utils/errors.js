/**
 * Человеческие тексты ошибок.
 *
 * Внутри живут длинные технические сообщения Playwright, Node и IPC.
 * Пользователю нужно другое: что случилось, где и что сделать.
 * Исходный текст не выбрасываем — он остаётся в журнале.
 */

const ACTIONS = {
  click: 'нажать',
  dblclick: 'нажать дважды',
  fill: 'ввести текст',
  type: 'ввести текст',
  check: 'поставить отметку',
  uncheck: 'снять отметку',
  selectOption: 'выбрать значение',
  hover: 'навести курсор',
  waitFor: 'дождаться элемента',
  tap: 'нажать',
};

function seconds(ms) {
  const value = Math.round(Number(ms) / 100) / 10;
  return Number.isFinite(value) ? value : null;
}

function selectorFrom(text) {
  const match = text.match(/waiting for (?:locator|selector)\((['"`])(.+?)\1\)/i);
  return match ? match[2] : null;
}

/**
 * @param {unknown} raw исходное сообщение
 * @param {{ selector?: string, file?: string }} [context]
 * @returns {string}
 */
export function humanizeError(raw, context = {}) {
  let text = String(raw ?? '').trim();
  if (!text) return 'Неизвестная ошибка';

  // Обёртка IPC: "Error invoking remote method 'x': Error: ..."
  text = text.replace(/^Error invoking remote method '[^']+':\s*/i, '');
  text = text.replace(/^(Uncaught\s+)?Error:\s*/i, '');

  // Таймаут действия Playwright
  const timeout = text.match(/locator\.(\w+):\s*Timeout (\d+)ms exceeded/i)
    || text.match(/page\.(\w+):\s*Timeout (\d+)ms exceeded/i);
  if (timeout) {
    const action = ACTIONS[timeout[1]] || 'выполнить действие';
    const selector = selectorFrom(text) || context.selector;
    const wait = seconds(timeout[2]);
    return [
      `Не удалось ${action}${selector ? ` на ${selector}` : ''}: элемент не появился за ${wait} с.`,
      'Проверьте селектор и что страница успела загрузиться.',
    ].join(' ');
  }

  // Строгий режим: селектор нашёл несколько элементов
  if (/strict mode violation/i.test(text)) {
    const selector = selectorFrom(text) || context.selector;
    return `Селектор${selector ? ` ${selector}` : ''} нашёл несколько элементов. Уточните селектор: добавьте data-testid или nth-of-type.`;
  }

  // Сеть
  const netError = text.match(/net::(ERR_[A-Z_]+)/);
  if (netError) {
    const map = {
      ERR_NAME_NOT_RESOLVED: 'Домен не найден. Проверьте адрес.',
      ERR_CONNECTION_REFUSED: 'Сервер отказал в соединении. Он запущен?',
      ERR_CONNECTION_TIMED_OUT: 'Сервер не ответил вовремя.',
      ERR_INTERNET_DISCONNECTED: 'Нет подключения к интернету.',
      ERR_CERT_AUTHORITY_INVALID: 'Сертификат сайта не принят. Проверьте окружение.',
      ERR_ABORTED: 'Запрос прерван — страница успела перейти дальше.',
    };
    return map[netError[1]] || `Сетевая ошибка ${netError[1]}. Проверьте адрес и доступность сервера.`;
  }
  if (/ECONNREFUSED/.test(text)) return 'Сервер отказал в соединении. Проверьте, что он запущен и порт верный.';
  if (/ENOTFOUND|EAI_AGAIN/.test(text)) return 'Домен не найден. Проверьте адрес.';

  // Файлы
  if (/ENOENT/.test(text)) {
    const file = context.file || (text.match(/'([^']+)'/) || [])[1];
    return `Файл не найден${file ? `: ${file}` : ''}. Возможно, он перемещён или удалён.`;
  }
  if (/EACCES|EPERM/.test(text)) {
    return 'Нет доступа к файлу. Закройте его в другой программе или проверьте права.';
  }
  if (/outside the workspace/i.test(text)) {
    return 'Путь ведёт за пределы рабочей папки. Приложение работает только внутри неё.';
  }

  // YAML
  if (/Missing closing ["']quote/i.test(text)) {
    return 'Незакрытая кавычка в YAML. Проверьте строку, на которую указывает редактор.';
  }
  if (/YAML не разбирается|YAMLParseError|bad indentation/i.test(text)) {
    return 'YAML не разбирается: проверьте отступы и кавычки.';
  }

  // LLM и ключи
  if (/Не настроен ключ LLM/i.test(text)) {
    return 'Ключ модели не настроен. Откройте «Настройки» и укажите ключ API.';
  }
  const http = text.match(/LLM (\d{3})/);
  if (http) {
    const code = Number(http[1]);
    if (code === 401 || code === 403) return 'Модель отклонила ключ. Проверьте ключ и права доступа.';
    if (code === 429) return 'Слишком много запросов к модели. Подождите минуту и повторите.';
    if (code >= 500) return 'Сервис модели недоступен. Попробуйте позже или смените модель.';
    return `Модель вернула ошибку ${code}. Проверьте настройки.`;
  }

  // Прочее из приложения
  if (/No workspace opened/i.test(text)) return 'Рабочая папка не открыта. Откройте папку проекта.';
  if (/Test not found/i.test(text)) return 'Тест не найден. Возможно, файл переименован или удалён.';
  if (/Запись не запущена/i.test(text)) return 'Запись не запущена: нажмите «Записать» и попробуйте снова.';

  // Убираем служебные хвосты, если ничего не совпало
  return text
    .replace(/\s*Call log:[\s\S]*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Строка шага с человеческой ошибкой. */
export function humanizeStep(step, context = {}) {
  if (!step) return step;
  if (!step.error) return step;
  return { ...step, error: humanizeError(step.error, context) };
}
