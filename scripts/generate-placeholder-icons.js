/**
 * Generate simple placeholder icons for Chrome Extension
 * Creates minimal 1x1 colored PNG files that Chrome can use
 * Run with: node scripts/generate-placeholder-icons.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ICONS_DIR = path.resolve(__dirname, '../extension/icons');

// Ensure icons directory exists
if (!fs.existsSync(ICONS_DIR)) {
  fs.mkdirSync(ICONS_DIR, { recursive: true });
}

console.log('🎨 Generating minimal placeholder icons...\n');
console.log('⚠️  These are 1x1 pixel placeholders - replace with proper icons later!\n');

// Minimal 1x1 PNG in Rupt brand color (#4adeb9)
// This is a valid PNG file with just one turquoise pixel
const minimalPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP4z/D/PwAGBAL/VJiKjwAAAABJRU5ErkJggg==';
const buffer = Buffer.from(minimalPngBase64, 'base64');

const sizes = [16, 32, 48, 128];

sizes.forEach(size => {
  const outputPath = path.join(ICONS_DIR, `icon${size}.png`);
  fs.writeFileSync(outputPath, buffer);
  console.log(`✓ Generated icon${size}.png (placeholder)`);
});

console.log('\n✅ Placeholder icons created!');
console.log(`📂 Saved to: ${ICONS_DIR}`);
console.log('\n⚠️  IMPORTANT: These are minimal 1x1 placeholders.');
console.log('    For a proper icon, convert icon.svg to PNG:');
console.log('    → https://www.aconvert.com/image/svg-to-png/');
console.log('    → Or run: python scripts/generate-icons.py\n');
