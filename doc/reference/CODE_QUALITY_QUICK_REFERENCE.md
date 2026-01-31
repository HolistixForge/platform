# Code Quality Quick Reference

Quick reference for linting, type checking, and validation in the Holistix Forge platform.

---

## 🚀 Quick Commands

```bash
# Validate affected packages (recommended before push)
npm run validate:affected

# Lint all packages
npm run lint

# Fix linting issues automatically
npm run lint:fix

# Type check all packages
npm run typecheck

# Run tests
npm run test

# Full validation (lint + typecheck + test)
npm run validate
```

---

## 🔄 Automatic Checks

### On Commit (Pre-Commit Hook)

Automatically runs when you `git commit`:

1. ✅ **TypeScript type checking** on staged `.ts`/`.tsx` files
2. ✅ **ESLint** with auto-fix on staged files
3. ✅ **Prettier** formatting on staged files
4. ✅ **Tests** for affected packages

**Commit is blocked if any check fails.**

### On Push/PR (CI/CD)

Automatically runs on GitHub Actions:

1. ✅ **ESLint** on all packages
2. ✅ **TypeScript type checking** on all packages
3. ✅ **Build** all packages
4. ✅ **Test** all packages

**PR cannot be merged if CI fails.**

---

## 🛠️ Tools Used

- **ESLint** - JavaScript/TypeScript linting
- **TypeScript Compiler** - Type checking
- **Prettier** - Code formatting
- **Jest** - Testing
- **Husky** - Git hooks
- **lint-staged** - Pre-commit validation
- **tsc-files** - Fast type checking of staged files
- **Nx** - Monorepo build system

---

## 📝 Common Tasks

### Before Committing

```bash
# Check what will be validated
npm run validate:affected
```

### Commit Changes

```bash
git add .
git commit -m "feat(scope): description"

# Pre-commit hooks run automatically
# If they fail, fix issues and try again
```

### Bypass Pre-Commit (Emergency Only)

```bash
git commit --no-verify

# ⚠️ Use rarely! CI will still enforce checks.
```

### Before Pushing

```bash
# Validate affected packages
npm run pre-push

# Push if validation passes
git push
```

### Fix Linting Issues

```bash
# Auto-fix all fixable issues
npm run lint:fix

# Check if any issues remain
npm run lint
```

### Fix Type Errors

```bash
# Run type check to see errors
npm run typecheck

# Fix errors manually (no auto-fix for types)
```

---

## 🐛 Troubleshooting

### Pre-commit hook is slow

**Symptom:** Commits take too long.

**Solution:**
- Pre-commit only checks staged files (fast)
- If still slow, check what tests are running
- Consider `git commit --no-verify` in emergencies (but fix issues later)

### Type check fails but I can't see the error

**Symptom:** Pre-commit says type check failed but error is unclear.

**Solution:**
```bash
# Run type check manually to see full error
npm run typecheck

# Or check specific package
npx nx run <package-name>:typecheck
```

### ESLint fails with "parsing error"

**Symptom:** ESLint can't parse a file.

**Solution:**
- Check for syntax errors in the file
- Ensure the file is valid TypeScript/JavaScript
- Check if file extension is correct (`.ts`, `.tsx`, `.js`, `.jsx`)

### Tests fail in pre-commit but pass locally

**Symptom:** Pre-commit tests fail but `npm run test` passes.

**Solution:**
- Pre-commit runs tests for affected packages only
- Check which packages are affected: `npx nx affected:test --uncommitted`
- Run those specific tests: `npx nx run <package-name>:test`

### CI fails but local validation passes

**Symptom:** GitHub Actions fails but local validation passes.

**Solution:**
- CI runs on all packages, local may run on affected only
- Run full validation locally: `npm run validate`
- Check CI logs for specific package and error
- Ensure dependencies are up to date: `npm ci`

---

## 📊 ESLint Rules

### Enforced as Errors

- `@nx/enforce-module-boundaries` - Respect package dependencies
- Standard TypeScript and React errors

### Common Warnings (Currently)

- `@typescript-eslint/no-explicit-any` - Avoid `any` type
- `@typescript-eslint/no-unused-vars` - No unused variables
- `@typescript-eslint/no-non-null-assertion` - Avoid `!` operator

**Note:** Some packages have existing warnings. Goal is to eliminate these gradually.

---

## 🎯 Best Practices

### Before Starting Work

```bash
# Pull latest changes
git pull

# Install dependencies (if package.json changed)
npm ci

# Ensure everything builds
npm run validate:affected
```

### During Development

```bash
# Check your changes frequently
npm run validate:affected

# Fix linting issues as you go
npm run lint:fix
```

### Before Committing

```bash
# Final validation
npm run validate:affected

# Commit (pre-commit hooks will run)
git commit -m "feat(scope): description"
```

### Before Pushing

```bash
# Ensure affected packages pass all checks
npm run pre-push

# Push if validation passes
git push
```

---

## 📚 Related Documentation

- [CONTRIBUTING.md](../../CONTRIBUTING.md) - Full contribution guide
- [LINTING_AND_PRE_COMMIT_ANALYSIS.md](../current-works/LINTING_AND_PRE_COMMIT_ANALYSIS.md) - Detailed analysis and recommendations
- [Nx Workspace Guide](../guides/NX_WORKSPACE.md) - Nx commands and workflows
- [Testing Guide](../guides/TESTING_GUIDE.md) - Testing best practices

---

## 🆘 Getting Help

If you encounter issues with code quality checks:

1. Check this reference first
2. Read detailed analysis: [LINTING_AND_PRE_COMMIT_ANALYSIS.md](../current-works/LINTING_AND_PRE_COMMIT_ANALYSIS.md)
3. Ask in GitHub Discussions
4. Create an issue if you think there's a bug in the tooling

---

**Last Updated:** 2026-01-15

