# Testing Guide for Holistix Forge

This comprehensive guide provides practical examples for testing different types of code in the monorepo.

## 📚 Table of Contents

1. [Testing Approaches Overview](#testing-approaches-overview)
2. [Frontend: LocalStorage & State Management](#frontend-localstorage--state-management)
3. [Frontend: React Components](#frontend-react-components)
4. [Backend: Express API Endpoints](#backend-express-api-endpoints)
5. [Storybook Stories](#storybook-stories)
6. [Running Tests](#running-tests)
7. [Best Practices](#best-practices)

---

## 📊 Testing Approaches Overview

### **The Testing Pyramid**

```
        /\
       /  \  E2E Tests (Few)
      /----\
     /      \  Integration Tests (Some)
    /--------\
   /          \  Unit Tests (Many)
  /------------\
```

### **When to Use Each Level**

| Type            | Speed      | Setup      | When to Use                    |
| --------------- | ---------- | ---------- | ------------------------------ |
| **Unit**        | ⚡ Fast    | Minimal    | Day-to-day development, TDD    |
| **Integration** | ⚙️ Slower  | Real app   | Critical paths, pre-deployment |
| **E2E**         | 🐢 Slowest | Full stack | User workflows, staging        |

---

## 🎨 Frontend: LocalStorage & State Management

### **Example Location**

- `packages/frontend-data/src/lib/local-storage-channel.spec.ts` - **22 tests**
- `packages/frontend-data/src/lib/local-storage-store.spec.ts` - **26 tests**

### **What's Tested**

- Cross-tab communication (dual event system)
- Cache management with expiration
- Automatic error recovery with retry
- Complex async state management

### **Key Patterns**

```typescript
import { LocalStorageChannel } from './local-storage-channel';

describe('LocalStorageChannel', () => {
  let mockLocalStorage: Record<string, string>;

  beforeEach(() => {
    // Mock localStorage using property descriptor
    Object.defineProperty(global, 'localStorage', {
      value: {
        getItem: (key: string) => mockLocalStorage[key] || null,
        setItem: (key: string, value: string) => {
          mockLocalStorage[key] = value;
        },
      },
      writable: true,
      configurable: true,
    });
  });

  it('should sync across tabs', () => {
    channel.write('key', { data: 'test' });
    // Test cross-tab coordination
  });
});
```

### **Advanced Topics Covered**

- ✅ Mocking browser APIs (localStorage, events)
- ✅ Simulating multiple browser tabs
- ✅ Testing async operations with fake timers
- ✅ Error recovery and retry mechanisms

---

## ⚛️ Frontend: React Components

### **Example Location**

`packages/ui-base/src/lib/sidebar/Sidebar-simple.spec.tsx` - **10 tests**

### **Key Technologies**

- **@testing-library/react**: Component testing utilities
- **@testing-library/jest-dom**: Custom matchers
- **jest**: Test runner

### **Basic Pattern**

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Sidebar } from './Sidebar';

describe('Sidebar Component', () => {
  it('should render and handle clicks', () => {
    const mockClick = jest.fn();
    render(<Sidebar items={items} onClick={mockClick} active="Home" />);

    fireEvent.click(screen.getByTitle('Settings'));

    expect(mockClick).toHaveBeenCalled();
    expect(screen.getByTitle('Settings').querySelector('svg')).toHaveClass(
      'active'
    );
  });
});
```

### **What to Test**

✅ **Rendering**: Component appears in DOM  
✅ **Props**: Different prop combinations  
✅ **User Interactions**: Clicks, typing, hover  
✅ **State Changes**: Component updates correctly  
✅ **Edge Cases**: Empty data, loading states, errors  
✅ **Accessibility**: Proper ARIA attributes, keyboard navigation

### **Running React Tests**

```bash
# Run all tests for ui-base
npx nx test ui-base

# Run specific test
npx nx test ui-base --testFile=Sidebar-simple.spec.tsx

# Watch mode
npx nx test ui-base --watch

# With coverage
npx nx test ui-base --coverage
```

---

## 🔌 Backend: Express API Endpoints

> **Note**: This section is specific to Express applications like `app-ganymede` and `app-gateway`

### **Example Locations**

- `packages/app-ganymede/src/routes/users/users-simple.spec.ts` - **15 tests** (Teaching example)
- `packages/app-ganymede/src/routes/users/users.spec.ts` - **21 tests** (Real routes)

### **Two Testing Approaches**

#### **Approach 1: Unit Tests** (Current - Fast & Isolated)

**What**: Test individual routes with minimal setup  
**When**: Day-to-day development, TDD, CI/CD  
**Speed**: ⚡ Very fast (< 1 second)

```typescript
// Example: users.spec.ts
import request from 'supertest';
import express from 'express';
import { setupUserRoutes } from './index';

// Mock everything
jest.mock('../../database/pg');
jest.mock('../../middleware/auth');

describe('User Routes - Unit Tests', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    setupUserRoutes(app); // Just the routes we're testing
  });

  it('should return user by ID', async () => {
    mockDB.mockReturnValue(mockUser);

    const response = await request(app).get('/users/123').expect(200);

    expect(response.body).toEqual(mockUser);
  });
});
```

✅ **Pros**: Fast, easy to debug, tests one thing at a time  
❌ **Cons**: Doesn't test full middleware stack, requires extensive mocking

---

#### **Approach 2: Integration Tests** (Recommended for Critical Paths)

**What**: Test with full app setup using `createApp()` factory  
**When**: Critical user flows, before deployment  
**Speed**: ⚙️ Slower (2-5 seconds)

```typescript
// Example: users.integration.spec.ts
import request from 'supertest';
import { createApp } from '../../app';

// Only mock database (keep middleware)
jest.mock('../../database/pg');

describe('User Routes - Integration Tests', () => {
  let app: Express;

  beforeEach(() => {
    // Use REAL app setup from app.ts factory!
    app = createApp({
      skipSession: true, // Optional: skip for speed
    });
  });

  it('should validate OpenAPI schema', async () => {
    // This catches schema validation errors
    const res = await request(app).get('/users/invalid-format').expect(400);

    expect(res.body.errors).toBeDefined();
  });

  it('should run through full error handling stack', async () => {
    mockDB.mockImplementation(() => {
      throw new Error('DB Error');
    });

    const res = await request(app).get('/users/123');

    // Error is properly formatted by error handlers
    expect(res.status).toBe(500);
    expect(res.body.error).toBeDefined();
  });
});
```

✅ **Pros**: Tests real app config, catches middleware issues, more realistic  
❌ **Cons**: Slower, more complex setup, harder to debug

---

### **App Factory Pattern** (For Express Apps)

We've extracted app creation to `src/app.ts` in Express packages:

```typescript
// packages/app-ganymede/src/app.ts
export function createApp(options?: { skipSession?: boolean }): Express {
  const app = express();

  // Full production setup
  setupBasicExpressApp(app);
  setupValidator(app);
  setupRoutes(app);
  setupErrorHandlers(app);

  return app;
}
```

**In Production:**

```typescript
// src/main.ts
import { createApp } from './app';
const app = createApp();
app.listen(3000);
```

**In Tests:**

```typescript
// src/**/*.integration.spec.ts
import { createApp } from '../../app';
const app = createApp({ skipSession: true });
```

---

### **When to Use Each Approach**

| Scenario                              | Approach          | File Pattern            |
| ------------------------------------- | ----------------- | ----------------------- |
| **Development** (TDD, quick feedback) | Unit              | `*.spec.ts`             |
| **Pre-commit** (CI pipeline)          | Unit              | `*.spec.ts`             |
| **Critical paths** (auth, payments)   | Integration       | `*.integration.spec.ts` |
| **Pre-deployment** (staging)          | Integration + E2E | `*.integration.spec.ts` |
| **User workflows** (full stack)       | E2E               | Separate test suite     |

---

### **What to Test in Express APIs**

✅ **Happy Paths**: Successful requests with valid data  
✅ **Error Cases**: 404s, 400s, validation errors  
✅ **Query Parameters**: URL params and query strings  
✅ **Request Body**: POST/PUT requests with JSON  
✅ **Edge Cases**: Empty data, special characters, SQL injection  
✅ **Authentication**: Protected routes, token validation  
✅ **Middleware**: Error handlers, validators

### **Running Express Tests**

```bash
# Run all tests
npx nx test app-ganymede

# Run specific test file
npx nx test app-ganymede --testFile=users.spec.ts

# Watch mode
npx nx test app-ganymede --watch

# With coverage
npx nx test app-ganymede --coverage
```

---

## 📖 Storybook Stories

> Full setup, screenshot baselines and CI behaviour: **[Storybook & Visual Regression](STORYBOOK.md)**.

### **Storybook Test Runner**

For testing stories directly:

```bash
# Start Storybook first
npx nx run ui-base:storybook

# In another terminal, run tests
npx nx run ui-base:test-storybook
```

Every story is also screenshotted and compared against a committed baseline.
Keep story fixtures deterministic (no `Math.random()`, no `Date.now()`, no
remote images), and regenerate baselines on Linux only — see
[STORYBOOK.md](STORYBOOK.md#screenshot-baselines).

### **Using Story Args in Tests**

Import args from stories for consistency:

```typescript
import { Normal } from './MyComponent.stories';

it('should render story args correctly', () => {
  render(<MyComponent {...Normal.args} />);
  // Test with the same props used in Storybook
});
```

### **Testing Stories with Play Functions**

Add interaction tests in your stories:

```typescript
// MyComponent.stories.tsx
import { fn } from '@storybook/test';

export const WithInteraction: Story = {
  args: {
    onClick: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    await userEvent.click(button);
    await expect(button).toHaveClass('clicked');
  },
};
```

---

## 🚀 Running Tests

### **Single Package**

```bash
# Run all tests in a package
npx nx test <package-name>

# Examples:
npx nx test frontend-data
npx nx test app-ganymede
npx nx test ui-base
```

### **Specific Files**

```bash
npx nx test <package> --testFile=<filename>

# Examples:
npx nx test frontend-data --testFile=local-storage-store.spec.ts
npx nx test app-ganymede --testFile=users.spec.ts
npx nx test ui-base --testFile=Sidebar-simple.spec.tsx
```

### **All Packages**

```bash
# Run tests for all packages
npx nx run-many -t test

# In parallel (faster)
npx nx run-many -t test --parallel=3
```

### **Watch Mode (Development)**

```bash
npx nx test <package> --watch
```

### **Coverage Reports**

```bash
npx nx test <package> --coverage

# View coverage report at:
# packages/<package>/test-output/jest/coverage/index.html
```

---

## 💡 Best Practices

### **1. Test Structure (AAA Pattern)**

```typescript
it('should do something', () => {
  // Arrange: Setup test data
  const input = { name: 'test' };

  // Act: Perform action
  const result = myFunction(input);

  // Assert: Verify outcome
  expect(result).toEqual(expected);
});
```

### **2. Descriptive Test Names**

✅ **Good**: `should return 404 when user does not exist`  
❌ **Bad**: `test user endpoint`

### **3. Test One Thing Per Test**

```typescript
// Good: Focused tests
it('should validate email format', () => { ... });
it('should require password', () => { ... });

// Bad: Testing multiple things
it('should validate form', () => {
  // tests email, password, name, etc.
});
```

### **4. Use Appropriate Queries (React)**

```typescript
// Prefer accessible queries (better for a11y)
screen.getByRole('button', { name: /submit/i });
screen.getByLabelText('Email');
screen.getByText('Welcome');

// Avoid when possible
screen.getByTestId('submit-button'); // Last resort
```

### **5. Mock External Dependencies**

```typescript
// Mock API calls
jest.mock('./api', () => ({
  fetchUser: jest.fn(),
}));

// Mock localStorage
Object.defineProperty(global, 'localStorage', {
  value: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
  writable: true,
  configurable: true,
});

// Mock database (Express apps)
jest.mock('../../database/pg', () => ({
  pg: { query: jest.fn() },
}));
```

### **6. Clean Up After Tests**

```typescript
afterEach(() => {
  jest.clearAllMocks();
  cleanup(); // from @testing-library/react
});
```

### **7. For Express Unit Tests**

- ✅ Mock all external dependencies
- ✅ Test one route at a time
- ✅ Focus on business logic
- ✅ Run frequently during development

### **8. For Express Integration Tests**

- ✅ Use real app configuration (`createApp()`)
- ✅ Mock only database/external services
- ✅ Test middleware interactions
- ✅ Run before commits/deployments

---

## 📁 File Organization

### **Frontend Packages**

```
packages/frontend-data/
└── src/
    └── lib/
        ├── local-storage-channel.ts
        ├── local-storage-channel.spec.ts  ✅
        ├── local-storage-store.ts
        └── local-storage-store.spec.ts    ✅
```

### **React Component Packages**

```
packages/ui-base/
└── src/
    └── lib/
        └── sidebar/
            ├── Sidebar.tsx
            ├── Sidebar.spec.tsx           ✅
            ├── Sidebar.stories.ts
            └── sidebar.css
```

### **Express App Packages**

```
packages/app-ganymede/
├── src/
│   ├── app.ts                            ⭐ App factory
│   ├── main.ts                           # Uses app factory
│   └── routes/
│       └── users/
│           ├── index.ts                  # Route implementation
│           ├── users-simple.spec.ts      ✅ Teaching example
│           ├── users.spec.ts             ✅ Real unit tests
│           └── users.integration.spec.ts # Future: integration tests
```

---

## 🔗 Reference Examples

All examples in this repository are **fully working** and can be used as templates!

### **1. LocalStorage with Cross-Tab Coordination**

📁 `packages/frontend-data/src/lib/local-storage-store.spec.ts`  
✅ **48 tests passing**

- Complex state management
- Async operations with fake timers
- Error recovery with automatic retry
- Cross-tab synchronization

### **2. React Component Testing**

📁 `packages/ui-base/src/lib/sidebar/Sidebar-simple.spec.tsx`  
✅ **10 tests passing**

- Rendering tests
- User interactions
- State management
- Edge cases

### **3. Express API - Teaching Example**

📁 `packages/app-ganymede/src/routes/users/users-simple.spec.ts`  
✅ **15 tests passing**

- Simple patterns for learning
- Basic routes and error handling
- Clean, easy-to-understand code

### **4. Express API - Real Application Tests**

📁 `packages/app-ganymede/src/routes/users/users.spec.ts`  
✅ **21 tests passing**

- Tests actual application routes
- Database mocking
- Authentication bypass
- SQL injection prevention
- Complete request/response validation

---

## 🆘 Troubleshooting

### **Tests Hanging or Timing Out**

```bash
# Find what's keeping tests open
npx nx test <package> --detectOpenHandles

# Common fixes:
- Ensure all async operations complete
- Clear timers: jest.clearAllTimers()
- Close connections in afterAll()
```

### **Module Not Found Errors**

```bash
# Install missing dependencies
npm install --save-dev <package-name>

# Common testing packages:
npm install --save-dev \
  @testing-library/react \
  @testing-library/jest-dom \
  @testing-library/dom \
  supertest \
  @types/supertest
```

### **TextEncoder/TextDecoder Not Defined**

Add to jest setup file:

```javascript
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
```

### **localStorage Not Defined**

```typescript
// In your test setup or beforeEach
Object.defineProperty(global, 'localStorage', {
  value: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  },
  writable: true,
  configurable: true,
});
```

---

## 📊 Test Coverage Goals

| Code Type                           | Target Coverage |
| ----------------------------------- | --------------- |
| **Critical paths** (auth, payments) | 100%            |
| **Business logic**                  | 90%+            |
| **API routes**                      | 85%+            |
| **UI components**                   | 70%+            |
| **Utilities**                       | 90%+            |

---

## 🎯 Quick Reference

### **Common Commands**

| Task              | Command                                               |
| ----------------- | ----------------------------------------------------- |
| Run all tests     | `npx nx run-many -t test`                             |
| Run package tests | `npx nx test <package>`                               |
| Watch mode        | `npx nx test <package> --watch`                       |
| Single file       | `npx nx test <package> --testFile=<file>`             |
| Coverage          | `npx nx test <package> --coverage`                    |
| Specific pattern  | `npx nx test <package> --testNamePattern="<pattern>"` |

### **Test Status Summary**

| Package         | Tests | Status     | Files                          |
| --------------- | ----- | ---------- | ------------------------------ |
| `frontend-data` | 48    | ✅ Passing | LocalStorage, cache management |
| `ui-base`       | 10    | ✅ Passing | Sidebar component              |
| `app-ganymede`  | 36    | ✅ Passing | User routes (simple + real)    |

---

## 📚 Further Reading

- [Jest Documentation](https://jestjs.io/)
- [React Testing Library](https://testing-library.com/react)
- [supertest](https://github.com/ladjs/supertest)
- [Storybook Test Runner](https://storybook.js.org/docs/writing-tests/test-runner)

---

## 🚦 Quick Decision Guide

**Use Unit Tests when:**

- ✅ Writing new features (TDD)
- ✅ Debugging specific routes/components
- ✅ Running in CI (fast feedback)
- ✅ Testing edge cases

**Use Integration Tests when:**

- ✅ Testing critical user flows
- ✅ Before deployments
- ✅ Validating middleware interactions
- ✅ Testing error handling end-to-end

**Use Both when:**

- ✅ High confidence needed
- ✅ Business-critical features
- ✅ Time allows thorough testing

---

**Remember**: Perfect is the enemy of good. Start with unit tests, add integration tests for critical paths. Don't let testing slow you down! 🚀

**Need Help?** Check the example files referenced above or ask the team!
