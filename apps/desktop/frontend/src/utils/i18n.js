/**
 * Переводы интерфейса.
 *
 * Практичный слой: словарь русских фраз и замены на английский и китайский.
 * Работает поверх готовых экранов, переводит текстовые узлы и подписи полей.
 * Новые компоненты могут использовать t() напрямую.
 */

const EN = {
  'Записать': 'Record',
  'Открыть папку': 'Open folder',
  'Клонировать репозиторий': 'Clone repository',
  'Создать проект': 'Create project',
  'Из архива': 'From archive',
  'Недавние папки': 'Recent folders',
  'Проверяйте поведение приложения, а не код': 'Check behavior, not code',
  'Запишите путь руками — получите YAML-тест в своём репозитории. Откройте папку проекта или начните с новой.':
    'Record a path by hand and get a YAML test in your repository. Open a project folder or start a new one.',
  'Здесь появятся папки, которые вы открывали.': 'Folders you open will appear here.',
  'Сценарии — файлы в вашем репозитории': 'Scenarios are files in your repository',
  'Обзор': 'Overview',
  'Сценарии': 'Scenarios',
  'Окружение': 'Environment',
  'Журнал': 'Logs',
  'Настройки': 'Settings',
  'Настройки ИИ': 'AI settings',
  'Тёмная тема': 'Dark theme',
  'Светлая тема': 'Light theme',
  'Закрыть рабочую папку': 'Close workspace',
  'Открыть другую папку': 'Open another folder',
  'Свернуть меню': 'Collapse menu',
  'Развернуть меню': 'Expand menu',
  'Открыть ИИ-агента': 'Open AI agent',
  'Свернуть чат': 'Collapse chat',
  'Открыть в терминале': 'Open terminal',
  'Поиск': 'Search',
  'Ничего не найдено.': 'Nothing found.',
  'Рабочая папка': 'Workspace',
  'Сценариев': 'Scenarios',
  'С ошибкой': 'With errors',
  'Последнее изменение': 'Last change',
  'YAML-файлов в tests/': 'YAML files in tests/',
  'не читаются или битые': 'unreadable or broken',
  'Записать сценарий': 'Record a scenario',
  'Пройдите путь в браузере — NATL сохранит YAML в проект.':
    'Walk the path in a browser — NATL saves YAML into the project.',
  'Открыть сценарий': 'Open a scenario',
  'Посмотреть шаги на русском, поправить и запустить прогон.':
    'Read the steps in plain language, edit and run.',
  'Последние сценарии': 'Recent scenarios',
  'Все сценарии': 'All scenarios',
  'Пока нет ни одного сценария. Начните с записи.': 'No scenarios yet. Start by recording.',
  'Название': 'Name',
  'Файл': 'File',
  'Изменён': 'Changed',
  'Открыть': 'Open',
  'Проверка до запуска': 'Pre-run check',
  'проверено': 'checked',
  'Понятно': 'Plain',
  'YAML': 'YAML',
  'Шаг': 'Step',
  'Прогон': 'Run',
  'Кадры': 'Frames',
  'Скриншоты прогона': 'Run screenshots',
  'Отчёт': 'Report',
  'Прогонов ещё не было. Нажмите Run или Ctrl+R.': 'No runs yet. Press Run or Ctrl+R.',
  'Запуск заблокирован: исправьте ошибки в сценарии. Нажмите на счётчик проверки, чтобы увидеть список.':
    'Run is blocked: fix errors first. Click the check counter to see the list.',
  'Проверка сценария': 'Scenario check',
  'Замечаний нет.': 'No issues.',
  'Свернуть отчёт': 'Collapse report',
  'Развернуть отчёт': 'Expand report',
  'Показывать окно браузера при прогоне': 'Show the browser window during a run',
  'С окном': 'Headed',
  'Переименовать': 'Rename',
  'Удалить сценарий': 'Delete scenario',
  'Переименовать сценарий': 'Rename scenario',
  'Удалить сценарий?': 'Delete scenario?',
  'Имя файла': 'File name',
  'Отмена': 'Cancel',
  'Удалить': 'Delete',
  'Сохранить': 'Save',
  'Очистить скриншоты': 'Clean screenshots',
  'Прогонов в папке artifacts:': 'Runs in artifacts:',
  'файлов:': 'files:',
  'всего': 'total',
  'Удаляются кадры и трассы всех прогонов рабочей папки.':
    'Frames and traces of all runs in the workspace will be removed.',
  'Сохранение…': 'Saving…',
  'Сохранено': 'Saved',
  'ИИ-агент': 'AI agent',
  'Опишите задачу обычными словами. Агент посмотрит файлы, предложит правку и сможет запустить прогон.':
    'Describe the task in plain words. The agent will inspect files, suggest edits and can run scenarios.',
  'Что сделать с тестами?': 'What should happen with the tests?',
  'Отправить': 'Send',
  'Агент думает…': 'Agent is thinking…',
  'Вы': 'You',
  'Агент': 'Agent',
  'Локаторы': 'Locators',
  'Действия': 'Actions',
  'Добавить локатор': 'Add locator',
  'Добавить действие': 'Add action',
  'Новое действие': 'New action',
  'В сценарий': 'To scenario',
  'Имя': 'Name',
  'Стратегия': 'Strategy',
  'Селектор': 'Selector',
  'Локаторы и действия будут доступны всем сценариям.':
    'Locators and actions will be available to every scenario.',
  'Удалить файл ресурсов': 'Delete resource file',
  'Удалить файл ресурсов?': 'Delete resource file?',
  'Переименовать файл': 'Rename file',
  'Переименовать файл ресурсов': 'Rename resource file',
  'Обновить': 'Refresh',
  'Создать файл ресурсов': 'Create resource file',
  'Добавить шаг': 'Add step',
  'Изменить шаг': 'Edit step',
  'Действие': 'Action',
  'Значение': 'Value',
  'Ожидаемый текст': 'Expected text',
  'Сообщение': 'Message',
  'Адрес страницы': 'Page URL',
  'Адрес запроса': 'Request URL',
  'Сохранить ответ как': 'Save response as',
  'Добавить запрос': 'Add request',
  'Добавить': 'Add',
  'Наверх': 'Up',
  'Вниз': 'Down',
  'Издатель': 'Publisher',
  'Настройки обновлений недоступны.': 'Update settings are unavailable.',
  'Автоматически проверять и скачивать': 'Check and download automatically',
  'Канал': 'Channel',
  'Скачивать сразу после проверки': 'Download right after checking',
  'Проверить сейчас': 'Check now',
  'Проверяем…': 'Checking…',
  'Установить и перезапустить': 'Install and restart',
  'Проверка ещё не запускалась': 'Not checked yet',
  'Проверяем обновления…': 'Checking for updates…',
  'Доступна новая версия': 'A new version is available',
  'Скачиваем обновление…': 'Downloading update…',
  'Обновление готово к установке': 'Update is ready',
  'Обновлений нет': 'No updates',
  'Ошибка обновления': 'Update error',
  'Модель': 'Model',
  'Ключ API': 'API key',
  'Адрес API': 'API URL',
  'Ключ уже сохранён': 'Key is saved',
  'ИИ': 'AI',
  'Обновления': 'Updates',
  'Журнал приложения': 'Application log',
  'Уровни': 'Levels',
  'Все': 'All',
  'Очистить': 'Clear',
  'Копировать': 'Copy',
  'Скопировано': 'Copied',
  'Открыть файл': 'Open file',
  'Сохранить в файл': 'Save to file',
  'Журнал сохранён:': 'Log saved:',
  'Не удалось сохранить журнал:': 'Could not save the log:',
  'Есть предыдущая версия': 'A previous version exists',
  'Восстановить': 'Restore',
  'Восстановить предыдущую версию?': 'Restore the previous version?',
  'предыдущая версия': 'previous version',
  'Есть предыдущая версия — её можно восстановить на экране сценария':
    'A previous version exists — restore it on the scenario screen',
  'Проверка файлов': 'File check',
  'Записей нет. Если что-то сломалось — вернитесь сюда после ошибки.':
    'No entries. If something broke, come back here after the error.',
  'Понятно, больше не показывать': 'Got it, do not show again',
  'Больше не показывать': 'Do not show again',
  'Как это работает': 'How it works',
  'Ясно': 'Got it',
  'Браузер': 'Browser',
  'Браузер для записи': 'Recording browser',
  'Скачать браузер': 'Download browser',
  'Проверить': 'Check',
  'Повторить': 'Retry',
  'Продолжить': 'Continue',
  'Скачан': 'Installed',
  'Не скачан': 'not installed',
  'Проверяем браузер…': 'Checking the browser…',
  'Браузер готов.': 'Browser is ready.',
  'Статус браузера недоступен.': 'Browser status is unavailable.',
  'Chromium для записи и прогона. Около 280 МБ, скачивается один раз.':
    'Chromium for recording and runs. About 280 MB, downloaded once.',
  'около 280 МБ, один раз': 'about 280 MB, once',
  'Готовим загрузку…': 'Preparing the download…',
};

