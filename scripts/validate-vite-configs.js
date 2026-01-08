#!/usr/bin/env node
/**
 * Validate Vite Configs - Ensures all React packages have correct JSX transform
 *
 * This script checks that all vite.config.ts files either:
 * 1. Use the shared base config (getBaseReactConfig)
 * 2. Have explicit mode parameter with development: mode === 'development'
 *
 * Run: node scripts/validate-vite-configs.js
 *
 * Exit codes:
 * - 0: All configs valid
 * - 1: Found invalid configs
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('\n🔍 Validating Vite Configurations\n');

// Find all vite.config.ts files
const viteConfigs = execSync('find packages -name "vite.config.ts" -type f', {
  encoding: 'utf-8',
  cwd: path.join(__dirname, '..'),
})
  .trim()
  .split('\n')
  .filter(Boolean);

console.log(`Found ${viteConfigs.length} vite.config.ts files\n`);

const invalidConfigs = [];
const validConfigs = [];
const warnings = [];

for (const configPath of viteConfigs) {
  const fullPath = path.join(__dirname, '..', configPath);
  const content = fs.readFileSync(fullPath, 'utf-8');

  // Check if it uses the base config
  const usesBaseConfig =
    content.includes('getBaseReactConfig') ||
    content.includes('getBaseReactLibraryConfig');

  // Check if it has the mode parameter fix
  const hasModeParameter =
    content.includes('({ mode })') || content.includes('({ command, mode })');

  const hasDevelopmentMode = content.includes(
    "development: mode === 'development'"
  );

  // Check if it uses React plugin
  const usesReactPlugin = content.includes('@vitejs/plugin-react');

  // Skip non-React configs
  if (!usesReactPlugin) {
    console.log(`⏭️  ${configPath} - Skipped (no React plugin)`);
    validConfigs.push(configPath);
    continue;
  }

  // Validate
  if (usesBaseConfig) {
    console.log(`✅ ${configPath} - Uses base config`);
    validConfigs.push(configPath);
  } else if (hasModeParameter && hasDevelopmentMode) {
    console.log(`✅ ${configPath} - Has mode parameter fix`);
    validConfigs.push(configPath);
  } else if (hasModeParameter && !hasDevelopmentMode) {
    console.warn(
      `⚠️  ${configPath} - Has mode parameter but missing babel config`
    );
    warnings.push({
      path: configPath,
      issue:
        'Has mode parameter but might not be using it correctly for JSX transform',
    });
    validConfigs.push(configPath); // Warning, not error
  } else {
    console.error(`❌ ${configPath} - Missing mode parameter or base config`);
    invalidConfigs.push({
      path: configPath,
      issue: 'Does not use base config or mode parameter for JSX transform',
    });
  }
}

// Summary
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(
  `📊 Results: ${validConfigs.length} valid, ${warnings.length} warnings, ${invalidConfigs.length} invalid`
);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

if (warnings.length > 0) {
  console.log('⚠️  Warnings:\n');
  warnings.forEach(({ path, issue }) => {
    console.log(`  ${path}`);
    console.log(`    → ${issue}\n`);
  });
}

if (invalidConfigs.length > 0) {
  console.log('❌ Invalid Configurations:\n');
  invalidConfigs.forEach(({ path, issue }) => {
    console.log(`  ${path}`);
    console.log(`    → ${issue}\n`);
  });

  console.log('💡 To fix:\n');
  console.log('  Add mode parameter with babel config:');
  console.log('     ```typescript');
  console.log('     export default defineConfig(({ mode }) => ({');
  console.log('       plugins: [');
  console.log('         react({');
  console.log('           babel: {');
  console.log("             plugins: [['@babel/plugin-transform-react-jsx', {");
  console.log("               runtime: 'automatic',");
  console.log("               development: mode === 'development',");
  console.log('             }]],');
  console.log('           },');
  console.log('         }),');
  console.log('       ],');
  console.log('     }));');
  console.log('     ```\n');

  process.exit(1);
}

if (warnings.length > 0) {
  console.log('✅ All configs valid (with warnings)\n');
  process.exit(0);
}

console.log('✅ All Vite configs are valid!\n');
process.exit(0);
