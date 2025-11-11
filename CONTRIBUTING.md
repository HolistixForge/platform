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

### Prerequisites

- **Node.js** 20+ (LTS recommended)
- **npm** 10+
- **Docker** 24+ (for containers)
- **PostgreSQL** 15+ (for local database)
- **Git** 2.40+

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

# Run in watch mode
npx nx run app-ganymede:serve

# Build all packages
npx nx run-many -t build
```

### 3. Test Your Changes

```bash
# Run tests for specific package
npx nx run app-ganymede:test

# Run all tests
npx nx run-many -t test
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

## 💅 Coding Standards

### TypeScript

- **Strict mode enabled** - No implicit `any`
- **Use interfaces** for data structures
- **Use types** for unions and utility types
- **Explicit return types** for public functions
- **Use `const`** by default, `let` when needed, avoid `var`

**Example:**

```typescript
// ✅ Good
export interface UserContainer {
  id: string;
  name: string;
  imageId: string;
}

export async function createContainer(
  data: UserContainer
): Promise<UserContainer> {
  // Implementation
}

// ❌ Bad
export function createContainer(data) {
  // No types
  // Implementation
}
```

### React/Frontend

- **Functional components** with hooks
- **TypeScript props interfaces**
- **SCSS modules** for styling
- **Descriptive component names** (PascalCase)

**Example:**

```tsx
interface UserContainerCardProps {
  container: UserContainer;
  onDelete: (id: string) => void;
}

export const UserContainerCard: React.FC<UserContainerCardProps> = ({
  container,
  onDelete,
}) => {
  return (
    <div className={styles.card}>
      <h3>{container.name}</h3>
      <button onClick={() => onDelete(container.id)}>Delete</button>
    </div>
  );
};
```

### Backend/Express

- **Use `asyncHandler`** for async routes
- **OpenAPI validation** for all endpoints
- **Consistent error handling**
- **Logging** with `@monorepo/log`

**Example:**

```typescript
import { asyncHandler } from '../middleware/route-handler';

router.post(
  '/user-containers',
  asyncHandler(async (req: Req, res) => {
    const container = await createContainer(req.body);
    return res.status(201).json(container);
  })
);
```

### File Naming

- **TypeScript:** `kebab-case.ts`
- **React:** `PascalCase.tsx` for components
- **Tests:** `*.spec.ts` or `*.test.ts`
- **Styles:** `kebab-case.module.scss`

## 🧪 Testing

### Unit Tests

```bash
# Run tests for specific package
npx nx run user-containers:test

# Run tests in watch mode
npx nx run user-containers:test --watch

# Run all tests
npx nx run-many -t test
```

### Module Testing (Storybook)

See [doc/guides/MODULES_TESTING.md](doc/guides/MODULES_TESTING.md) for testing modules in isolation.

```bash
# Run storybook for UI components
npx nx run demiurge-ui-components:storybook
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

## 🔍 Code Review Process

### Before Requesting Review

- [ ] Tests pass locally
- [ ] Code follows style guidelines
- [ ] Documentation updated
- [ ] Commit messages are clear
- [ ] No merge conflicts

### Review Guidelines

**Reviewers should check:**

- Code correctness and logic
- Test coverage
- Performance implications
- Security concerns
- Documentation completeness

**Review comments should be:**

- Constructive and specific
- Include suggestions when possible
- Distinguish between blocking and non-blocking issues

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

## 🙋 Questions?

- Check [doc/README.md](doc/README.md) for documentation hub
- Ask in GitHub Discussions
- Join our community chat (TBD)

Thank you for contributing! 🎉
