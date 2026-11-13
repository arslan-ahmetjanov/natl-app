const simpleGit = require('simple-git');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const instances = new Map();

function getGitVersion() {
  return new Promise((resolve) => {
    exec('git --version', (err, stdout) => {
      if (err) return resolve(null);
      resolve((stdout && stdout.trim()) || null);
    });
  });
}

function getGit(repoPath) {
  if (!instances.has(repoPath)) {
    instances.set(repoPath, simpleGit(repoPath));
  }
  return instances.get(repoPath);
}

function findGitRootPath(dirPath) {
  const gitPath = path.join(dirPath, '.git');
  if (fs.existsSync(gitPath)) {
    return path.resolve(dirPath);
  }
  const parent = path.dirname(dirPath);
  if (parent === dirPath) return null;
  return findGitRootPath(parent);
}

function cloneRepository(win, { url, targetPath, processUid }) {
  return new Promise((resolve, reject) => {
    const send = (data) => {
      if (win && win.webContents) {
        win.webContents.send('main:git-progress', { processUid, data: String(data) });
      }
    };
    const git = simpleGit();
    git.outputHandler((cmd, stdout, stderr) => {
      stderr.on('data', (chunk) => send(chunk));
    });
    git.clone(url, targetPath, ['--progress'], (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

async function getCurrentBranch(gitRootPath) {
  const git = getGit(gitRootPath);
  const branch = await git.branch();
  return branch.current;
}

async function getRemoteUrl(gitRootPath) {
  const git = getGit(gitRootPath);
  try {
    const url = await git.raw(['config', '--get', 'remote.origin.url']);
    return url ? url.trim() : null;
  } catch {
    return null;
  }
}

async function getStatus(gitRootPath) {
  const git = getGit(gitRootPath);
  const status = await git.status();
  return {
    current: status.current,
    tracking: status.tracking,
    ahead: status.ahead || 0,
    behind: status.behind || 0,
    files: status.files || [],
    not_added: status.not_added || [],
    created: status.created || [],
    deleted: status.deleted || [],
    modified: status.modified || [],
    staged: status.staged || [],
  };
}

async function pull(gitRootPath, remote = 'origin', branch = null) {
  const git = getGit(gitRootPath);
  const b = branch || (await getCurrentBranch(gitRootPath));
  await git.pull(remote, b);
}

async function push(gitRootPath, remote = 'origin', branch = null) {
  const git = getGit(gitRootPath);
  const b = branch || (await getCurrentBranch(gitRootPath));
  await git.push(remote, b);
}

async function stage(gitRootPath, files) {
  const git = getGit(gitRootPath);
  if (files && files.length) {
    await git.add(files);
  } else {
    await git.add('.');
  }
}

async function commit(gitRootPath, message) {
  const git = getGit(gitRootPath);
  await git.commit(message);
}

const DEFAULT_GITIGNORE = `# TestBlox
reports/
node_modules/
`;

async function init(gitRootPath) {
  const git = getGit(gitRootPath);
  await git.init();
  await git.raw(['branch', '-M', 'main']);
  const gitignorePath = path.join(gitRootPath, '.gitignore');
  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, DEFAULT_GITIGNORE, 'utf8');
  }
}

async function fetch(gitRootPath, remote = 'origin') {
  const git = getGit(gitRootPath);
  await git.fetch([remote]);
}

async function getRemotes(gitRootPath) {
  const git = getGit(gitRootPath);
  const remotes = await git.getRemotes(true);
  return Object.entries(remotes || {}).map(([name, obj]) => ({
    name,
    url: (obj && (obj.fetch || obj.push)) || '',
  }));
}

async function getBranches(gitRootPath) {
  const git = getGit(gitRootPath);
  const { all = [] } = await git.branch();
  return all.filter((b) => !b.includes('/'));
}

async function getRemoteBranches(gitRootPath, remote = 'origin') {
  const git = getGit(gitRootPath);
  const { all = [] } = await git.branch(['-r']);
  const prefix = remote + '/';
  return all
    .map((b) => b.trim())
    .filter((b) => b.startsWith(prefix))
    .map((b) => b.slice(prefix.length));
}

async function checkoutBranch(gitRootPath, branchName, options = {}) {
  const git = getGit(gitRootPath);
  if (options.create) {
    await git.checkout(['-b', branchName]);
  } else {
    await git.checkout(branchName);
  }
}

async function checkoutRemoteBranch(win, { gitRootPath, remote, branchName, processUid }) {
  const git = getGit(gitRootPath);
  const remoteBranch = `${remote}/${branchName}`;
  const send = (data) => {
    if (win && win.webContents) {
      win.webContents.send('main:git-progress', { processUid, data: String(data) });
    }
  };
  git.outputHandler((cmd, stdout, stderr) => {
    stderr.on('data', (chunk) => send(chunk));
  });
  await git.checkout(['-b', branchName, '--track', remoteBranch]);
}

async function addRemote(gitRootPath, name, url) {
  const git = getGit(gitRootPath);
  await git.addRemote(name, url);
}

async function removeRemote(gitRootPath, name) {
  const git = getGit(gitRootPath);
  await git.removeRemote(name);
}

module.exports = {
  getGitVersion,
  findGitRootPath,
  cloneRepository,
  getCurrentBranch,
  getRemoteUrl,
  getStatus,
  pull,
  push,
  stage,
  commit,
  init,
  fetch,
  getRemotes,
  getBranches,
  getRemoteBranches,
  checkoutBranch,
  checkoutRemoteBranch,
  addRemote,
  removeRemote,
};
