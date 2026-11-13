#!/usr/bin/env node
/**
 * Resize electron/assets/icon.png to a square size suitable for desktop packaging.
 * electron-builder expects at least 256×256 for Windows; 512×512 covers Windows + macOS DPI.
 */
const fs = require('fs');
const path = require('path');

const SIZE = 512;

async function main() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    console.error('Install sharp: npm install sharp --save-dev');
    process.exit(1);
  }

  const iconPath = path.join(__dirname, '..', 'electron', 'assets', 'icon.png');
  if (!fs.existsSync(iconPath)) {
    console.error('Missing', iconPath);
    process.exit(1);
  }

  const buf = await sharp(iconPath)
    .resize(SIZE, SIZE, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  fs.writeFileSync(iconPath, buf);
  console.log(`Wrote ${SIZE}×${SIZE} PNG:`, iconPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
