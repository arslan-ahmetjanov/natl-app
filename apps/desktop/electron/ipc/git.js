const { ipcMain } = require('electron');
const path = require('path');
const gitUtils = require('../utils/git');
const { createDirectory, removeDirectory } = require('../utils/filesystem');
const { getCurrentPath } = require('./workspace');
const { getRepoNameFromUrl } = require('../utils/gitUrl');

function registerGitIpc(mainWindow) {
  ipcMain.handle('git:getVersion', () => gitUtils.getGitVersion());

  ipcMain.handle('git:clone', async (_, { url, targetPath, processUid }) => {
    let created = false;
    try {
      createDirectory(targetPath);
      created = true;
      await gitUtils.cloneRepository(mainWindow, { url, targetPath, processUid });
      return { success: true, path: targetPath };
    } catch (err) {
      if (created) removeDirectory(targetPath);
      throw err;
    }
  });

  ipcMain.handle('git:getRootPath', (_, workspacePath) => {
    const root = workspacePath || getCurrentPath();
    return root ? gitUtils.findGitRootPath(root) : null;
  });

  ipcMain.handle('git:getCurrentBranch', async (_, gitRootPath) => {
    const root = gitRootPath || gitUtils.findGitRootPath(getCurrentPath());
    if (!root) return null;
    return gitUtils.getCurrentBranch(root);
  });

  ipcMain.handle('git:getRemoteUrl', async (_, gitRootPath) => {
    const root = gitRootPath || gitUtils.findGitRootPath(getCurrentPath());
    if (!root) return null;
    return gitUtils.getRemoteUrl(root);
  });

  ipcMain.handle('git:getStatus', async (_, gitRootPath) => {
    const root = gitRootPath || gitUtils.findGitRootPath(getCurrentPath());
    if (!root) return null;
    return gitUtils.getStatus(root);
  });

  ipcMain.handle('git:pull', async (_, gitRootPath) => {
    const root = gitRootPath || gitUtils.findGitRootPath(getCurrentPath());
    if (!root) throw new Error('Not a git repository');
    await gitUtils.pull(root);
  });

  ipcMain.handle('git:push', async (_, gitRootPath) => {
    const root = gitRootPath || gitUtils.findGitRootPath(getCurrentPath());
    if (!root) throw new Error('Not a git repository');
    await gitUtils.push(root);
  });

  ipcMain.handle('git:stage', async (_, gitRootPath, files) => {
    const root = gitRootPath || gitUtils.findGitRootPath(getCurrentPath());
    if (!root) throw new Error('Not a git repository');
    await gitUtils.stage(root, files);
  });

  ipcMain.handle('git:commit', async (_, gitRootPath, message) => {
    const root = gitRootPath || gitUtils.findGitRootPath(getCurrentPath());
    if (!root) throw new Error('Not a git repository');
    await gitUtils.commit(root, message);
  });

  ipcMain.handle('git:init', async (_, workspacePath) => {
    const root = workspacePath || getCurrentPath();
    if (!root) throw new Error('No workspace');
    await gitUtils.init(root);
  });

  ipcMain.handle('git:getRepoNameFromUrl', (_, url) => getRepoNameFromUrl(url));

  ipcMain.handle('git:fetch', async (_, gitRootPath, remote) => {
    const root = gitRootPath || gitUtils.findGitRootPath(getCurrentPath());
    if (!root) throw new Error('Not a git repository');
    await gitUtils.fetch(root, remote || 'origin');
  });

  ipcMain.handle('git:getRemotes', async (_, gitRootPath) => {
    const root = gitRootPath || gitUtils.findGitRootPath(getCurrentPath());
    if (!root) return [];
    return gitUtils.getRemotes(root);
  });

  ipcMain.handle('git:getBranches', async (_, gitRootPath) => {
    const root = gitRootPath || gitUtils.findGitRootPath(getCurrentPath());
    if (!root) return [];
    return gitUtils.getBranches(root);
  });

  ipcMain.handle('git:getRemoteBranches', async (_, gitRootPath, remote) => {
    const root = gitRootPath || gitUtils.findGitRootPath(getCurrentPath());
    if (!root) return [];
    return gitUtils.getRemoteBranches(root, remote || 'origin');
  });

  ipcMain.handle('git:checkoutBranch', async (_, gitRootPath, branchName, options) => {
    const root = gitRootPath || gitUtils.findGitRootPath(getCurrentPath());
    if (!root) throw new Error('Not a git repository');
    await gitUtils.checkoutBranch(root, branchName, options || {});
  });

  ipcMain.handle('git:checkoutRemoteBranch', async (_, gitRootPath, remote, branchName, processUid) => {
    const root = gitRootPath || gitUtils.findGitRootPath(getCurrentPath());
    if (!root) throw new Error('Not a git repository');
    await gitUtils.checkoutRemoteBranch(mainWindow, { gitRootPath: root, remote: remote || 'origin', branchName, processUid });
  });

  ipcMain.handle('git:addRemote', async (_, gitRootPath, name, url) => {
    const root = gitRootPath || gitUtils.findGitRootPath(getCurrentPath());
    if (!root) throw new Error('Not a git repository');
    await gitUtils.addRemote(root, name, url);
  });

  ipcMain.handle('git:removeRemote', async (_, gitRootPath, name) => {
    const root = gitRootPath || gitUtils.findGitRootPath(getCurrentPath());
    if (!root) throw new Error('Not a git repository');
    await gitUtils.removeRemote(root, name);
  });
}

module.exports = registerGitIpc;
