const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Dialog
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  openZip: () => ipcRenderer.invoke('dialog:openZip'),
  openSwaggerJson: () => ipcRenderer.invoke('dialog:openSwaggerJson'),
  selectBrowserExecutable: () => ipcRenderer.invoke('dialog:selectBrowserExecutable'),
  // App
  getPath: (name) => ipcRenderer.invoke('app:getPath', name),
  windowMinimize: () => ipcRenderer.invoke('window:minimize'),
  windowToggleMaximize: () => ipcRenderer.invoke('window:toggleMaximize'),
  windowClose: () => ipcRenderer.invoke('window:close'),
  windowIsMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  onWindowMaximized: (cb) => {
    const fn = (_, isMaximized) => cb(isMaximized);
    ipcRenderer.on('main:window-maximized', fn);
    return () => ipcRenderer.removeListener('main:window-maximized', fn);
  },
  // Workspace (file store)
  getWorkspacePath: () => ipcRenderer.invoke('workspace:getCurrentPath'),
  getLastOpenedWorkspaces: () => ipcRenderer.invoke('workspace:getLastOpened'),
  openFolderAndLoad: (path) => ipcRenderer.invoke('workspace:openFolder', path),
  closeWorkspace: () => ipcRenderer.invoke('workspace:close'),
  workspaceClone: (sourcePath, targetParentPath, newFolderName) =>
    ipcRenderer.invoke('workspace:clone', sourcePath, targetParentPath, newFolderName),
  workspaceExportZip: (workspacePath) => ipcRenderer.invoke('workspace:exportZip', workspacePath),
  workspaceImportZip: (zipFilePath, targetParentPath) =>
    ipcRenderer.invoke('workspace:importZip', zipFilePath, targetParentPath),
  createProject: (parentPath, projectName) => ipcRenderer.invoke('workspace:createProject', parentPath, projectName),
  getWorkspaceMeta: () => ipcRenderer.invoke('workspace:getMeta'),
  updateWorkspaceMeta: (data) => ipcRenderer.invoke('workspace:updateMeta', data),
  getActions: () => ipcRenderer.invoke('workspace:getActions'),
  getVariables: () => ipcRenderer.invoke('variables:list'),
  updateVariables: (variables) => ipcRenderer.invoke('variables:update', variables),
  generateVariableFromPattern: (pattern) => ipcRenderer.invoke('variables:generateFromPattern', pattern),
  listSharedSteps: () => ipcRenderer.invoke('sharedSteps:list'),
  getSharedStep: (id) => ipcRenderer.invoke('sharedSteps:get', id),
  createSharedStep: (data) => ipcRenderer.invoke('sharedSteps:create', data),
  updateSharedStep: (id, data) => ipcRenderer.invoke('sharedSteps:update', id, data),
  deleteSharedStep: (id) => ipcRenderer.invoke('sharedSteps:delete', id),
  listApiBases: () => ipcRenderer.invoke('apiBases:list'),
  getApiBase: (id) => ipcRenderer.invoke('apiBases:get', id),
  createApiBase: (data) => ipcRenderer.invoke('apiBases:create', data),
  updateApiBase: (id, data) => ipcRenderer.invoke('apiBases:update', id, data),
  deleteApiBase: (id) => ipcRenderer.invoke('apiBases:delete', id),
  listEndpoints: (baseId) => ipcRenderer.invoke('endpoints:list', baseId),
  getEndpoint: (id) => ipcRenderer.invoke('endpoints:get', id),
  createEndpoint: (data) => ipcRenderer.invoke('endpoints:create', data),
  updateEndpoint: (id, data) => ipcRenderer.invoke('endpoints:update', id, data),
  deleteEndpoint: (id) => ipcRenderer.invoke('endpoints:delete', id),
  importSwagger: (urlOrSpec, requestOptions) => ipcRenderer.invoke('endpoints:importSwagger', urlOrSpec, requestOptions),
  listPages: () => ipcRenderer.invoke('pages:list'),
  getPage: (id) => ipcRenderer.invoke('pages:get', id),
  createPage: (data) => ipcRenderer.invoke('pages:create', data),
  updatePage: (id, data) => ipcRenderer.invoke('pages:update', id, data),
  deletePage: (id) => ipcRenderer.invoke('pages:delete', id),
  listTests: (pageId) => ipcRenderer.invoke('tests:list', pageId),
  getTest: (id) => ipcRenderer.invoke('tests:get', id),
  createTest: (data) => ipcRenderer.invoke('tests:create', data),
  updateTest: (id, data) => ipcRenderer.invoke('tests:update', id, data),
  deleteTest: (id) => ipcRenderer.invoke('tests:delete', id),
  findDuplicateTests: () => ipcRenderer.invoke('tests:findDuplicates'),
  runTest: (testId, options) => ipcRenderer.invoke('tests:run', testId, options || {}),
  runTests: (opts) => ipcRenderer.invoke('tests:runMany', opts),
  openPathInExplorer: (targetPath) => ipcRenderer.invoke('shell:openPath', targetPath),
  generateTestsWithAI: (pageId, customPrompt) => ipcRenderer.invoke('tests:generateWithAI', pageId, customPrompt),
  generateFromSelection: (options) => ipcRenderer.invoke('tests:generateFromSelection', options),
  onAiGenerateProgress: (cb) => {
    const fn = (_, e) => cb(e);
    ipcRenderer.on('main:ai-generate-progress', fn);
    return () => ipcRenderer.removeListener('main:ai-generate-progress', fn);
  },
  reportsList: (testId) => ipcRenderer.invoke('reports:list', testId),
  reportsGet: (reportId) => ipcRenderer.invoke('reports:get', reportId),
  reportsGetScreenshot: (reportId, filename) => ipcRenderer.invoke('reports:getScreenshot', reportId, filename),
  reportsDelete: (reportId) => ipcRenderer.invoke('reports:delete', reportId),
  parsePage: (source, viewport, requestOptions) => ipcRenderer.invoke('parser:parsePage', source, viewport, requestOptions),
  onTestRunProgress: (cb) => {
    const fn = (_, e) => cb(e);
    ipcRenderer.on('main:test-run-progress', fn);
    return () => ipcRenderer.removeListener('main:test-run-progress', fn);
  },
  // Git
  onGitProgress: (cb) => {
    const fn = (_, e) => cb(e);
    ipcRenderer.on('main:git-progress', fn);
    return () => ipcRenderer.removeListener('main:git-progress', fn);
  },
  gitVersion: () => ipcRenderer.invoke('git:getVersion'),
  gitClone: (opts) => ipcRenderer.invoke('git:clone', opts),
  gitRootPath: (wp) => ipcRenderer.invoke('git:getRootPath', wp),
  gitCurrentBranch: (root) => ipcRenderer.invoke('git:getCurrentBranch', root),
  gitRemoteUrl: (root) => ipcRenderer.invoke('git:getRemoteUrl', root),
  gitStatus: (root) => ipcRenderer.invoke('git:getStatus', root),
  gitPull: (root) => ipcRenderer.invoke('git:pull', root),
  gitPush: (root) => ipcRenderer.invoke('git:push', root),
  gitStage: (root, files) => ipcRenderer.invoke('git:stage', root, files),
  gitCommit: (root, message) => ipcRenderer.invoke('git:commit', root, message),
  gitInit: (wp) => ipcRenderer.invoke('git:init', wp),
  getRepoNameFromUrl: (url) => ipcRenderer.invoke('git:getRepoNameFromUrl', url),
  gitFetch: (root, remote) => ipcRenderer.invoke('git:fetch', root, remote),
  gitGetRemotes: (root) => ipcRenderer.invoke('git:getRemotes', root),
  gitGetBranches: (root) => ipcRenderer.invoke('git:getBranches', root),
  gitGetRemoteBranches: (root, remote) => ipcRenderer.invoke('git:getRemoteBranches', root, remote),
  gitCheckoutBranch: (root, branchName, options) => ipcRenderer.invoke('git:checkoutBranch', root, branchName, options),
  gitCheckoutRemoteBranch: (root, remote, branchName, processUid) => ipcRenderer.invoke('git:checkoutRemoteBranch', root, remote, branchName, processUid),
  gitAddRemote: (root, name, url) => ipcRenderer.invoke('git:addRemote', root, name, url),
  gitRemoveRemote: (root, name) => ipcRenderer.invoke('git:removeRemote', root, name),
  // LLM (OpenRouter)
  llmGetConfig: () => ipcRenderer.invoke('llm:getConfig'),
  llmSaveConfig: (opts) => ipcRenderer.invoke('llm:saveConfig', opts),
  llmGetEffectiveForAPI: () => ipcRenderer.invoke('llm:getEffectiveForAPI'),
  // Browser (for UI tests)
  browserGetConfig: () => ipcRenderer.invoke('browser:getConfig'),
  browserSaveConfig: (opts) => ipcRenderer.invoke('browser:saveConfig', opts),
});
