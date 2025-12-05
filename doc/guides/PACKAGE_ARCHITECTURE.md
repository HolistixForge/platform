# Package Architecture & React Dependency Management

This guide explains the package architecture patterns and React dependency validation required for the monorepo.

**Last Updated:** December 3, 2025

---

## Quick Reference

### Validate Bundles

```bash
# Validate all backend bundles
./scripts/validate-node-bundles.sh

# Analyze specific bundle
node scripts/analyze-bundle.js dist/packages/app-gateway/main.js
```

### Create New Package with Frontend/Backend

create a new react package, see **[NX_WORKSPACE](NX_WORKSPACE.md)**

```typescript
// 1. Create dual entry points
src/index.ts        // Backend (NO React)
src/frontend.ts     // Frontend (CAN have React)

// 2. Configure package.json exports
{
  "exports": {
    ".": "./dist/index.js",
    "./frontend": "./dist/frontend.js"
  }
}

// 3. Configure vite.config.ts
{
  entry: {
    index: 'src/index.ts',
    frontend: 'src/frontend.ts',
  }
}
```

---

## Bundle Validation

### Critical Requirement

**Backend Node.js bundles MUST be React-free.**

**Why:**

- React is marked as `external` in build config
- If imported, esbuild leaves `require("react")` calls in bundle
- Gateway containers don't have React installed
- Runtime crash: "Cannot find module 'react'"

### Validation Tools

**`scripts/analyze-bundle.js`**

- Analyzes individual JavaScript bundles
- Detects: `require("react")`, `require("react-dom")`, JSX runtime, frontend files
- Shows line numbers and code samples

**`scripts/validate-node-bundles.sh`**

- Validates all backend applications
- Runs analyzer on: app-gateway, app-ganymede, app-ganymede-cmds
- Exits with error code if issues found

**Usage:**

```bash
# Validate all bundles
./scripts/validate-node-bundles.sh

# Analyze specific bundle
node scripts/analyze-bundle.js dist/packages/app-gateway/main.js
```

**Output:**

```
🔍 Validating Node.js application bundles...

📦 Analyzing: dist/packages/app-gateway/main.js
   Size: 8.83 MB
   Lines: 210,767

✅ Clean! No React dependencies found.

📦 Found 3 bundle(s) to validate

✅ All bundles are clean!
```

### Automatic Integration

Bundle validation runs automatically in:

- `scripts/local-dev/create-env.sh` (before packing gateway build)
- Prevents deployment of broken builds

---

## Package Architecture Standards

### Required Pattern

All packages with frontend/backend code must follow this structure:

```
packages/my-package/
├── src/
│   ├── index.ts          # Backend entry (NO React)
│   ├── frontend.ts       # Frontend entry (CAN have React)
│   └── lib/
│       ├── backend.ts    # Backend implementation
│       └── components.tsx # Frontend components
├── package.json          # Exports both entries
├── vite.config.ts        # Builds both entries
└── tsconfig.lib.json     # Excludes frontend from backend build
```

### Backend Entry Point (`index.ts`)

```typescript
// Backend-safe exports only
export { BackendClass } from './lib/backend';
export type { SomeType } from './lib/types';

// NO React
// NO hooks
// NO JSX
// NO imports from frontend files
```

### Frontend Entry Point (`frontend.ts`)

```typescript
// Frontend-only exports
export { useSomeHook } from './lib/hooks';
export { SomeComponent } from './lib/components';

// Re-export types for convenience
export type { SomeType } from './lib/types';
```

### Package Configuration (`package.json`)

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "default": "./dist/index.js"
    },
    "./frontend": {
      "types": "./dist/frontend.d.ts",
      "import": "./dist/frontend.js",
      "default": "./dist/frontend.js"
    }
  }
}
```

### Build Configuration (`vite.config.ts`)

```typescript
{
  build: {
    lib: {
      entry: {
        index: 'src/index.ts',
        frontend: 'src/frontend.ts',
      },
      fileName: (format, entryName) => `${entryName}.js`,
      formats: ['es'],
    }
  }
}
```

### TypeScript Configuration (`tsconfig.lib.json`)

```json
{
  "exclude": [
    "jest.config.ts",
    "src/**/*.spec.ts",
    "src/**/*.test.ts",
    "src/**/*.tsx",
    "src/frontend.ts"
  ]
}
```

### Import Patterns

**✅ Correct:**

```typescript
// In backend file
import { BackendClass } from '@holistix/pkg'; // Value import
import type { FrontendType } from '@holistix/pkg/frontend'; // Type import

// In frontend file
import { useSomeHook } from '@holistix/pkg/frontend'; // Value import OK
import { BackendClass } from '@holistix/pkg'; // Also OK
```

**❌ Wrong:**

```typescript
// In backend file
import { FrontendType } from '@holistix/pkg/frontend'; // Missing 'type' keyword!
```

---

## Troubleshooting React Dependencies

### Symptoms

**Build validation fails:**

```bash
❌ BUILD VALIDATION FAILED: React dependencies found in backend bundle
```

**Runtime error:**

```
Error: Cannot find module 'react'
```

### Diagnosis

```bash
# Run validator
./scripts/validate-node-bundles.sh

# Check specific bundle
node scripts/analyze-bundle.js dist/packages/app-gateway/main.js
```

**Output if issues found:**

```
❌ dist/packages/app-gateway/main.js: Found 1 issue(s):

   ⚠️  React: 4 occurrence(s)
      Line 181638: var e4 = require("react");
      Line 181853: var react = require("react");

❌ BUILD VALIDATION FAILED
```

### Common Fixes

**1. Missing `type` keyword:**

```typescript
// Wrong
import { TFrontendExports } from '@holistix/collab/frontend';

// Correct
import type { TFrontendExports } from '@holistix/collab/frontend';
```

**2. Backend exporting frontend code:**

```typescript
// packages/my-package/src/index.ts

// Wrong
export { useMyHook } from './lib/hooks';

// Correct - move to frontend.ts
// packages/my-package/src/frontend.ts
export { useMyHook } from './lib/hooks';
```

**3. Mixed React/non-React in same file:**

```typescript
// Wrong - both in one file
export class MyClass {}
export function useMyHook() {}

// Correct - separate files
// lib/my-class.ts
export class MyClass {}

// lib/my-hook.ts
export function useMyHook() {}
```

**4. TypeScript config not excluding `.tsx`:**

```json
// tsconfig.lib.json
{
  "exclude": ["src/**/*.tsx", "src/frontend.ts"]
}
```

**5. React imported at file level:**

```typescript
// Wrong - in backend-exported file
import { useState } from 'react'; // Top of file
export class MyClass {}

// Correct - separate the hook
// backend.ts (NO React)
export class MyClass {}

// hooks.tsx (HAS React)
import { useState } from 'react';
export function useMyHook() {}
```

### After Fixing

```bash
# Clear Nx cache
npx nx reset

# Rebuild
npx nx build <package>

# Validate
./scripts/validate-node-bundles.sh
```
