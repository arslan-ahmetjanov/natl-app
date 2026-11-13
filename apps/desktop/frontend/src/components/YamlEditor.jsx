import { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { yaml } from '@codemirror/lang-yaml';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView } from '@codemirror/view';

/**
 * YAML editor with syntax highlighting.
 *
 * The scenario is a file, so the editor is plain text — but NATL has structure
 * worth seeing: keys, verbs, selectors, strings. Highlighting is the cheapest
 * way to make a 20-line scenario readable without adding a form over every field.
 */
export default function YamlEditor({ value, onChange, dark = true, height = '100%' }) {
  const extensions = useMemo(() => [yaml(), EditorView.lineWrapping], []);

  const theme = useMemo(() => {
    const base = dark ? oneDark : [];
    const sizing = EditorView.theme({
      '&': { height, fontSize: '13px', backgroundColor: 'transparent' },
      '.cm-scroller': {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
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
