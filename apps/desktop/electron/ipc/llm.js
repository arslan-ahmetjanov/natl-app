const path = require('path');
const { ipcMain } = require('electron');
const llmConfig = require('../store/llmConfig');
const { getCurrentPath } = require('./workspace');
const { readBuildConfig } = require('../config/buildConfig');

function registerLlmIpc() {
  ipcMain.handle('llm:getConfig', (_, scope) => {
    const userData = require('electron').app.getPath('userData');
    const workspacePath = getCurrentPath();
    const buildConfig = readBuildConfig();
    if (workspacePath) {
      try {
        require('dotenv').config({
          path: path.join(workspacePath, '.env'),
          override: true,
        });
      } catch (_) {}
    }
    const workspaceConfig = workspacePath ? llmConfig.getWorkspaceConfig(workspacePath) : null;
    const effectiveDetails = llmConfig.getEffectiveConfigDetails(userData, workspacePath);
    const effective = effectiveDetails.values;
    return {
      workspace: workspaceConfig ? { ...workspaceConfig, apiKey: workspaceConfig.apiKey ? '***' : null } : null,
      effective: { ...effective, apiKey: effective.apiKey ? '***' : null },
      sources: effectiveDetails.sources,
      isValid: llmConfig.isConfigValid(effective),
      apiBaseUrlLocked: true,
      buildFlavor: buildConfig.flavor,
    };
  });

  ipcMain.handle('llm:saveConfig', (_, { apiKey, modelName }) => {
    const workspacePath = getCurrentPath();
    if (!workspacePath) throw new Error('No workspace opened');
    const current = llmConfig.getWorkspaceConfig(workspacePath) || {};
    return llmConfig.saveWorkspaceConfig(workspacePath, {
      apiKey: apiKey === '***' ? current.apiKey : apiKey,
      modelName: modelName ?? current.modelName,
      apiBaseUrl: current.apiBaseUrl,
    });
  });

  ipcMain.handle('llm:getEffectiveForAPI', () => {
    const userData = require('electron').app.getPath('userData');
    const workspacePath = getCurrentPath();
    return llmConfig.getEffectiveConfigDetails(userData, workspacePath);
  });
}

module.exports = registerLlmIpc;
