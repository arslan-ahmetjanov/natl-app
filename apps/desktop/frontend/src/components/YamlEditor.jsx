import { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { yaml } from '@codemirror/lang-yaml';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView } from '@codemirror/view';
import { autocompletion } from '@codemirror/autocomplete';

const ROOT_KEYS = [
  'name', 'engine', 'tags', 'timeout', 'retries', 'vars', 'secrets',
  'imports', 'cases', 'data', 'before_each', 'after_each', 'steps',
  'elements', 'actions', 'locator_strategy',
];

const VERBS = [
  'goto', 'click', 'fill', 'select', 'check', 'uncheck', 'wait', 'assert',
  'screenshot', 'get', 'post', 'put', 'patch', 'delete', 'log', 'set',
  'scroll', 'swipe', 'long_press', 'with', 'do', 'include', 'if', 'for', 'repeat',
];

const OPTIONS = [
  'with', 'text', 'contains', 'visible', 'hidden', 'attr', 'state', 'save',
  'timeout', 'soft', 'strategy', 'value', 'direction', 'into_view', 'file',
];

const VALUES = {
  engine: ['playwright', 'selenium', 'cypress', 'http'],
  state: ['visible', 'hidden', 'attached', 'detached'],
  locator_strategy: ['css', 'xpath'],
  browser: ['chromium', 'firefox', 'webkit'],
};

function natlCompletions(context) {
  const line = context.state.doc.lineAt(context.pos);
  const before = line.text.slice(0, context.pos - line.from);
  const trimmed = before.trimStart();

  // значение после ключа: engine: | state: | locator_strategy:
  const valueMatch = trimmed.match(/([a-z_]+):\s*([\w-]*)$/);
  if (valueMatch && VALUES[valueMatch[1]]) {
    const [, key, word] = valueMatch;
    return {
      from: context.pos - word.length,
      options: VALUES[key].map((value) => ({ label: value, type: 'keyword' })),
    };
  }

  // новый шаг списка: "- cl"
  const stepMatch = trimmed.match(/^-\s+([a-z_]*)$/);
  if (stepMatch) {
    const word = stepMatch[1];
    return {
      from: context.pos - word.length,
      options: VERBS.map((verb) => ({ label: verb, type: 'keyword' })),
    };
  }

  // ключи шага после глагола: "click: #btn" → следующая строка с "wi"
  const optionMatch = trimmed.match(/^([a-z_]+):\s*$/);
  if (optionMatch) {
    return {
      from: context.pos,
      options: OPTIONS.map((option) => ({ label: option, type: 'property' })),
    };
  }

  // корневые ключи в начале строки
  if (context.pos === line.from + (before.length - trimmed.length)) {
    return {
      from: line.from,
      options: ROOT_KEYS.map((key) => ({ label: `${key}:`, type: 'property' })),
    };
  }

  return null;
}

/**
 * YAML-редактор с подсветкой и подсказками NATL.
 *
 * Подсказки знают язык, а не только YAML: глаголы шагов, ключи опций,
 * допустимые значения движка и стратегии локатора.
 */
export default function YamlEditor({ value, onChange, dark = true, height = '100%' }) {
  const extensions = useMemo(
    () => [yaml(), EditorView.lineWrapping, autocompletion({ override: [natlCompletions], activateOnTyping: true })],
    [],
  );

  const theme = useMemo(() => {
    const base = dark ? oneDark : [];
    const sizing = EditorView.theme({
      '&': { height, fontSize: '13px', backgroundColor: 'transparent' },
      '.cm-scroller': {
        fontFamily: 'IBM Plex Mono, ui-monospace, Menlo, Consolas, monospace',
        lineHeight: '1.55',
      },
      '.cm-content': { padding: '12px 0' },
      '.cm-gutters': { backgroundColor: 'transparent', border: 'none' },
      '&.cm-focused': { outline: 'none' },
    });
    return Array.isArray(base) ? [...base, sizing] : [base, sizing];
  }, [dark, height]);

  return (
    <CodeMirror
      value={value}
      height={height}
      theme={theme}
      extensions={extensions}
      onChange={onChange}
      basicSetup={{
        lineNumbers: true,
        foldGutter: false,
        highlightActiveLine: true,
        highlightActiveLineGutter: false,
        autocompletion: false,
        bracketMatching: true,
        closeBrackets: false,
        searchKeymap: true,
      }}
      style={{ height: '100%' }}
    />
  );
}
