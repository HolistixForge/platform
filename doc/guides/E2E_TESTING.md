# End-to-End (E2E) Testing Guide

This guide explains how to write and run E2E tests for Holistix Forge using Playwright.

---

## 📖 Table of Contents

- [What is E2E Testing?](#what-is-e2e-testing)
- [Architecture](#architecture)
- [Setup](#setup)
- [Writing Tests](#writing-tests)
- [Running Tests](#running-tests)
- [Visual Regression Testing](#visual-regression-testing)
- [CI/CD Integration](#cicd-integration)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## What is E2E Testing?

**End-to-End (E2E) testing** validates the entire application flow from a user's perspective, testing the complete stack:

- ✅ Frontend UI (React/TypeScript)
- ✅ API Layer (Ganymede, Gateway)
- ✅ Database (PostgreSQL)
- ✅ Infrastructure (Nginx, PowerDNS, Docker)
- ✅ Real user workflows (login, deploy container, OAuth flow)

### When to Use E2E Tests

**✅ Use E2E tests for:**

- Critical user journeys (login, signup, container deployment)
- Multi-service integration (frontend → API → database → Docker)
- Business-critical features (OAuth, VPN, real-time collaboration)
- Visual regression (UI render breaks)

**❌ Don't use E2E tests for:**

- Unit-level logic (use Jest unit tests)
- API-only testing (use integration tests)
- Performance testing (use dedicated tools)

---

## Architecture

### Test Environment

E2E tests run against a **full local development environment** created by your setup scripts:

```
┌─────────────────────────────────────────────────────────┐
│  GitHub Actions Runner (Ubuntu)                         │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────────────────────────────────┐         │
│  │  Local Dev Environment (e2e-test)          │         │
│  ├────────────────────────────────────────────┤         │
│  │  • PostgreSQL (ganymede_e2e_test)          │         │
│  │  • PowerDNS (domain.local zone)            │         │
│  │  • CoreDNS (DNS forwarder)                 │         │
│  │  • Nginx (Stage 1, port 80/443)            │         │
│  │  • Ganymede API (port 6000)                │         │
│  │  • Gateway Pool (gw-pool-0, gw-pool-1)     │         │
│  │  • Frontend (built, served via Nginx)      │         │
│  └────────────────────────────────────────────┘         │
│                                                          │
│  ┌────────────────────────────────────────────┐         │
│  │  Playwright                                 │         │
│  ├────────────────────────────────────────────┤         │
│  │  • Chromium browser                         │         │
│  │  • Tests in e2e/ directory                 │         │
│  │  • Navigates to https://domain.local        │         │
│  └────────────────────────────────────────────┘         │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### URLs

- **Frontend:** `https://domain.local`
- **Ganymede API:** `https://ganymede.domain.local`
- **Gateway (allocated):** `https://org-{uuid}.domain.local`
- **User Container:** `https://uc-{uuid}.org-{uuid}.domain.local`

---

## Setup

### 1. Install Playwright

```bash
# Install Playwright and browsers
npm install --save-dev @playwright/test
npx playwright install chromium

# Or install all browsers (Chrome, Firefox, Safari)
npx playwright install
```

### 2. Verify Configuration

The Playwright config is at `playwright.config.ts`:

```typescript
export default defineConfig({
  testDir: './e2e',
  baseURL: 'https://domain.local',
  use: {
    ignoreHTTPSErrors: true, // For local mkcert certs
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
});
```

### 3. Create Local Test Environment

**For local development:**

```bash
# One-time setup (if not done already)
./scripts/local-dev/setup-all.sh

# Create E2E test environment
./scripts/local-dev/create-env.sh e2e-test domain.local $(pwd)

# Build frontend
./scripts/local-dev/build-frontend.sh e2e-test $(pwd)

# Start services
./scripts/local-dev/envctl.sh start e2e-test
```

**Verify services are running:**

```bash
# Check Ganymede
curl -k https://ganymede.domain.local/health

# Check Frontend
curl -k https://domain.local
```

---

## Writing Tests

### Basic Test Structure

```typescript
// e2e/homepage.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('should load successfully', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Holistix/i);
  });
});
```

### Testing User Flows

```typescript
// e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should allow user login', async ({ page }) => {
    await page.goto('/login');

    // Fill login form
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="login-button"]');

    // Should redirect to dashboard
    await page.waitForURL('/dashboard');

    // Verify logged in
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.fill('[data-testid="email"]', 'wrong@example.com');
    await page.fill('[data-testid="password"]', 'wrongpassword');
    await page.click('[data-testid="login-button"]');

    // Should show error message
    await expect(page.locator('[data-testid="error-message"]')).toContainText(
      'Invalid credentials'
    );
  });
});
```

### Testing API Interactions

```typescript
// e2e/api.spec.ts
import { test, expect } from '@playwright/test';

test.describe('API Integration', () => {
  test('Ganymede health check', async ({ request }) => {
    const response = await request.get('https://ganymede.domain.local/health', {
      ignoreHTTPSErrors: true,
    });

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);
  });

  test('should create organization via API', async ({ request }) => {
    const response = await request.post(
      'https://ganymede.domain.local/api/organizations',
      {
        ignoreHTTPSErrors: true,
        headers: {
          Authorization: 'Bearer YOUR_TEST_JWT',
          'Content-Type': 'application/json',
        },
        data: {
          name: 'Test Organization',
        },
      }
    );

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.id).toBeDefined();
  });
});
```

### Testing Container Deployment

```typescript
// e2e/containers.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Container Deployment', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/dashboard');
  });

  test('should deploy JupyterLab container', async ({ page }) => {
    // Navigate to containers page
    await page.click('[data-testid="nav-containers"]');

    // Create new container
    await page.click('[data-testid="new-container"]');
    await page.selectOption('[data-testid="image-select"]', 'jupyter');
    await page.fill('[data-testid="container-name"]', 'test-jupyter');
    await page.click('[data-testid="deploy-button"]');

    // Wait for deployment (up to 60 seconds)
    await expect(page.locator('[data-testid="container-status"]')).toHaveText(
      'Running',
      { timeout: 60000 }
    );

    // Verify container URL
    const containerUrl = await page
      .locator('[data-testid="container-url"]')
      .textContent();
    expect(containerUrl).toMatch(/uc-.+\.org-.+\.domain\.local/);

    // Click "Open Container" button
    await page.click('[data-testid="open-container"]');

    // New tab should open with JupyterLab
    const [newPage] = await Promise.all([
      page.context().waitForEvent('page'),
      page.click('[data-testid="open-container"]'),
    ]);

    await newPage.waitForLoadState('networkidle');

    // Verify JupyterLab loaded
    await expect(newPage.locator('#jupyter-root')).toBeVisible({
      timeout: 30000,
    });
  });
});
```

---

## Running Tests

### Local Development

```bash
# Run all tests
npx playwright test

# Run specific test file
npx playwright test e2e/homepage.spec.ts

# Run in headed mode (see browser)
npx playwright test --headed

# Run in debug mode (step through)
npx playwright test --debug

# Run specific browser
npx playwright test --project=chromium
npx playwright test --project=firefox

# Run with UI mode (interactive)
npx playwright test --ui
```

### View Test Results

```bash
# Open HTML report
npx playwright show-report

# View trace for failed tests
npx playwright show-trace trace.zip
```

---

## Visual Regression Testing

Playwright can capture screenshots and compare them to baselines to detect UI changes.

### Taking Screenshots

```typescript
test('should render dashboard correctly', async ({ page }) => {
  await page.goto('/dashboard');

  // Full page screenshot
  await expect(page).toHaveScreenshot('dashboard-full.png', {
    fullPage: true,
    maxDiffPixels: 100, // Allow 100 pixels difference
  });

  // Specific element screenshot
  const navbar = page.locator('[data-testid="navbar"]');
  await expect(navbar).toHaveScreenshot('navbar.png');
});
```

### Masking Dynamic Content

```typescript
test('should render page without dynamic content', async ({ page }) => {
  await page.goto('/dashboard');

  // Mask elements that change (timestamps, avatars, etc.)
  await expect(page).toHaveScreenshot('dashboard.png', {
    mask: [
      page.locator('.timestamp'),
      page.locator('.user-avatar'),
      page.locator('.live-counter'),
    ],
  });
});
```

### Updating Baselines

When UI changes are intentional:

```bash
# Update all screenshot baselines
npx playwright test --update-snapshots

# Update specific test
npx playwright test homepage.spec.ts --update-snapshots
```

**Baseline Storage:**

- Baselines: `e2e/__screenshots__/`
- Failures: `test-results/` (gitignored)
- Diffs: `test-results/` (gitignored)

---

## CI/CD Integration

### GitHub Actions Workflow

The E2E tests run automatically in CI via `.github/workflows/ci-e2e.yml`:

```yaml
jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - name: Setup infrastructure
        run: echo "yes" | ./scripts/local-dev/setup-all.sh

      - name: Create test environment
        run: ./scripts/local-dev/create-env.sh e2e-test domain.local $GITHUB_WORKSPACE

      - name: Start services
        run: ./scripts/local-dev/envctl.sh start e2e-test

      - name: Run Playwright tests
        run: npx playwright test
```

### Viewing CI Results

1. Go to GitHub Actions tab
2. Click on the failed workflow
3. Download artifacts:
   - `playwright-report` - Full HTML report
   - `test-failures` - Screenshots of failures

---

## Best Practices

### 1. Use `data-testid` Attributes

**Good:**

```html
<button data-testid="login-button">Login</button>
```

```typescript
await page.click('[data-testid="login-button"]');
```

**Bad:**

```typescript
await page.click('.btn-primary.login-btn'); // Fragile, breaks with CSS changes
```

### 2. Wait for Network Idle

```typescript
await page.goto('/dashboard');
await page.waitForLoadState('networkidle'); // Wait for all requests to finish
```

### 3. Use Explicit Waits

```typescript
// Wait for element to be visible
await page.waitForSelector('[data-testid="user-menu"]', { state: 'visible' });

// Wait for URL change
await page.waitForURL('/dashboard');

// Wait for API response
await page.waitForResponse(
  (response) =>
    response.url().includes('/api/user') && response.status() === 200
);
```

### 4. Isolate Tests

Each test should be independent:

```typescript
test.beforeEach(async ({ page }) => {
  // Reset state before each test
  await page.goto('/');
  // Clear cookies, local storage, etc.
});
```

### 5. Test Critical Paths Only

E2E tests are slow and expensive. Focus on:

- ✅ User registration and login
- ✅ Container deployment
- ✅ OAuth authorization flow
- ✅ Real-time collaboration
- ❌ Every button click
- ❌ Form validation (use unit tests)

### 6. Handle Timeouts Gracefully

```typescript
// Increase timeout for slow operations
await expect(page.locator('[data-testid="container-status"]')).toHaveText(
  'Running',
  { timeout: 60000 }
); // 60 seconds

// Retry flaky operations
await test.step('Deploy container', async () => {
  await page.click('[data-testid="deploy-button"]');
  // ... assertions
});
```

---

## Troubleshooting

### Tests Fail Locally

**Problem:** Tests pass in CI but fail locally

**Solution:**

```bash
# Ensure environment is clean
./scripts/local-dev/delete-env.sh e2e-test
./scripts/local-dev/create-env.sh e2e-test domain.local $(pwd)
./scripts/local-dev/envctl.sh start e2e-test

# Check services are running
curl -k https://domain.local
curl -k https://ganymede.domain.local/health
```

### SSL Certificate Errors

**Problem:** `net::ERR_CERT_AUTHORITY_INVALID`

**Solution:**

```typescript
// In playwright.config.ts
use: {
  ignoreHTTPSErrors: true,  // Ignore local mkcert cert errors
}
```

### Timeouts

**Problem:** Tests timeout waiting for elements

**Solution:**

```typescript
// Increase global timeout
export default defineConfig({
  timeout: 60000, // 60 seconds per test
  expect: {
    timeout: 10000, // 10 seconds per assertion
  },
});
```

### Flaky Tests

**Problem:** Tests pass/fail randomly

**Solution:**

1. Add explicit waits: `waitForLoadState('networkidle')`
2. Wait for API responses: `waitForResponse()`
3. Retry failed tests: `retries: 2`
4. Isolate tests: Clear state in `beforeEach`

### Visual Regression Failures

**Problem:** Screenshots don't match baseline

**Solution:**

```bash
# View the diff
npx playwright show-report

# If change is intentional, update baseline
npx playwright test --update-snapshots

# Commit new baselines
git add e2e/__screenshots__/
git commit -m "Update visual regression baselines"
```

---

## Related Documentation

- [Local Development Guide](LOCAL_DEVELOPMENT.md) - Setting up local environment
- [Testing Guide](TESTING_GUIDE.md) - Unit and integration testing
- [System Architecture](../architecture/SYSTEM_ARCHITECTURE.md) - Complete system overview
- [Playwright Documentation](https://playwright.dev/) - Official Playwright docs
