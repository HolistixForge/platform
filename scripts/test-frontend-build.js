#!/usr/bin/env node
/**
 * @file Frontend Build Validation Tests
 *
 * These tests ensure that frontend builds are deterministic and production-ready.
 * They validate that:
 * 1. No development JSX runtime (jsxDEV) leaks into production bundles
 * 2. Library packages use production jsx-runtime
 *
 * Run with: node scripts/test-frontend-build.js
 * Or add to package.json: "test:build": "node scripts/test-frontend-build.js"
 */

const fs = require('fs');
const path = require('path');

const FRONTEND_DIST = path.join(__dirname, '../packages/app-frontend/dist');
const LIBRARY_PACKAGES = [
  { name: 'ui-base', path: 'packages/ui-base/dist/index.js' },
  { name: 'frontend-data', path: 'packages/frontend-data/dist/index.js' },
  { name: 'ui-views', path: 'packages/ui-views/dist/index.js' },
  { name: 'module', path: 'packages/modules/module/dist/frontend.js' },
];

let testsPassed = 0;
let testsFailed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    testsPassed++;
    console.log(`✅ ${name}`);
  } catch (error) {
    testsFailed++;
    failures.push({ name, error: error.message });
    console.error(`❌ ${name}`);
    console.error(`   ${error.message}`);
  }
}

function expect(value) {
  return {
    toBe(expected) {
      if (value !== expected) {
        throw new Error(`Expected ${value} to be ${expected}`);
      }
    },
    toBeGreaterThan(expected) {
      if (value <= expected) {
        throw new Error(`Expected ${value} to be greater than ${expected}`);
      }
    },
    toBeLessThan(expected) {
      if (value >= expected) {
        throw new Error(`Expected ${value} to be less than ${expected}`);
      }
    },
    toMatch(pattern) {
      if (!pattern.test(value)) {
        throw new Error(`Expected "${value}" to match ${pattern}`);
      }
    },
    toContain(substring) {
      if (!value.includes(substring)) {
        throw new Error(`Expected "${value}" to contain "${substring}"`);
      }
    },
  };
}

console.log('\n🧪 Frontend Build Validation Tests\n');

// Check if frontend is built
if (!fs.existsSync(FRONTEND_DIST)) {
  console.error(`❌ Frontend not built. Run: npx nx build app-frontend`);
  console.error(`   Expected directory: ${FRONTEND_DIST}`);
  process.exit(1);
}

// Test 1: No jsxDEV in frontend bundle
test('Frontend bundle should not contain jsxDEV function calls', () => {
  const assetsDir = path.join(FRONTEND_DIST, 'assets');
  if (!fs.existsSync(assetsDir)) {
    throw new Error(`Assets directory not found: ${assetsDir}`);
  }

  const jsFiles = fs
    .readdirSync(assetsDir)
    .filter((file) => file.endsWith('.js'))
    .map((file) => path.join(assetsDir, file));

  expect(jsFiles.length).toBeGreaterThan(0);

  const problematicFiles = [];

  for (const file of jsFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    // Look for jsxDEV function calls (not safe definitions like "jsxDEV=void 0")
    const matches = content.match(/jsxDEV\(/g);
    if (matches && matches.length > 0) {
      problematicFiles.push({
        file: path.basename(file),
        count: matches.length,
      });
    }
  }

  if (problematicFiles.length > 0) {
    const details = problematicFiles
      .map(({ file, count }) => `     ${file}: ${count} jsxDEV calls`)
      .join('\n');

    throw new Error(
      `Found problematic jsxDEV calls in production bundle:\n${details}\n` +
        `   This will cause runtime errors: "jsxDEV is not a function"\n` +
        `   Fix: Rebuild libraries with production JSX runtime`
    );
  }
});

// Test 2: Reasonable bundle sizes
test('Frontend bundle should have reasonable sizes', () => {
  const assetsDir = path.join(FRONTEND_DIST, 'assets');
  const indexFiles = fs
    .readdirSync(assetsDir)
    .filter((file) => file.startsWith('index-') && file.endsWith('.js'))
    .map((file) => ({
      name: file,
      size: fs.statSync(path.join(assetsDir, file)).size,
    }));

  expect(indexFiles.length).toBeGreaterThan(0);

  // Main bundle should be less than 3MB (uncompressed)
  const mainBundle = indexFiles.reduce((max, file) =>
    file.size > max.size ? file : max
  );

  expect(mainBundle.size).toBeLessThan(3 * 1024 * 1024);
});

// Test 3: Library packages use production jsx-runtime
test('Library packages should use production jsx-runtime', () => {
  const problematicPackages = [];

  for (const pkg of LIBRARY_PACKAGES) {
    const pkgPath = path.join(__dirname, '..', pkg.path);

    // Skip if package doesn't exist (might not be built yet)
    if (!fs.existsSync(pkgPath)) {
      console.log(`   ⚠️  Skipping ${pkg.name}: not built`);
      continue;
    }

    const content = fs.readFileSync(pkgPath, 'utf-8');
    if (content.includes('jsx-dev-runtime')) {
      problematicPackages.push(pkg.name);
    }
  }

  if (problematicPackages.length > 0) {
    throw new Error(
      `Library packages using development jsx-dev-runtime:\n` +
        problematicPackages.map((name) => `     - ${name}`).join('\n') +
        '\n' +
        `   These packages should use production jsx-runtime.\n` +
        `   Fix: Rebuild with --skip-nx-cache`
    );
  }
});

// Test 4: Consistent file naming
test('Build should have consistent file naming', () => {
  const assetsDir = path.join(FRONTEND_DIST, 'assets');
  const files = fs.readdirSync(assetsDir);

  // All JS files should have content hashes in their names
  const jsFiles = files.filter((f) => f.endsWith('.js'));
  for (const file of jsFiles) {
    // Format: name-[hash].js (name can contain dots, e.g., image-blob-reduce.esm)
    expect(file).toMatch(/^[\w.-]+-[A-Za-z0-9_-]+\.js$/);
  }
});

// Test 5: index.html has correct asset references
test('index.html should have correct asset references', () => {
  const indexPath = path.join(FRONTEND_DIST, 'index.html');
  expect(fs.existsSync(indexPath)).toBe(true);

  const content = fs.readFileSync(indexPath, 'utf-8');

  // Should reference assets with hashes
  expect(content).toMatch(/assets\/index-[A-Za-z0-9_-]+\.js/);
  expect(content).toMatch(/assets\/index-[A-Za-z0-9_-]+\.css/);
});

// Summary
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`📊 Test Results: ${testsPassed} passed, ${testsFailed} failed`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

if (testsFailed > 0) {
  console.error('❌ Some tests failed. Frontend build may have issues.\n');
  process.exit(1);
} else {
  console.log(
    '✅ All tests passed! Frontend build is valid and deterministic.\n'
  );
  process.exit(0);
}
