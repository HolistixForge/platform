# Testing Enforcement Rule

**MANDATORY RULE:** Whenever you modify or create code files, you MUST check for associated tests and create them if they don't exist.

## Primary Reference

See `doc/guides/TESTING_GUIDE.md` for comprehensive examples covering frontend, backend, and Storybook testing.

## Core Principle

**Every code change should have corresponding tests.**

## Required Actions When Modifying Code

### 1. Check for Existing Tests

After modifying any source file, check if tests exist. Common locations:

- Same directory: `my-component.tsx` -> `my-component.spec.tsx`
- `__tests__/` subdirectory
- Mirror structure in separate `test/` directory

### 2. If Tests Exist: Update Them

- Run existing tests to ensure they pass
- Update tests to cover new functionality
- Add test cases for new edge cases

### 3. If Tests Don't Exist: Create Them

Create tests unless the file is:

- A pure type definition (`.d.ts`)
- Configuration only (`.json`, `.yaml`)
- Already covered by integration/E2E tests
- The user explicitly asks not to create tests

## What to Test by File Type

### React Components (`.tsx`, `.jsx`)

- Component renders correctly
- Props handled properly
- User interactions (clicks, typing)
- State changes
- Edge cases (empty data, errors)

### Express Routes (backend endpoints)

- Happy path (successful requests)
- Error cases (404, 400, 500)
- Query parameters and request body
- Authentication/authorization
- Input validation

### State Management / Services (`.ts`)

- Core functionality
- Error handling and recovery
- Async operations
- Edge cases and boundary conditions

### Utilities / Helper Functions (`.ts`)

- Input/output validation
- Edge cases (null, undefined, empty)
- Error conditions

## Test Coverage Expectations

| Code Type                           | Target Coverage |
| ----------------------------------- | --------------- |
| **Critical paths** (auth, payments) | 100%            |
| **Business logic**                  | 90%+            |
| **API routes**                      | 85%+            |
| **UI components**                   | 70%+            |
| **Utilities**                       | 90%+            |

## Testing Best Practices

- Use `.spec.ts` / `.spec.tsx` for unit tests, `.integration.spec.ts` for integration tests
- Place tests next to the code they test
- Use AAA pattern (Arrange, Act, Assert)
- Descriptive names: `should return 404 when user does not exist`
- Test one thing per test
- Mock external dependencies (databases, APIs, localStorage)

## Running Tests

```bash
npx nx test <package-name>                          # Test a package
npx nx test <package-name> --coverage               # With coverage
npx nx test <package-name> --testFile=<filename>     # Specific file
npx nx run-many -t test                              # All packages
npx nx test <package-name> --watch                   # Watch mode
```

## Reference Examples

| Example              | Location                                                      | Demonstrates             |
| -------------------- | ------------------------------------------------------------- | ------------------------ |
| React Components     | `packages/ui-base/src/lib/sidebar/Sidebar-simple.spec.tsx`    | User interactions, state |
| Express API (simple) | `packages/app-ganymede/src/routes/users/users-simple.spec.ts` | Basic patterns           |
| Express API (real)   | `packages/app-ganymede/src/routes/users/users.spec.ts`        | Mocking DB & auth        |
| State Management     | `packages/frontend-data/src/lib/local-storage-store.spec.ts`  | Async, timers, recovery  |

## When Tests Are Optional

- Pure type definitions (`.d.ts`)
- Configuration files (`.json`, `.yaml`, `.config.ts`)
- Storybook stories (`.stories.tsx`) - though play functions are encouraged
- Build/tooling scripts (when already tested by usage)

## If user asks for "some tests"

If user simply asks to "do some tests..." or any non-specific testing request, pick a random file, module, or piece of code not yet tested and create tests.
