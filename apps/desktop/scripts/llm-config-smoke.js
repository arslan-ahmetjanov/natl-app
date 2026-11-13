const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { execFileSync } = require('child_process');

const projectRoot = path.join(__dirname, '..');
const writeBuildConfigScript = path.join(projectRoot, 'scripts', 'write-build-config.js');
const buildConfigPath = path.join(projectRoot, 'electron', 'config', 'buildConfig.json');
const llmConfig = require('../electron/store/llmConfig');

function runWriteBuildConfig(args = [], env = {}) {
  execFileSync(process.execPath, [writeBuildConfigScript, ...args], {
    cwd: projectRoot,
    stdio: 'pipe',
    env: { ...process.env, ...env },
  });
}

function runFlavorScenario(flavor, expectedBaseUrl) {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `testblox-llm-${flavor}-`));
  const userDataPath = path.join(tmpRoot, 'userData');
  const workspaceRoot = path.join(tmpRoot, 'workspace');
  fs.mkdirSync(userDataPath, { recursive: true });
  fs.mkdirSync(workspaceRoot, { recursive: true });

  llmConfig.saveWorkspaceConfig(workspaceRoot, { apiKey: 'workspace-key', modelName: 'workspace-model' });

  delete process.env.TESTBLOX_LLM_API_KEY;
  delete process.env.TESTBLOX_LLM_MODEL;

  llmConfig.saveGlobalConfig(userDataPath, { apiKey: 'global-key', modelName: 'global-model' });
  const ignoredGlobal = llmConfig.getEffectiveConfigDetails(userDataPath, null);
  assert.equal(ignoredGlobal.values.apiKey, null);
  assert.equal(ignoredGlobal.values.modelName, null);
  assert.equal(ignoredGlobal.sources.apiKey, 'default');

  const fromWorkspace = llmConfig.getEffectiveConfigDetails(userDataPath, workspaceRoot);
  assert.equal(fromWorkspace.values.apiKey, 'workspace-key');
  assert.equal(fromWorkspace.values.modelName, 'workspace-model');
  assert.equal(fromWorkspace.sources.apiKey, 'workspace');
  assert.equal(fromWorkspace.sources.modelName, 'workspace');
  assert.equal(fromWorkspace.values.apiBaseUrl, expectedBaseUrl);
  assert.equal(fromWorkspace.sources.apiBaseUrl, 'buildConfig');

  process.env.TESTBLOX_LLM_API_KEY = 'env-key';
  process.env.TESTBLOX_LLM_MODEL = 'env-model';
  const fromEnv = llmConfig.getEffectiveConfigDetails(userDataPath, workspaceRoot);
  assert.equal(fromEnv.values.apiKey, 'env-key');
  assert.equal(fromEnv.values.modelName, 'env-model');
  assert.equal(fromEnv.sources.apiKey, 'env');
  assert.equal(fromEnv.sources.modelName, 'env');

  delete process.env.TESTBLOX_LLM_API_KEY;
  delete process.env.TESTBLOX_LLM_MODEL;
}

function main() {
  const originalBuildConfig = fs.existsSync(buildConfigPath) ? fs.readFileSync(buildConfigPath, 'utf8') : null;
  const originalEnvApiKey = process.env.TESTBLOX_LLM_API_KEY;
  const originalEnvModel = process.env.TESTBLOX_LLM_MODEL;

  try {
    runWriteBuildConfig([], {});
    runFlavorScenario('default', 'https://openrouter.ai/api/v1');

    runWriteBuildConfig(['--flavor=custom'], {
      TESTBLOX_BUILD_LLM_API_BASE_URL: 'https://custom.example.test/v1',
    });
    runFlavorScenario('custom', 'https://custom.example.test/v1');

    console.log('LLM config smoke test passed for default and custom flavors.');
  } finally {
    if (originalBuildConfig === null) {
      if (fs.existsSync(buildConfigPath)) fs.unlinkSync(buildConfigPath);
    } else {
      fs.writeFileSync(buildConfigPath, originalBuildConfig, 'utf8');
    }

    if (originalEnvApiKey === undefined) delete process.env.TESTBLOX_LLM_API_KEY;
    else process.env.TESTBLOX_LLM_API_KEY = originalEnvApiKey;
    if (originalEnvModel === undefined) delete process.env.TESTBLOX_LLM_MODEL;
    else process.env.TESTBLOX_LLM_MODEL = originalEnvModel;
  }
}

main();
