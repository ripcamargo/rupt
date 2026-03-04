import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const extensionDir = path.join(rootDir, 'extension');
const distDir = path.join(rootDir, 'extension-dist');
const iconsSource = path.join(extensionDir, 'icons');

console.log('📦 Building Chrome Extension...\n');

// Load environment variables from .env.local
const envPath = path.join(rootDir, '.env.local');
let envVars = {};
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  console.log('[Debug] .env.local path:', envPath);
  console.log('[Debug] File exists:', true);
  
  envVars = dotenv.parse(envContent);
  console.log('✓ Loaded environment variables from .env.local');
  console.log('[Debug] All keys loaded:', Object.keys(envVars));
  console.log(`  - VITE_GOOGLE_OAUTH_CLIENT_ID: ${envVars.VITE_GOOGLE_OAUTH_CLIENT_ID ? '✓ Present' : '✗ Missing'}`);
  console.log(`  - VITE_FIREBASE_PROJECT_ID: ${envVars.VITE_FIREBASE_PROJECT_ID ? '✓ Present' : '✗ Missing'}`);
  
  // Debug: print the actual value
  if (envVars.VITE_GOOGLE_OAUTH_CLIENT_ID) {
    console.log(`  - Value: ${envVars.VITE_GOOGLE_OAUTH_CLIENT_ID.slice(0, 20)}...`);
  }
} else {
  console.warn('⚠️  .env.local not found - extension will run with empty config');
}

// Create config file to inject into extension with environment variables
const configCode = `// Auto-generated config file - DO NOT EDIT
export const ENV_CONFIG = {
  VITE_GOOGLE_OAUTH_CLIENT_ID: ${JSON.stringify(envVars.VITE_GOOGLE_OAUTH_CLIENT_ID || '')},
  VITE_FIREBASE_API_KEY: ${JSON.stringify(envVars.VITE_FIREBASE_API_KEY || '')},
  VITE_FIREBASE_AUTH_DOMAIN: ${JSON.stringify(envVars.VITE_FIREBASE_AUTH_DOMAIN || '')},
  VITE_FIREBASE_PROJECT_ID: ${JSON.stringify(envVars.VITE_FIREBASE_PROJECT_ID || '')},
  VITE_FIREBASE_STORAGE_BUCKET: ${JSON.stringify(envVars.VITE_FIREBASE_STORAGE_BUCKET || '')},
  VITE_FIREBASE_MESSAGING_SENDER_ID: ${JSON.stringify(envVars.VITE_FIREBASE_MESSAGING_SENDER_ID || '')},
  VITE_FIREBASE_APP_ID: ${JSON.stringify(envVars.VITE_FIREBASE_APP_ID || '')},
  VITE_FIREBASE_MEASUREMENT_ID: ${JSON.stringify(envVars.VITE_FIREBASE_MEASUREMENT_ID || '')},
};
`;

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

const configPath = path.join(distDir, 'config.js');
fs.writeFileSync(configPath, configCode);
console.log('✓ Generated extension config with environment variables');

// Clean unwanted files from Vite build (files starting with _ or other build artifacts)
console.log('✓ Cleaning unwanted files from build');
const filesToRemove = ['_redirects', 'rupt-logo.png', 'rupt_icon.ico', 'vite.svg'];
filesToRemove.forEach(file => {
  const filePath = path.join(distDir, file);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log(`  Removed: ${file}`);
  }
});

// Check if icons exist, if not generate placeholders
const requiredIcons = ['icon16.png', 'icon32.png', 'icon48.png', 'icon128.png'];
const iconsExist = requiredIcons.every(icon => 
  fs.existsSync(path.join(iconsSource, icon))
);

if (!iconsExist) {
  console.log('⚠️  Icons not found. Generating placeholders...');
  try {
    execSync('node scripts/generate-placeholder-icons.js', { stdio: 'inherit' });
  } catch (error) {
    console.error('Failed to generate placeholder icons:', error);
  }
  console.log('');
}

// Copy popup.html
console.log('✓ Copying popup.html');
fs.copyFileSync(
  path.join(extensionDir, 'popup.html'),
  path.join(distDir, 'popup.html')
);

// Copy load-config.js
console.log('✓ Copying load-config.js');
fs.copyFileSync(
  path.join(extensionDir, 'load-config.js'),
  path.join(distDir, 'load-config.js')
);

// Copy init.js
console.log('✓ Copying init.js');
fs.copyFileSync(
  path.join(extensionDir, 'init.js'),
  path.join(distDir, 'init.js')
);

// Copy manifest.json
console.log('✓ Copying manifest.json');
fs.copyFileSync(
  path.join(extensionDir, 'manifest.json'),
  path.join(distDir, 'manifest.json')
);

// Copy background.js
console.log('✓ Copying background.js');
fs.copyFileSync(
  path.join(extensionDir, 'background.js'),
  path.join(distDir, 'background.js')
);

// Copy content.js
console.log('✓ Copying content.js');
fs.copyFileSync(
  path.join(extensionDir, 'content.js'),
  path.join(distDir, 'content.js')
);

// Copy icons folder
const iconsDest = path.join(distDir, 'icons');

if (!fs.existsSync(iconsDest)) {
  fs.mkdirSync(iconsDest, { recursive: true });
}

console.log('✓ Copying icons');
const iconFiles = fs.readdirSync(iconsSource);
iconFiles.forEach(file => {
  if (file.endsWith('.png')) {
    fs.copyFileSync(
      path.join(iconsSource, file),
      path.join(iconsDest, file)
    );
  }
});

// Create a simple README for the extension
const readmeContent = `# Rupt Chrome Extension - Built Package

Este é o pacote compilado da extensão Rupt.

## Instalação

1. Abra chrome://extensions/
2. Ative o "Modo do desenvolvedor"
3. Clique em "Carregar sem compactação"
4. Selecione esta pasta (extension-dist)

## Atalho

Ctrl+Shift+T (Windows/Linux) ou Cmd+Shift+T (Mac)

## Desenvolvimento

Para reconstruir a extensão, execute na raiz do projeto:
\`\`\`
npm run build:extension
\`\`\`
`;

fs.writeFileSync(path.join(distDir, 'README.txt'), readmeContent);

console.log('\n✅ Extension built successfully!');
console.log(`📂 Output: ${distDir}`);
console.log('\n📌 Next steps:');
console.log('   1. Open chrome://extensions/');
console.log('   2. Enable "Developer mode"');
console.log('   3. Click "Load unpacked"');
console.log('   4. Select the extension-dist folder');
console.log('\n🚀 Ready to test!');
