const { ipcMain } = require('electron');
const filestore = require('../store/filestore');
const { assertHttpsWebUrl } = require('../utils/requireHttpsUrl');

let currentWorkspacePath = null;

function getCurrentPath() {
  return currentWorkspacePath;
}

function setCurrentPath(path) {
  currentWorkspacePath = path;
  return path;
}

function withWorkspace(fn) {
  return async (event, ...args) => {
    if (!currentWorkspacePath) throw new Error('No workspace opened');
    return fn(currentWorkspacePath, ...args);
  };
}

function registerWorkspaceIpc() {
  ipcMain.handle('workspace:getCurrentPath', () => currentWorkspacePath);

  ipcMain.handle('workspace:close', () => {
    setCurrentPath(null);
    return { closed: true };
  });

  ipcMain.handle('workspace:setPath', (_, path) => {
    setCurrentPath(path);
    return path;
  });

  ipcMain.handle('workspace:isWorkspace', (_, rootPath) => filestore.isWorkspace(rootPath));

  ipcMain.handle('workspace:init', (_, rootPath, title) => {
    return filestore.initWorkspace(rootPath, title || 'My Workspace');
  });

  ipcMain.handle('workspace:getMeta', withWorkspace((root) => filestore.readWorkspaceMeta(root)));

  ipcMain.handle('workspace:updateMeta', withWorkspace((root, data) => {
    const meta = filestore.readWorkspaceMeta(root);
    if (!meta) throw new Error('Workspace not found');
    const next = { ...meta, ...data };
    filestore.writeWorkspaceMeta(root, next);
    return next;
  }));

  ipcMain.handle('workspace:getActions', withWorkspace((root) => filestore.readActions(root)));
  ipcMain.handle('variables:list', withWorkspace((root) => filestore.readVariables(root)));
  ipcMain.handle('variables:update', withWorkspace((root, variables) => {
    filestore.writeVariables(root, variables);
    return filestore.readVariables(root);
  }));
  ipcMain.handle('variables:generateFromPattern', (_, pattern) => {
    if (pattern == null || String(pattern).trim() === '') return '';
    try {
      const RandExp = require('randexp');
      return new RandExp(new RegExp(String(pattern))).gen();
    } catch {
      return '';
    }
  });

  ipcMain.handle('sharedSteps:list', withWorkspace((root) => filestore.listSharedSteps(root)));
  ipcMain.handle('sharedSteps:get', withWorkspace((root, id) => filestore.readSharedStep(root, id)));
  ipcMain.handle('sharedSteps:create', withWorkspace((root, data) => filestore.createSharedStep(root, data)));
  ipcMain.handle('sharedSteps:update', withWorkspace((root, id, data) => filestore.updateSharedStep(root, id, data)));
  ipcMain.handle('sharedSteps:delete', withWorkspace((root, id) => filestore.deleteSharedStep(root, id)));

  ipcMain.handle('apiBases:list', withWorkspace((root) => filestore.listBases(root)));
  ipcMain.handle('apiBases:get', withWorkspace((root, baseId) => filestore.readBase(root, baseId)));
  ipcMain.handle('apiBases:create', withWorkspace((root, data) => {
    const baseUrl = data && data.baseUrl != null ? String(data.baseUrl).trim() : '';
    if (!baseUrl) throw new Error('API base URL is required (https://...)');
    assertHttpsWebUrl(baseUrl, { allowEmpty: false, fieldName: 'API base URL' });
    return filestore.createBase(root, data);
  }));
  ipcMain.handle('apiBases:update', withWorkspace((root, baseId, data) => {
    if (data && data.baseUrl !== undefined) {
      const baseUrl = String(data.baseUrl || '').trim();
      if (!baseUrl) throw new Error('API base URL is required (https://...)');
      assertHttpsWebUrl(baseUrl, { allowEmpty: false, fieldName: 'API base URL' });
    }
    return filestore.updateBase(root, baseId, data);
  }));
  ipcMain.handle('apiBases:delete', withWorkspace((root, baseId) => filestore.deleteBase(root, baseId)));

  ipcMain.handle('endpoints:list', withWorkspace((root, baseId) => filestore.listEndpoints(root, baseId ?? null)));
  ipcMain.handle('endpoints:get', withWorkspace((root, endpointId) => filestore.readEndpoint(root, endpointId)));
  ipcMain.handle('endpoints:create', withWorkspace((root, data) => {
    if (data && data.baseUrl != null && String(data.baseUrl).trim() !== '') {
      assertHttpsWebUrl(data.baseUrl, { allowEmpty: false, fieldName: 'Endpoint base URL' });
    }
    return filestore.createEndpoint(root, data);
  }));
  ipcMain.handle('endpoints:update', withWorkspace((root, endpointId, data) => {
    if (data && data.baseUrl !== undefined && String(data.baseUrl || '').trim() !== '') {
      assertHttpsWebUrl(data.baseUrl, { allowEmpty: false, fieldName: 'Endpoint base URL' });
    }
    return filestore.updateEndpoint(root, endpointId, data);
  }));
  ipcMain.handle('endpoints:delete', withWorkspace((root, endpointId) => filestore.deleteEndpoint(root, endpointId)));
  ipcMain.handle('endpoints:importSwagger', withWorkspace(async (root, urlOrSpec, requestOptions) => {
    const swaggerParser = require('../services/swaggerParser');
    return swaggerParser.importSwagger(root, urlOrSpec, requestOptions || null);
  }));

  ipcMain.handle('pages:list', withWorkspace((root) => filestore.listPages(root)));
  ipcMain.handle('pages:get', withWorkspace((root, pageId) => filestore.readPage(root, pageId)));
  ipcMain.handle('pages:create', withWorkspace((root, data) => {
    const url = data && data.url != null ? String(data.url).trim() : '';
    if (!url) throw new Error('Page URL is required (https://...)');
    assertHttpsWebUrl(url, { allowEmpty: false, fieldName: 'Page URL' });
    return filestore.createPage(root, data);
  }));
  ipcMain.handle('pages:update', withWorkspace((root, pageId, data) => {
    if (data && data.url !== undefined) {
      const url = String(data.url || '').trim();
      if (!url) throw new Error('Page URL is required (https://...)');
      assertHttpsWebUrl(url, { allowEmpty: false, fieldName: 'Page URL' });
    }
    return filestore.updatePage(root, pageId, data);
  }));
  ipcMain.handle('pages:delete', withWorkspace((root, pageId) => filestore.deletePage(root, pageId)));

  ipcMain.handle('tests:list', withWorkspace((root, pageOrOptions) => {
    if (pageOrOptions && typeof pageOrOptions === 'object' && !Array.isArray(pageOrOptions)) {
      return filestore.listTests(root, pageOrOptions);
    }
    return filestore.listTests(root, pageOrOptions || null);
  }));
  ipcMain.handle('tests:get', withWorkspace((root, testId) => filestore.readTest(root, testId)));
  ipcMain.handle('tests:create', withWorkspace((root, data) => filestore.createTest(root, data)));
  ipcMain.handle('tests:update', withWorkspace((root, testId, data) => filestore.updateTest(root, testId, data)));
  ipcMain.handle('tests:delete', withWorkspace((root, testId) => filestore.deleteTest(root, testId)));
  ipcMain.handle('tests:findDuplicates', withWorkspace((root) => filestore.findDuplicateTests(root)));
}

module.exports = {
  registerWorkspaceIpc,
  getCurrentPath,
  setCurrentPath,
};
