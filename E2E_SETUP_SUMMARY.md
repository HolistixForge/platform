# E2E Testing Setup Summary

This document summarizes the E2E testing infrastructure that has been added to the Holistix Forge monorepo.

---

## 📦 What Was Added

### 1. **GitHub Actions Workflow**

- **File:** `.github/workflows/ci-e2e.yml`
- **Purpose:** Automated E2E testing in CI/CD
- **Strategy:**
  1. Run unit tests first (fast feedback)
  2. Only run E2E tests if unit tests pass
  3. Use existing `scripts/local-dev/` infrastructure
  4. Full stack environment (PostgreSQL, PowerDNS, Nginx, Ganymede, Gateway pool)

### 2. **Playwright Configuration**

- **File:** `playwright.config.ts`
- **Features:**
  - Base URL: `https://domain.local`
  - Ignore HTTPS errors (for local mkcert certs)
  - Screenshot on failure
  - Video on failure
  - HTML and JUnit reporters
  - Visual regression testing support

### 3. **Test Directory Structure**

```
monorepo/
├── e2e/                           # E2E test files
│   ├── example.spec.ts           # Example test (homepage, API, auth)
│   └── __screenshots__/          # Visual regression baselines
├── playwright.config.ts          # Playwright configuration
├── test-results/                 # Test artifacts (gitignored)
└── playwright-report/            # HTML report (gitignored)
```

### 4. **Documentation**

- **File:** `doc/guides/E2E_TESTING.md`
- **Contents:**
  - What is E2E testing
  - Architecture overview
  - Setup instructions
  - Writing tests guide
  - Running tests locally and in CI
  - Visual regression testing
  - Best practices
  - Troubleshooting

### 5. **Updated `.gitignore`**

Added entries for Playwright artifacts:

```gitignore
/test-results/
/playwright-report/
/e2e/**/*-actual.png
/e2e/**/*-diff.png
/playwright/.cache/
```

---

## 🚀 How It Works

### Local Development

```bash
# 1. One-time setup (if not done already)
./scripts/local-dev/setup-all.sh

# 2. Create E2E test environment
./scripts/local-dev/create-env.sh e2e-test domain.local $(pwd)

# 3. Build frontend
./scripts/local-dev/build-frontend.sh e2e-test $(pwd)

# 4. Start services
./scripts/local-dev/envctl.sh start e2e-test

# 5. Install Playwright
npm install --save-dev @playwright/test
npx playwright install chromium

# 6. Run tests
npx playwright test

# 7. View results
npx playwright show-report
```

### CI/CD (GitHub Actions)

The workflow automatically:

1. ✅ Runs linter and unit tests
2. ✅ Installs infrastructure (PostgreSQL, PowerDNS, CoreDNS, Nginx)
3. ✅ Creates test environment (`e2e-test`)
4. ✅ Builds and starts all services
5. ✅ Runs Playwright tests
6. ✅ Uploads test reports and failure screenshots
7. ✅ Cleans up environment

---

## 🎯 Test Environment

The E2E tests run against a **full local development environment**:

```
┌─────────────────────────────────────────────────────────┐
│  Test Environment (e2e-test)                            │
├─────────────────────────────────────────────────────────┤
│  • PostgreSQL (ganymede_e2e_test)                       │
│  • PowerDNS (domain.local zone)                         │
│  • CoreDNS (DNS forwarder)                              │
│  • Nginx (Stage 1, ports 80/443)                        │
│  • Ganymede API (port 6000)                             │
│  • Gateway Pool (2 gateways: gw-pool-0, gw-pool-1)      │
│  • Frontend (built, served via Nginx)                   │
└─────────────────────────────────────────────────────────┘
```

**URLs:**

- Frontend: `https://domain.local`
- Ganymede: `https://ganymede.domain.local`
- Gateway: `https://org-{uuid}.domain.local` (dynamic)

---

## 📝 Example Test

```typescript
// e2e/example.spec.ts
import { test, expect } from '@playwright/test';

test('should load homepage', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Holistix/i);

  // Visual regression check
  await expect(page).toHaveScreenshot('homepage.png');
});

test('Ganymede API health check', async ({ request }) => {
  const response = await request.get('https://ganymede.domain.local/health', {
    ignoreHTTPSErrors: true,
  });
  expect(response.ok()).toBeTruthy();
});
```

---

## 🔑 Key Features

### 1. **Uses Existing Infrastructure**

- Leverages your `scripts/local-dev/` setup scripts
- No Docker Compose needed
- Same environment as local development

### 2. **Visual Regression Testing**

- Capture screenshots of UI
- Compare to baselines
- Detect UI render breaks automatically
- Baselines stored in `e2e/__screenshots__/`

### 3. **Fast Feedback Loop**

```
Unit Tests (2-3 min)
      ↓ (only if passing)
E2E Tests (10-15 min)
```

### 4. **Comprehensive Reporting**

- HTML report with screenshots
- JUnit XML for CI integration
- Videos of failed tests
- Trace files for debugging

---

## 🛠️ Next Steps

### 1. **Install Playwright Locally**

```bash
npm install --save-dev @playwright/test
npx playwright install chromium
```

### 2. **Write Your First Test**

Create `e2e/your-feature.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test('your test', async ({ page }) => {
  await page.goto('/');
  // ... your test logic
});
```

### 3. **Run Tests Locally**

```bash
# Ensure environment is running
./scripts/local-dev/envctl.sh start e2e-test

# Run tests
npx playwright test

# View report
npx playwright show-report
```

### 4. **Add `data-testid` Attributes**

Update your UI components:

```tsx
<button data-testid="login-button">Login</button>
<div data-testid="user-menu">...</div>
<span data-testid="container-status">Running</span>
```

### 5. **Write Critical Path Tests**

Focus on:

- ✅ User authentication (login/logout)
- ✅ Container deployment (JupyterLab, pgAdmin)
- ✅ OAuth authorization flow
- ✅ Real-time collaboration
- ✅ Gateway allocation

---

## 📚 Documentation

- **E2E Testing Guide:** `doc/guides/E2E_TESTING.md`
- **Local Development:** `doc/guides/LOCAL_DEVELOPMENT.md`
- **Playwright Docs:** https://playwright.dev/

---

## 🐛 Troubleshooting

### Tests Fail with SSL Errors

**Solution:** Already configured in `playwright.config.ts`:

```typescript
use: {
  ignoreHTTPSErrors: true,
}
```

### Services Not Running

```bash
# Check service status
./scripts/local-dev/envctl.sh status e2e-test

# Restart services
./scripts/local-dev/envctl.sh restart e2e-test
```

### Visual Regression Failures

```bash
# View diff
npx playwright show-report

# Update baselines (if change is intentional)
npx playwright test --update-snapshots
```

---

## ✅ Summary

You now have a complete E2E testing infrastructure that:

1. ✅ Runs automatically in CI/CD
2. ✅ Uses your existing local-dev scripts
3. ✅ Tests the full stack (frontend + backend + database + Docker)
4. ✅ Includes visual regression testing
5. ✅ Provides comprehensive reporting
6. ✅ Is easy to run locally and in CI

**Next:** Start writing tests for your critical user flows! 🚀
