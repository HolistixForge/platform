# Code Quality Enforcement - Zero Errors Policy

**CRITICAL RULE:** All code changes MUST be error-free before completing any task. This is non-negotiable.

## Zero Errors Policy

Before completing ANY task that involves code changes, you MUST:

1. Verify no TypeScript compilation errors
2. Verify no ESLint errors (warnings are acceptable but should be noted)
3. Verify no build errors
4. Verify no test failures (for affected code)
5. Verify no linter errors in modified files

**If ANY errors exist after your changes, you MUST fix them before completing the task.**

## Required Validation Workflow

### Step 1: Before Making Changes

Check the current error state:

```bash
npx nx run-many -t lint --parallel=5
npx nx run-many -t typecheck --parallel=5
```

Document any pre-existing errors that are NOT caused by your changes.

### Step 2: After Making Changes

Validate immediately:

```bash
# Validate only affected packages (fast)
npm run validate:affected

# Or validate specific package
npx nx run <package-name>:lint
npx nx run <package-name>:typecheck
npx nx run <package-name>:test
```

### Step 3: Fix All Errors Introduced

1. Read the error messages carefully
2. Fix each error one by one
3. Re-run validation after each fix
4. Repeat until all errors are resolved

**DO NOT COMPLETE THE TASK until all errors are fixed.**

### Step 4: Check IDE Diagnostics

Use IDE diagnostics to check for linter errors in modified files and fix any reported errors.

## Error Detection Commands

### Comprehensive Validation

```bash
# Full validation (lint + typecheck + test)
npm run validate

# Affected packages only (faster)
npm run validate:affected
```

### Individual Checks

```bash
# ESLint (code quality)
npm run lint                              # All packages
npx nx run <package>:lint                 # Specific package
npx nx affected -t lint                   # Affected packages

# TypeScript (type checking)
npm run typecheck                         # All packages
npx nx run <package>:typecheck            # Specific package
npx nx affected -t typecheck              # Affected packages

# Tests
npm run test                              # All packages
npx nx run <package>:test                 # Specific package
npx nx affected -t test                   # Affected packages

# Build (compilation)
npx nx run <package>:build                # Specific package
npx nx run-many -t build --parallel=5     # All packages
```

### Build-Specific Validations

```bash
# Validate Vite configurations (React packages)
npm run validate:vite

# Validate Node.js bundles (no React in backend)
npm run validate:node

# Validate frontend build (production-ready)
npm run test:build
```

## Error Severity Levels

### Critical (MUST FIX)

- TypeScript compilation errors
- ESLint errors (not warnings)
- Build failures
- Test failures (in affected code)
- Pre-commit hook failures

**Task CANNOT be completed with critical errors.**

### High Priority (SHOULD FIX)

- ESLint warnings in new code
- TypeScript `@ts-ignore` or `@ts-expect-error` comments
- Unused imports or variables
- Console.log statements in production code

### Low Priority (DOCUMENT)

- Pre-existing errors not caused by current changes
- Deprecation warnings
- Style suggestions

**Document these but don't block task completion.**

## Workflow for Code Changes

### Standard Workflow

```
1. Read/Understand current code
2. Make changes
3. Check IDE diagnostics on modified files
4. Fix any linter errors
5. Run package-specific validation:
   - npx nx run <package>:lint
   - npx nx run <package>:typecheck
   - npx nx run <package>:test (if tests exist)
6. Fix ALL errors
7. Run affected validation: npm run validate:affected
8. If errors exist, go back to step 6
9. Document results
10. Complete task
```

### Workflow for Large Changes

```
1. Plan changes
2. Make changes incrementally (file by file or feature by feature)
3. Validate after EACH increment
4. Fix errors immediately (don't accumulate errors)
5. Continue to next increment
6. Final validation: npm run validate:affected
7. Complete task
```

## What NOT to Do

- NEVER complete task with errors remaining
- NEVER ignore validation failures
- NEVER use `@ts-ignore` to suppress errors without understanding and fixing the root cause
- NEVER assume pre-commit hooks will catch everything (they only check staged files)

## Pre-Commit Hook Integration

The project has pre-commit hooks that automatically run:

1. TypeScript type checking (tsc-files) on staged `.ts`/`.tsx` files
2. ESLint (with auto-fix) on staged files
3. Prettier formatting on staged files
4. Tests for affected packages

These hooks will block commits with errors. Validate BEFORE committing to avoid hook failures.

## Validation Tools Reference

| Tool                        | Purpose                    | When to Use             |
| --------------------------- | -------------------------- | ----------------------- |
| `npm run lint`              | Run ESLint on all packages | Before completing task  |
| `npm run typecheck`         | Type check all packages    | Before completing task  |
| `npm run validate:affected` | Validate affected packages | Before completing task  |
| `npm run validate`          | Full validation            | For comprehensive check |

### Package-Specific

| Command                      | Purpose                     |
| ---------------------------- | --------------------------- |
| `npx nx run <pkg>:lint`      | Lint specific package       |
| `npx nx run <pkg>:typecheck` | Type check specific package |
| `npx nx run <pkg>:test`      | Test specific package       |
| `npx nx run <pkg>:build`     | Build specific package      |

### Affected Commands

| Command                        | Purpose                      |
| ------------------------------ | ---------------------------- |
| `npx nx affected -t lint`      | Lint affected packages       |
| `npx nx affected -t typecheck` | Type check affected packages |
| `npx nx affected -t test`      | Test affected packages       |

## Troubleshooting

### "Validation fails but I don't see the error"

```bash
npx nx run <package>:typecheck --verbose
npx nx run <package>:lint --verbose
npx tsc --noEmit <file-path>
npx eslint <file-path>
```

### "Pre-commit hook blocks commit"

1. Don't bypass with `--no-verify`
2. Read the error message
3. Fix the error
4. Try committing again

### "Validation passes locally but fails in CI"

```bash
npm run validate
npm ci
npx nx run-many -t lint,typecheck --all
```

## Success Criteria

A task involving code changes is ONLY complete when:

1. All code changes are implemented as requested
2. No TypeScript errors exist in affected code
3. No ESLint errors exist in affected code
4. No build errors exist in affected code
5. No test failures exist in affected code
6. All validation checks pass (`npm run validate:affected`)

**Zero Errors. Every Time. No Exceptions.**
