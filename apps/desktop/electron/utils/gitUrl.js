const gitUrlParse = require('git-url-parse');

function getRepoNameFromUrl(url) {
  try {
    const parsed = gitUrlParse(url);
    return parsed.name || 'repo';
  } catch {
    return 'repo';
  }
}

function isGitUrl(str) {
  try {
    const parsed = gitUrlParse(str);
    const valid = ['git', 'ssh', 'http', 'https'];
    return !!(parsed && parsed.source && valid.includes(parsed.protocol));
  } catch {
    return false;
  }
}

module.exports = { getRepoNameFromUrl, isGitUrl };
