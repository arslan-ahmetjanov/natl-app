import Parser from 'web-tree-sitter';
import treeSitterWasmUrl from 'web-tree-sitter/tree-sitter.wasm?url';
import treeSitterBashWasmUrl from 'curlconverter/dist/tree-sitter-bash.wasm?url';

await Parser.init({
  locateFile(scriptName) {
    if (scriptName === 'tree-sitter.wasm') return treeSitterWasmUrl;
    return scriptName;
  },
});

const Bash = await Parser.Language.load(treeSitterBashWasmUrl);
const parser = new Parser();
parser.setLanguage(Bash);

export default parser;
