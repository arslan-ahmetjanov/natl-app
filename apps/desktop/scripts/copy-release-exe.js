const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const releaseDir = path.join(__dirname, '..', 'release');

if (!fs.existsSync(distDir)) {
  console.warn('dist/ not found, skipping copy');
  process.exit(0);
}

if (!fs.existsSync(releaseDir)) {
  fs.mkdirSync(releaseDir, { recursive: true });
}

const files = fs.readdirSync(distDir);
const exeFiles = files.filter((f) => f.endsWith('.exe'));

for (const file of exeFiles) {
  const src = path.join(distDir, file);
  const dest = path.join(releaseDir, file);
  fs.copyFileSync(src, dest);
  console.log('Copied:', file);
}

if (exeFiles.length === 0) {
  console.warn('No .exe files found in dist/');
}
