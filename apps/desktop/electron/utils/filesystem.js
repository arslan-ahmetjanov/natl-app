const fs = require('fs');
const path = require('path');

function createDirectory(dir) {
  if (!dir) throw new Error('directory: path is null');
  if (fs.existsSync(dir)) return;
  fs.mkdirSync(dir, { recursive: true });
}

function removeDirectory(dir) {
  if (!dir || !fs.existsSync(dir)) return;
  fs.rmSync(dir, { recursive: true, force: true });
}

module.exports = { createDirectory, removeDirectory };
