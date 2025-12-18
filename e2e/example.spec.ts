import { test, expect } from '@playwright/test';

/**
 * Example E2E test for Holistix Forge
 *
 * This test runs against a full local development environment:
 * - Frontend: https://domain.local
 * - Ganymede API: https://ganymede.domain.local
 * - Gateway Pool: org-{uuid}.domain.local (dynamically allocated)
 * - PostgreSQL, PowerDNS, Nginx all running
 */

test.describe('Homepage', () => {
  test('should load the homepage', async ({ page }) => {
    await page.goto('/');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check title or main heading
    await expect(page).toHaveTitle(/Holistix/i);

    // Visual regression check
    await expect(page).toHaveScreenshot('homepage.png', {
      fullPage: true,
      maxDiffPixels: 100,
    });
  });

  test('should have navigation elements', async ({ page }) => {
    await page.goto('/');

    // Check for common navigation elements
    // Adjust selectors based on your actual UI
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
  });
});

test.describe('API Health Check', () => {
  test('Ganymede API should be healthy', async ({ request }) => {
    // Check Ganymede health endpoint
    const response = await request.get('https://ganymede.domain.local/health', {
      ignoreHTTPSErrors: true,
    });

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);
  });
});

// Example: Testing user authentication flow
test.describe('Authentication', () => {
  test.skip('should allow user login', async ({ page }) => {
    // Skip for now - implement when auth UI is ready
    await page.goto('/login');

    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="login-button"]');

    // Should redirect to dashboard
    await page.waitForURL('/dashboard');
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  });
});

// Example: Testing container deployment (critical flow)
test.describe('Container Deployment', () => {
  test.skip('should deploy JupyterLab container', async ({ page }) => {
    // Skip for now - implement when container UI is ready

    // Login first
    await page.goto('/login');
    // ... login steps ...

    // Navigate to containers
    await page.goto('/containers');

    // Create new container
    await page.click('[data-testid="new-container"]');
    await page.selectOption('[data-testid="image-select"]', 'jupyter');
    await page.fill('[data-testid="container-name"]', 'test-jupyter');
    await page.click('[data-testid="deploy-button"]');

    // Wait for deployment (with timeout)
    await expect(page.locator('[data-testid="container-status"]')).toHaveText(
      'Running',
      { timeout: 60000 }
    );

    // Verify container URL is generated
    const containerUrl = await page
      .locator('[data-testid="container-url"]')
      .textContent();
    expect(containerUrl).toMatch(/uc-.+\.org-.+\.domain\.local/);

    // Visual check of deployed container card
    await expect(
      page.locator('[data-testid="container-card"]')
    ).toHaveScreenshot('container-deployed.png');
  });
});
