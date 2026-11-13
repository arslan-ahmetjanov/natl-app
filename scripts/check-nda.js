'use strict';

/**
 * Проверка репозитория на следы NDA: названия работодателя, внутренние домены,
 * служебные почты и типичные маркеры внутренних систем.
 *
 * Запуск: node scripts/check-nda.js
 * Выход: 1, если найдено хоть одно совпадение.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

const FORBIDDEN = [
  { pattern: /совкомбанк/gi, label: 'название работодателя' },
  { pattern: /sovcombank/gi, label: 'название работодателя' },
  { pattern: /\bsovcom\b/gi, label: 'сокращение работодателя' },
  { pattern: /\.corp\b/gi, label: 'внутренний домен' },
  { pattern: /\.internal\b/gi, label: 'внутренний домен' },
  { pattern: /тестовый контур компании/gi, label: 'внутренняя формулировка' },
  { pattern: /служебн\w+ тайн/gi, label: 'маркер служебной информации' },
  { pattern: /confidential/gi, label: 'маркер конфиденциальности' },
  { pattern: /@sovcom/gi, label: 'служебная почта' },
];

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'renderer',
  'artifacts',
  '_backup',
  'coverage',
]);

const TEXT_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.json', '.md', '.yml', '.yaml',
  '.html', '.css', '.txt', '.svg', '.xml', '.example',
]);

const SKIP_FILES = new Set([path.join(ROOT, 'scripts', 'check-nda.js')]);

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (SKIP_FILES.has(full)) continue;
    else if (TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase()) || entry.name === 'LICENSE') {
      files.push(full);
    }
  }
  return files;
}

const findings = [];

for (const file of walk(ROOT)) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  const lines = text.split('\n');
  lines.forEach((line, index) => {
    for (const rule of FORBIDDEN) {
      rule.pattern.lastIndex = 0;
      if (rule.pattern.test(line)) {
        findings.push({
          file: path.relative(ROOT, file),
          line: index + 1,
          label: rule.label,
          text: line.trim().slice(0, 160),
        });
      }
    }
  });
}

if (findings.length === 0) {
  console.log('Следов NDA не найдено.');
  process.exit(0);
}

console.error(`Найдено совпадений: ${findings.length}`);
for (const item of findings) {
  console.error(`  ${item.file}:${item.line} — ${item.label}: ${item.text}`);
}
process.exit(1);
