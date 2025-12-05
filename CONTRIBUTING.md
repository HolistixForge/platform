# Contributing to Demiurge

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
git clone https://github.com/YourOrg/demiurge.git
cd demiurge

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

### 4. Commit Your Changes

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

- Implement PowerDNS integration
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

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub.

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

By contributing code to Demiurge, you agree that:

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

For more information about AGPL-3.0, see https://choosealicense.com/licenses/agpl-3.0/

## 🙋 Questions?

- Check [doc/README.md](doc/README.md) for documentation hub
- Ask in GitHub Discussions
- Join our community chat (TBD)

Thank you for contributing! 🎉
