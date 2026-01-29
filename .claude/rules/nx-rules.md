# Nx Workspace Rules

This is an Nx workspace using **Nx 20.8.2** and **npm** as the package manager.

## General Guidelines

- Use Nx commands for building, testing, linting, and running tasks
- When checking compilation after code changes, use: `npx nx run-many -t build --verbose`
- Use `npx nx affected` commands to only run tasks on packages affected by your changes
- Nx caches build results; use `--skip-nx-cache` when you need a fresh build

## Common Commands

```bash
# Build
npx nx run <package>:build              # Single package
npx nx run-many -t build --parallel=5   # All packages
npx nx run-many -t build --verbose      # Compilation check

# Test
npx nx run <package>:test               # Single package
npx nx run-many -t test                 # All packages
npx nx affected -t test                 # Affected only

# Lint
npx nx run <package>:lint               # Single package
npx nx affected -t lint                 # Affected only

# Typecheck
npx nx run <package>:typecheck          # Single package
npx nx affected -t typecheck            # Affected only
```
