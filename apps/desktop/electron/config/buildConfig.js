const fs = require('fs');
const path = require('path');

const DEFAULT_CONFIG = {
  flavor: 'default',
  llmApiBaseUrl: 'https://openrouter.ai/api/v1',
};

function readBuildConfig() {
  const filePath = path.join(__dirname, 'buildConfig.json');
  try {
    if (!fs.existsSync(filePath)) return { ...DEFAULT_CONFIG };
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return {
      flavor: raw.flavor === 'custom' ? 'custom' : 'default',
      llmApiBaseUrl: typeof raw.llmApiBaseUrl === 'string' && raw.llmApiBaseUrl.trim()
        ? raw.llmApiBaseUrl.trim()
        : DEFAULT_CONFIG.llmApiBaseUrl,
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

module.exports = {
  readBuildConfig,
  DEFAULT_CONFIG,
};