const ZH = {
  'Записать': '录制',
  'Открыть папку': '打开文件夹',
  'Клонировать репозиторий': '克隆仓库',
  'Создать проект': '新建项目',
  'Из архива': '从压缩包导入',
  'Недавние папки': '最近的文件夹',
  'Проверяйте поведение приложения, а не код': '检查行为，而不是代码',
  'Сценарии': '场景',
  'Обзор': '概览',
  'Окружение': '环境',
  'Журнал': '日志',
  'Настройки': '设置',
  'Настройки ИИ': 'AI 设置',
  'Тёмная тема': '深色主题',
  'Светлая тема': '浅色主题',
  'Закрыть рабочую папку': '关闭工作区',
  'Открыть другую папку': '打开其他文件夹',
  'Открыть в терминале': '打开终端',
  'Поиск': '搜索',
  'Рабочая папка': '工作区',
  'Сценариев': '场景数',
  'С ошибкой': '有错误',
  'Последнее изменение': '最后修改',
  'Записать сценарий': '录制场景',
  'Открыть сценарий': '打开场景',
  'Последние сценарии': '最近的场景',
  'Все сценарии': '全部场景',
  'Название': '名称',
  'Файл': '文件',
  'Изменён': '修改时间',
  'Открыть': '打开',
  'Проверка до запуска': '运行前检查',
  'Понятно': '易懂',
  'Шаг': '步骤',
  'Прогон': '运行',
  'Кадры': '截图',
  'Отчёт': '报告',
  'Переименовать': '重命名',
  'Удалить сценарий': '删除场景',
  'Отмена': '取消',
  'Удалить': '删除',
  'Сохранить': '保存',
  'Сохранение…': '保存中…',
  'Сохранено': '已保存',
  'ИИ-агент': 'AI 助手',
  'Отправить': '发送',
  'Локаторы': '定位器',
  'Действия': '动作',
  'Добавить локатор': '添加定位器',
  'Добавить действие': '添加动作',
  'Добавить шаг': '添加步骤',
  'Действие': '动作',
  'Значение': '值',
  'Селектор': '选择器',
  'Имя': '名称',
  'Стратегия': '策略',
  'Обновить': '刷新',
  'Добавить': '添加',
  'Настройки обновлений недоступны.': '更新设置不可用。',
  'Канал': '通道',
  'Проверить сейчас': '立即检查',
  'Установить и перезапустить': '安装并重启',
  'Модель': '模型',
  'Ключ API': 'API 密钥',
  'Адрес API': 'API 地址',
  'ИИ': 'AI',
  'Обновления': '更新',
  'Все': '全部',
  'Очистить': '清空',
  'Копировать': '复制',
  'Скопировано': '已复制',
  'Открыть файл': '打开文件',
  'Сохранить в файл': '保存到文件',
  'Журнал сохранён:': '日志已保存：',
  'Не удалось сохранить журнал:': '无法保存日志：',
  'Есть предыдущая версия': '存在上一版本',
  'Восстановить': '恢复',
  'Восстановить предыдущую версию?': '恢复上一版本？',
  'предыдущая версия': '上一版本',
  'Есть предыдущая версия — её можно восстановить на экране сценария': '存在上一版本，可在场景页面恢复',
  'Проверка файлов': '文件检查',
  'Больше не показывать': '不再显示',
  'Как это работает': '工作原理',
  'Ясно': '明白',
  'Браузер': '浏览器',
  'Браузер для записи': '录制用浏览器',
  'Скачать браузер': '下载浏览器',
  'Проверить': '检查',
  'Повторить': '重试',
  'Продолжить': '继续',
  'Скачан': '已安装',
  'Не скачан': '未安装',
  'Проверяем браузер…': '正在检查浏览器…',
  'Браузер готов.': '浏览器已就绪。',
  'Статус браузера недоступен.': '无法获取浏览器状态。',
  'Chromium для записи и прогона. Около 280 МБ, скачивается один раз.':
    '用于录制和运行的 Chromium。约 280 MB，只需下载一次。',
  'около 280 МБ, один раз': '约 280 MB，仅一次',
  'Готовим загрузку…': '正在准备下载…',
};

