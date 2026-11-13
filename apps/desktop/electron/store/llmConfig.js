const fs = require('fs');
const path = require('path');
const { readBuildConfig } = require('../config/buildConfig');
const filestore = require('./filestore');

const LLM_FILENAME = 'llm.json';
const WORKSPACE_LLM = '.testblox/llm.json';
/** Workspace LLM secrets live in project root `.env` (gitignored), not in JSON. */
const ENV_LLM_API_KEY = 'TESTBLOX_LLM_API_KEY';
const ENV_LLM_MODEL = 'TESTBLOX_LLM_MODEL';

function readJsonSafe(filePath, defaultValue = null) {
  try {
    if (!fs.existsSync(filePath)) return defaultValue;
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return defaultValue;
  }
}

function writeJsonAtomic(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmpPath = filePath + '.' + Date.now() + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpPath, filePath);
}

/**
 * Global config path: app userData / llm.json (e.g. %APPDATA%/TestBlox/llm.json)
 */
function getGlobalConfigPath(userDataPath) {
  return path.join(userDataPath, LLM_FILENAME);
}

/**
 * Legacy path (pre-.env): workspaceRoot /.testblox/llm.json — read for migration only; secrets are not written here anymore.
 */
function getWorkspaceConfigPath(workspaceRoot) {
  return workspaceRoot ? path.join(workspaceRoot, WORKSPACE_LLM) : null;
}

function getGlobalConfig(userDataPath) {
  const buildConfig = readBuildConfig();
  const filePath = getGlobalConfigPath(userDataPath);
  const raw = readJsonSafe(filePath);
  if (!raw) return { apiKey: null, modelName: null, apiBaseUrl: buildConfig.llmApiBaseUrl };
  return {
    apiKey: raw.apiKey ?? null,
    modelName: raw.modelName ?? null,
    apiBaseUrl: buildConfig.llmApiBaseUrl,
  };
}

function getWorkspaceConfig(workspaceRoot) {
  const buildConfig = readBuildConfig();
  if (!workspaceRoot) return null;
  const envMap = filestore.readEnvFile(workspaceRoot);
  let apiKey =
    envMap[ENV_LLM_API_KEY] != null && String(envMap[ENV_LLM_API_KEY]).trim() !== ''
      ? String(envMap[ENV_LLM_API_KEY]).trim()
      : null;
  let modelName =
    envMap[ENV_LLM_MODEL] != null && String(envMap[ENV_LLM_MODEL]).trim() !== ''
      ? String(envMap[ENV_LLM_MODEL]).trim()
      : null;

  const legacyPath = getWorkspaceConfigPath(workspaceRoot);
  if ((!apiKey || !modelName) && legacyPath && fs.existsSync(legacyPath)) {
    const raw = readJsonSafe(legacyPath);
    if (raw) {
      if (!apiKey && raw.apiKey) apiKey = raw.apiKey;
      if (!modelName && raw.modelName) modelName = raw.modelName;
    }
  }

  return {
    apiKey,
    modelName,
    apiBaseUrl: buildConfig.llmApiBaseUrl,
  };
}

function chooseValueWithSource({ envValue, workspaceValue, globalValue, defaultValue = null }) {
  if (envValue !== undefined && envValue !== null) {
    return { value: envValue, source: 'env' };
  }
  if (workspaceValue !== undefined && workspaceValue !== null) {
    return { value: workspaceValue, source: 'workspace' };
  }
  if (globalValue !== undefined && globalValue !== null) {
    return { value: globalValue, source: 'global' };
  }
  return { value: defaultValue, source: 'default' };
}

function getEffectiveConfigDetails(userDataPath, workspaceRoot) {
  const buildConfig = readBuildConfig();
  const workspace = workspaceRoot ? getWorkspaceConfig(workspaceRoot) : null;

  const apiKeyResolved = chooseValueWithSource({
    envValue: process.env.TESTBLOX_LLM_API_KEY,
    workspaceValue: workspace?.apiKey,
    globalValue: null,
    defaultValue: null,
  });
  const modelNameResolved = chooseValueWithSource({
    envValue: process.env.TESTBLOX_LLM_MODEL,
    workspaceValue: workspace?.modelName,
    globalValue: null,
    defaultValue: null,
  });

  return {
    values: {
      apiKey: apiKeyResolved.value,
      modelName: modelNameResolved.value,
      apiBaseUrl: buildConfig.llmApiBaseUrl,
    },
    sources: {
      apiKey: apiKeyResolved.source,
      modelName: modelNameResolved.source,
      apiBaseUrl: 'buildConfig',
    },
  };
}

/**
 * Effective config: process env, then workspace `.env` only (no global app-store token).
 * Env: TESTBLOX_LLM_API_KEY, TESTBLOX_LLM_MODEL.
 */
function getEffectiveConfig(userDataPath, workspaceRoot) {
  return getEffectiveConfigDetails(userDataPath, workspaceRoot).values;
}

function saveGlobalConfig(userDataPath, config) {
  const buildConfig = readBuildConfig();
  const filePath = getGlobalConfigPath(userDataPath);
  writeJsonAtomic(filePath, {
    apiKey: config.apiKey ?? null,
    modelName: config.modelName ?? null,
    apiBaseUrl: buildConfig.llmApiBaseUrl,
  });
  return getGlobalConfig(userDataPath);
}

function removeLegacyWorkspaceLlmJson(workspaceRoot) {
  const legacyPath = getWorkspaceConfigPath(workspaceRoot);
  if (!legacyPath || !fs.existsSync(legacyPath)) return;
  try {
    fs.unlinkSync(legacyPath);
  } catch (_) {}
}

function saveWorkspaceConfig(workspaceRoot, config) {
  if (!workspaceRoot) return null;
  const cur = getWorkspaceConfig(workspaceRoot);

  const nextApi =
    config.apiKey !== undefined
      ? config.apiKey != null && String(config.apiKey).trim() !== ''
        ? String(config.apiKey).trim()
        : null
      : cur.apiKey;
  const nextModel =
    config.modelName !== undefined
      ? config.modelName != null && String(config.modelName).trim() !== ''
        ? String(config.modelName).trim()
        : null
      : cur.modelName;

  const toWrite = {};
  const toRemove = [];
  if (nextApi) toWrite[ENV_LLM_API_KEY] = nextApi;
  else toRemove.push(ENV_LLM_API_KEY);
  if (nextModel) toWrite[ENV_LLM_MODEL] = nextModel;
  else toRemove.push(ENV_LLM_MODEL);

  filestore.writeEnvFile(workspaceRoot, toWrite, toRemove);
  removeLegacyWorkspaceLlmJson(workspaceRoot);

  try {
    require('dotenv').config({
      path: path.join(workspaceRoot, '.env'),
      override: true,
    });
  } catch (_) {}

  return getWorkspaceConfig(workspaceRoot);
}

function isConfigValid(config) {
  return !!(config && config.apiKey && config.modelName && config.apiBaseUrl);
}

module.exports = {
  getGlobalConfig,
  getWorkspaceConfig,
  getEffectiveConfig,
  getEffectiveConfigDetails,
  saveGlobalConfig,
  saveWorkspaceConfig,
  isConfigValid,
  getGlobalConfigPath,
  getWorkspaceConfigPath,
};
