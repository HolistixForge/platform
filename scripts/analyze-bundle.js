#!/usr/bin/env node
/**
 * Bundle analyzer for Node.js applications
 * Checks for React/frontend dependencies that shouldn't be in backend bundles
 */

const fs = require('fs');
const path = require('path');

const FORBIDDEN_PATTERNS = [
  { pattern: /require\s*\(\s*['"]react['"]\s*\)/g, name: 'React' },
  { pattern: /require\s*\(\s*['"]react-dom['"]\s*\)/g, name: 'React DOM' },
  { pattern: /require\s*\(\s*['"]react\/jsx-runtime['"]\s*\)/g, name: 'React JSX Runtime' },
  { pattern: /require\s*\(\s*['"]react-hotkeys-hook['"]\s*\)/g, name: 'React Hotkeys Hook' },
  { pattern: /from\s+['"]react['"]/g, name: 'React (ES import)' },
];

const FORBIDDEN_FILES = [
  '/frontend.js',
  '/frontend.d.ts',
  'dist/frontend.js',
];

function analyzeBundleFile(filePath) {
  console.log(`\n📦 Analyzing: ${filePath}`);
  console.log(`   Size: ${(fs.statSync(filePath).size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Lines: ${fs.readFileSync(filePath, 'utf8').split('\n').length.toLocaleString()}`);
  
  const content = fs.readFileSync(filePath, 'utf8');
  const errors = [];
  
  // Check for forbidden patterns
  for (const { pattern, name } of FORBIDDEN_PATTERNS) {
    const matches = [...content.matchAll(pattern)];
    if (matches.length > 0) {
      errors.push({
        type: 'forbidden_require',
        name,
        count: matches.length,
        samples: matches.slice(0, 3).map(m => {
          const lineNum = content.substring(0, m.index).split('\n').length;
          const line = content.split('\n')[lineNum - 1];
          return { line: lineNum, code: line.trim().substring(0, 100) };
        })
      });
    }
  }
  
  // Check for frontend file references
  const lines = content.split('\n');
  for (const forbiddenFile of FORBIDDEN_FILES) {
    const matchingLines = lines
      .map((line, idx) => ({ line: idx + 1, content: line }))
      .filter(({ content }) => content.includes(forbiddenFile));
    
    if (matchingLines.length > 0) {
      errors.push({
        type: 'frontend_file_reference',
        name: `Frontend file: ${forbiddenFile}`,
        count: matchingLines.length,
        samples: matchingLines.slice(0, 3).map(({ line, content }) => ({
          line,
          code: content.trim().substring(0, 100)
        }))
      });
    }
  }
  
  return errors;
}

function printResults(bundlePath, errors) {
  if (errors.length === 0) {
    console.log(`\n✅ ${bundlePath}: Clean! No React dependencies found.`);
    return true;
  }
  
  console.log(`\n❌ ${bundlePath}: Found ${errors.length} issue(s):\n`);
  
  for (const error of errors) {
    console.log(`   ⚠️  ${error.name}: ${error.count} occurrence(s)`);
    if (error.samples && error.samples.length > 0) {
      console.log(`      Samples:`);
      for (const sample of error.samples) {
        console.log(`        Line ${sample.line}: ${sample.code}`);
      }
    }
    console.log();
  }
  
  return false;
}

// Main
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node analyze-bundle.js <bundle-file.js> [<bundle-file2.js> ...]');
  process.exit(1);
}

let allClean = true;

for (const bundlePath of args) {
  if (!fs.existsSync(bundlePath)) {
    console.error(`❌ File not found: ${bundlePath}`);
    allClean = false;
    continue;
  }
  
  const errors = analyzeBundleFile(bundlePath);
  const isClean = printResults(bundlePath, errors);
  allClean = allClean && isClean;
}

if (!allClean) {
  console.log('\n' + '='.repeat(80));
  console.log('❌ BUILD VALIDATION FAILED: React dependencies found in backend bundle');
  console.log('='.repeat(80));
  process.exit(1);
} else {
  console.log('\n' + '='.repeat(80));
  console.log('✅ All bundles are clean!');
  console.log('='.repeat(80));
  process.exit(0);
}