const DICTS = { en: EN, ru: {}, zh: ZH };
const STORAGE_KEY = 'natl-lang';

let lang = 'ru';
const listeners = new Set();

export function getLang() {
  return lang;
}

export function setLang(next) {
  if (!DICTS[next]) return;
  lang = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* язык не критичен */
  }
  document.documentElement.setAttribute('lang', next);
  translateTree(document.body);
  listeners.forEach((fn) => fn(next));
}

export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function t(text) {
  if (lang === 'ru') return text;
  return DICTS[lang]?.[text] || text;
}

function translateTextNode(node) {
  const raw = node.nodeValue;
  if (!raw) return;
  const trimmed = raw.trim();
  if (!trimmed) return;
  const translated = DICTS[lang]?.[trimmed];
  if (!translated || translated === trimmed) return;
  node.nodeValue = raw.replace(trimmed, translated);
}

const ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];

function translateElement(element) {
  for (const attr of ATTRS) {
    const value = element.getAttribute?.(attr);
    if (!value) continue;
    const translated = DICTS[lang]?.[value.trim()];
    if (translated && translated !== value) element.setAttribute(attr, translated);
  }
  if (element.tagName === 'OPTION' && element.textContent) {
    const translated = DICTS[lang]?.[element.textContent.trim()];
    if (translated) element.textContent = translated;
  }
}

export function translateTree(root) {
  if (!root || lang === 'ru') return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(translateTextNode);

  const elements = root.querySelectorAll?.('*') || [];
  elements.forEach(translateElement);
  translateElement(root);
}

let observer = null;

export function initI18n() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && DICTS[stored]) lang = stored;
  } catch {
    /* по умолчанию русский */
  }
  document.documentElement.setAttribute('lang', lang);

  if (!observer) {
    let timer = null;
    observer = new MutationObserver(() => {
      if (lang === 'ru') return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => translateTree(document.body), 60);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  translateTree(document.body);
}

export const LANGS = [
  { id: 'ru', label: 'Русский' },
  { id: 'en', label: 'English' },
  { id: 'zh', label: '中文' },
];
