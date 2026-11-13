const fs = require('fs');
const path = require('path');

const DEFAULT_LLM_API_BASE_URL = 'https://api.vsegpt.ru/v1';

function getArg(prefix) {
  const raw = process.argv.find((x) => x.startsWith(`${prefix}=`));
  return raw ? raw.slice(prefix.length + 1) : null;
}

const flavorArg = getArg('--flavor');
const llmUrlArg = getArg('--llm-url');

const flavor = (flavorArg || process.env.TESTBLOX_BUILD_FLAVOR || 'default').trim().toLowerCase();
const llmApiBaseUrl = (llmUrlArg || process.env.TESTBLOX_BUILD_LLM_API_BASE_URL || DEFAULT_LLM_API_BASE_URL).trim();

const outputPath = path.join(__dirname, '..', 'electron', 'config', 'buildConfig.json');
const outputDir = path.dirname(outputPath);

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const buildConfig = {
  flavor: flavor === 'custom' ? 'custom' : 'default',
  llmApiBaseUrl,
};

fs.writeFileSync(outputPath, JSON.stringify(buildConfig, null, 2), 'utf8');
console.log('Build config written:', outputPath);
