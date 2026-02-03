# Playwright MCP & Test User

## Playwright MCP Server

The project uses the Playwright MCP server for browser automation (navigating pages, capturing console logs, taking screenshots, executing JS in headless Chromium).

### MCP Configuration

The config is in `.mcp.json` at the project root:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "@playwright/mcp@latest",
        "--headless",
        "--no-sandbox",
        "--ignore-https-errors"
      ],
      "env": {
        "PLAYWRIGHT_MCP_SANDBOX": "false"
      }
    }
  }
}
```

**Required flags:**

- `--headless` — no display server available in the dev container
- `--no-sandbox` — running as root in Docker requires disabling the Chromium sandbox
- `--ignore-https-errors` — local dev uses self-signed certificates (`.local` domains)
- `PLAYWRIGHT_MCP_SANDBOX=false` — env var fallback for `--no-sandbox`

### Installation

Playwright Chromium and system dependencies must be installed:

```bash
npx playwright install chromium
npx playwright install-deps chromium
```

If the browser fails to launch with a sandbox error, verify that both `--no-sandbox` and the env var are set in `.mcp.json`.

### Prerequisites Before Using the Browser

**Quick check — run the infra diagnostic tool first:**

```bash
./scripts/local-dev/infra-diagnostic.sh
```

This verifies DNS, CoreDNS, Nginx, gateway containers, and connectivity in one command. If it passes, you're ready to use the browser.

If the diagnostic fails or you need to fix individual items:

1. **CoreDNS must be running** — resolves `*.local` domains
   ```bash
   coredns -conf /etc/coredns/Corefile &
   ```
2. **`/etc/resolv.conf` must use local DNS** — first nameserver should be `127.0.0.1`
   ```
   nameserver 127.0.0.1
   nameserver 192.168.65.7
   ```
3. **Environment must be started** — `./scripts/local-dev/envctl.sh start <env>`

If `browser_navigate` returns `ERR_NAME_NOT_RESOLVED`, check these three things in order.

### Common Playwright MCP Tools

| Tool                       | Purpose                                                   |
| -------------------------- | --------------------------------------------------------- |
| `browser_navigate`         | Go to a URL                                               |
| `browser_snapshot`         | Get accessible page structure (preferred over screenshot) |
| `browser_take_screenshot`  | Visual screenshot                                         |
| `browser_click`            | Click an element by ref                                   |
| `browser_fill_form`        | Fill multiple form fields                                 |
| `browser_type`             | Type into an element                                      |
| `browser_console_messages` | Get console logs (errors, warnings, info)                 |
| `browser_evaluate`         | Execute JavaScript on the page                            |
| `browser_network_requests` | List network requests                                     |

## Test User

A shared test user exists for automated browser testing and debugging.

### Credentials

| Field          | Value               |
| -------------- | ------------------- |
| **Email**      | `claude@test.local` |
| **Password**   | `TestUser123!`      |
| **Username**   | `claude-test`       |
| **First Name** | `Claude`            |
| **Last Name**  | `Test`              |

### Usage

When you need to interact with the app as a logged-in user, log in with these credentials:

1. Navigate to `https://<domain>.local/account/login`
2. Fill email: `claude@test.local`
3. Fill password: `TestUser123!`
4. Click Login

### If Login Fails (User Does Not Exist)

The test user may not exist if the database was reset or you're in a new environment. Create it through the signup UI:

1. Navigate to `https://<domain>.local/account/signup`
2. Fill the form:
   - Email: `claude@test.local`
   - Password: `TestUser123!`
   - Username: `claude-test`
   - First Name: `Claude`
   - Last Name: `Test`
3. Click Signup
4. The user will be created with an auto-generated organization (`local:claude-test-org`)

### Environment-Specific Notes

- The test user is **per-database** — each environment (`apollo`, `devgood`, etc.) has its own database, so the user must be created once per environment.
- The domain varies by environment — check `/root/.local-dev/<env>/.env.ganymede` for the `DOMAIN` value.
- The test user's organization ID can be found in the URL after login (e.g., `/org/<uuid>`).
