# Contributing to Holistix Forge

Thank you for your interest in contributing! This guide will help you set up your development environment and understand our workflow.

## 📋 Table of Contents

- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Documentation](#documentation)

## 🚀 Development Setup

### Quick Setup

See **[doc/guides/LOCAL_DEVELOPMENT.md](doc/guides/LOCAL_DEVELOPMENT.md)** for comprehensive setup instructions.

**TL;DR:**

```bash
# Clone repository
git clone https://github.com/HolistixForge/platform.git
cd holistix

# Install dependencies
npm install

# Build all packages
npx nx run-many -t build

# Start local development environment
cd scripts/local-dev
./setup-all.sh                    # One-time setup
./create-env.sh dev-001          # Create environment
./build-frontend.sh dev-001      # Build frontend
/root/.local-dev/dev-001/start.sh  # Start services
```

## 📁 Project Structure

This is an **Nx monorepo** with multiple packages:

```
packages/
├── app-ganymede/        # Main API (users, orgs, projects, auth)
├── app-gateway/         # Gateway (collaboration, containers, OAuth)
├── app-frontend/        # React frontend
├── app-ganymede-cmds/   # CLI tools
├── modules/             # Feature modules (extensible)
│   ├── core/            # Core graph/node system
│   ├── user-containers/ # Container management
│   ├── jupyter/         # JupyterLab integration
│   └── ...
├── ui-*/                # UI component libraries
└── backend-engine/      # Express utilities
```

See [doc/guides/NX_WORKSPACE.md](doc/guides/NX_WORKSPACE.md) for Nx commands and workflows.

## 📏 Coding Standards

### TypeScript

- ✅ **Strict mode enabled** - No implicit any, strict null checks
- ✅ **No unused variables** - Clean up unused imports and variables
- ✅ **Explicit return types** - For public APIs and exported functions
- ✅ **Type over `any`** - Use proper types or `unknown` instead of `any`

### ESLint Rules

Key enforced rules:
- `@nx/enforce-module-boundaries` - Respect package dependencies
- `@typescript-eslint/no-explicit-any` - Avoid `any` type
- `@typescript-eslint/no-unused-vars` - No unused variables
- Standard TypeScript and React best practices

### Code Style

- **Prettier** handles all formatting automatically
- **2 spaces** for indentation
- **Single quotes** for strings (enforced by Prettier)
- **Semicolons** required (enforced by Prettier)

**No need to manually format** - pre-commit hooks handle this!

## 🔄 Development Workflow

### 1. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

### 2. Make Changes

```bash
# Build specific package
npx nx run app-ganymede:build

# Build all packages
npx nx run-many -t build
```

### 3. Run Validation (Optional but Recommended)

Before committing, you can manually validate your changes:

```bash
# Validate only affected packages (fast)
npm run validate:affected

# Or validate everything (slower)
npm run validate
```

These commands run:
- **ESLint** - Code linting
- **TypeScript** - Type checking
- **Jest** - Tests

### 4. Commit Your Changes

**Pre-Commit Checks (Automatic):**

When you commit, the following checks run automatically:
1. ✅ **TypeScript type checking** on staged `.ts`/`.tsx` files
2. ✅ **ESLint** with auto-fix on staged files
3. ✅ **Prettier** formatting on staged files
4. ✅ **Tests** for affected packages

**If any check fails, the commit will be blocked.**

**Commit Message Format:**

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Formatting, missing semicolons, etc.
- `refactor`: Code restructuring
- `test`: Adding tests
- `chore`: Build process, dependencies

**Examples:**

```
feat(user-containers): add DNS-based stable URLs

- Use wildcard DNS for container resolution
- Generate unique slugs for containers
- Update nginx configuration for server blocks

Closes #123
```

```
fix(gateway): resolve permission check race condition

The permission manager was checking stale data from cache.
Now forces fresh read from GatewayState.

Fixes #456
```

### 5. Push and Create Pull Request

**Before Pushing (Optional but Recommended):**

```bash
# Validate affected packages before pushing
npm run pre-push
```

**Push your changes:**

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub.

**CI/CD Validation:**

Once you create a PR, GitHub Actions will automatically:
1. ✅ Run ESLint on all packages
2. ✅ Run TypeScript type checking on all packages
3. ✅ Build all packages
4. ✅ Run all tests

**If CI fails, you'll need to fix the issues before merging.**

## 🔍 Code Quality & Validation

### Available Validation Commands

```bash
# Lint all packages
npm run lint

# Lint and auto-fix issues
npm run lint:fix

# Type check all packages
npm run typecheck

# Test all packages
npm run test

# Run all validations (lint + typecheck + test)
npm run validate

# Run validations only on affected packages (faster)
npm run validate:affected

# Pre-push validation (recommended before pushing)
npm run pre-push
```

### Pre-Commit Hooks

We use **Husky** and **lint-staged** to enforce code quality before commits.

**What runs automatically on `git commit`:**

1. **TypeScript type checking** - Staged `.ts`/`.tsx` files checked with `tsc-files`
2. **ESLint** - Lints and auto-fixes staged files
3. **Prettier** - Formats staged files
4. **Tests** - Runs tests for affected packages

**If any check fails, your commit will be blocked.**

### Bypassing Pre-Commit Hooks

In rare cases, you may need to bypass hooks:

```bash
git commit --no-verify
```

**⚠️ Use sparingly!** CI will still enforce all checks.

### CI/CD Validation

Our CI pipeline runs on every push and PR:

1. **ESLint** - Lint all packages
2. **TypeScript** - Type check all packages
3. **Build** - Build all packages
4. **Test** - Run all tests

**All checks must pass before merging.**

## 🧪 Testing

### Module Testing (Storybook)

See [doc/guides/MODULES_TESTING.md](doc/guides/MODULES_TESTING.md) for testing modules in isolation.

```bash
# Run storybook
npx nx run [package]:storybook
```

### Integration Testing

Test full stack locally using the development environment setup. See [doc/guides/LOCAL_DEVELOPMENT.md](doc/guides/LOCAL_DEVELOPMENT.md).

## 📝 Documentation

### When to Update Docs

- **New features:** Document in relevant guide
- **API changes:** Update `doc/reference/API.md`
- **Architecture changes:** Update `doc/architecture/`
- **Breaking changes:** Highlight in PR description

### Documentation Structure

```
doc/
├── architecture/     # System design, refactoring
├── guides/          # How-to guides
├── reference/       # Quick reference (API, cheatsheet)
├── internal/        # WIP/personal docs
└── archive/         # Historical docs
```

### Writing Style

- **Clear and concise** - Avoid jargon
- **Use examples** - Code examples for clarity
- **Keep updated** - Remove outdated info
- **Link references** - Link to related docs

## 🐛 Reporting Bugs

Create an issue with:

- **Clear title** describing the bug
- **Steps to reproduce**
- **Expected behavior**
- **Actual behavior**
- **Environment** (OS, Node version, etc.)
- **Logs/screenshots** if applicable

## 💡 Feature Requests

Create an issue with:

- **Use case** - Why is this needed?
- **Proposed solution** - How should it work?
- **Alternatives considered** - Other approaches?

## 📚 Additional Resources

- [Nx Documentation](https://nx.dev)
- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Express.js Guide](https://expressjs.com/)

## 📄 Licensing

### Contributor License Agreement

By contributing code to Holistix Forge, you agree that:

- Your contributions will be licensed under the GNU Affero General Public License v3.0 (AGPL-3.0)
- You retain copyright to your contributions
- You have the right to grant this license
- Your contributions are your original work or you have permission to contribute them

### License Compatibility

When contributing, ensure that:

- Your code doesn't include third-party code with incompatible licenses
- You have the right to contribute the code (it's your original work or you have permission)
- Any third-party code you include is compatible with AGPL-3.0
- You comply with the copyleft requirements of AGPL-3.0

The AGPL-3.0 license requires that:

- All derivative works must be licensed under AGPL-3.0
- Source code must be made available when distributing the software
- If you run a modified version as a service over a network, you must make the source code available to users

## 🙋 Questions?

- Check [doc/README.md](doc/README.md) for documentation hub
- Ask in GitHub Discussions
- Join our community chat (TBD)

Thank you for contributing! 🎉
