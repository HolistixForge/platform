# Gateway Container Scripts

This directory contains shell scripts that manage the gateway container infrastructure (OpenVPN, Nginx) and interact with the `app-gateway` Node.js process.

## Overview

The gateway container runs two main components:

1. **app-gateway** (Node.js) - The main application handling collaboration, permissions, OAuth, and container management
2. **Infrastructure scripts** (Shell) - Manage OpenVPN server and Nginx reverse proxy

The Node.js process orchestrates the infrastructure by executing shell scripts when needed (e.g., when containers start/stop).

---

## Directory Structure

```
app/
├── entrypoint-dev.sh          # Container entrypoint (starts app-gateway, hot-reload)
├── main.sh                     # Script runner (executes lib/bin scripts)
├── config.conf                 # Configuration variables
├── lib/                        # Library scripts (called by other scripts)
│   ├── start-vpn.sh           # Start OpenVPN server
│   ├── stop-vpn.sh             # Stop OpenVPN server
│   ├── start-app-gateway.sh   # Start app-gateway (used by entrypoint & reset-gateway)
│   ├── stop-app-gateway.sh    # Stop app-gateway (used by reset-gateway)
│   └── reset-nginx.sh         # Reset Nginx base configuration
└── bin/                        # Executable scripts (called by app-gateway via main.sh)
    ├── update-nginx-locations.sh  # Update Nginx routing for user containers
    └── reset-gateway.sh            # Full gateway reset (VPN + Nginx + app)
```

---

## Container Lifecycle

### 1. Container Startup (`entrypoint-dev.sh`)

**Purpose:** Entrypoint script that sets up gateway infrastructure and starts `app-gateway`.

**Flow:**

```
Container Start
    ↓
entrypoint-dev.sh
    ↓
1. Validate environment variables
2. Check workspace exists
3. Call reset-gateway.sh:
   - Stop VPN (if running)
   - Stop app-gateway (if running)
   - Reset Nginx configuration
   - Start VPN server
   - Start app-gateway with hot-reload loop
4. Block on app-gateway hot-reload loop
```

**Key Features:**

- **Infrastructure Setup:** Calls `reset-gateway.sh` to set up VPN and Nginx
- **Delegates to reset-gateway:** All infrastructure management handled by reset-gateway
- **Hot-reload in start-app-gateway:** Hot-reload loop is in `start-app-gateway.sh`, not entrypoint

**Environment Variables Required:**

- `GATEWAY_HTTP_PORT` - HTTP port for app-gateway
- `GATEWAY_VPN_PORT` - OpenVPN UDP port
- `WORKSPACE` - Workspace mount path (contains monorepo)
- `RELOAD_TRIGGER` - Path to hot-reload trigger file

**Logs:**

- App-gateway output: `/logs/gateway.log`
- Entrypoint logs: stdout/stderr

---

### 2. App-Gateway Initialization

When `app-gateway` starts, it:

1. Reads configuration from environment variables
2. Initializes gateway module
3. Exports `runScript` function for executing gateway scripts
4. Starts Express server and WebSocket server
5. Waits for organization allocation

**Script Execution:**

The `runScript` function is exported from `packages/app-gateway/src/module/module.ts` and can be called directly:

```typescript
import { runScript } from './module';

// Call reset-gateway script
await runScript('reset-gateway');
```

---

## Script Execution Model

### How App-Gateway Calls Scripts

App-gateway executes scripts via the exported `runScript` function:

**Location:** `packages/app-gateway/src/module/module.ts`

**Function Signature:**

```typescript
export const runScript = (
  name: 'update-nginx-locations' | 'reset-gateway',
  inputString?: string
) => {
  // Executes: ${GATEWAY_SCRIPTS_DIR}/main.sh -r bin/${name}.sh
  // Uses child_process.spawnSync()
  // Returns parsed JSON output
};
```

**Usage:**

```typescript
import { runScript } from './module';

// Call reset-gateway (called from gateway-reducer.ts after shutdown)
await runScript('reset-gateway');

// Call update-nginx-locations (with input via stdin)
await runScript('update-nginx-locations', 'jupyter-abc 172.16.1.2 8888\n');
```

**Script Requirements:**

1. **Must output JSON** - Scripts must print JSON to stdout:

   - Success: `{"status": "ok"}`
   - Error: `{"status": "error", "error": "error message"}`

2. **Exit codes** - Scripts should exit with code 0 on success

3. **Input via stdin** - Scripts can read input from stdin (e.g., `update-nginx-locations.sh`)

---

## Library Scripts (`lib/`)

These scripts are called by other scripts (not directly by app-gateway).

### `lib/start-vpn.sh`

**Purpose:** Start OpenVPN server for user container networking.

**What it does:**

1. Creates temporary directory for certificates and configs (`/tmp/ovpn-XXXXXXXXXX`)
2. Generates CA, server, and client certificates using `easy-rsa`
3. Creates OpenVPN server configuration
4. Starts OpenVPN daemon
5. Outputs JSON with VPN config (PID, temp dir, port, hostname, certificates)

**Output Format:**

```json
{
  "status": "ok",
  "pid": 12345,
  "temp_dir": "/tmp/ovpn-abc123",
  "port": 49100,
  "hostname": "gw-pool-0.domain.local",
  "certificates": {
    "clients.crt": "...",
    "clients.key": "...",
    "ca.crt": "...",
    "ta.key": "..."
  }
}
```

**Environment Variables:**

- `OPENVPN_PORT` - UDP port for OpenVPN (from `GATEWAY_VPN_PORT`)

**VPN Network:** `172.16.0.0/16`

---

### `lib/stop-vpn.sh`

**Purpose:** Stop all OpenVPN servers.

**What it does:**

1. Finds all OpenVPN temp directories (`/tmp/ovpn-*`)
2. Reads PID from each directory's `openvpn.pid` file
3. Kills OpenVPN processes
4. Removes temp directories
5. Force-kills any remaining OpenVPN processes

**Output:** `{"status": "ok", "message": "OpenVPN servers stopped successfully"}`

---

### `lib/reset-nginx.sh`

**Purpose:** Reset Nginx to base configuration (removes all user container routes).

**What it does:**

1. Clears Nginx logs
2. Creates base Nginx config with:
   - Server block on `APP_GATEWAY_PORT` (127.0.0.1) - proxies `/collab` to app-gateway :8888
   - Server block on port 80 (172.16.0.1) - proxies `/collab` to app-gateway :8888
3. Starts or reloads Nginx

**Environment Variables:**

- `APP_GATEWAY_PORT` - Port for app-gateway (from `GATEWAY_HTTP_PORT`)
- `NGINX_CONFIG` - Path to Nginx config file (default: `/etc/nginx/conf.d/reverse-proxy.conf`)

---

### `lib/start-app-gateway.sh`

**Purpose:** Start app-gateway Node.js process with hot-reload support.

**Usage:**

- **Called by:** `bin/reset-gateway.sh`

**What it does:**

1. Validates workspace exists
2. Sets up environment variables for app-gateway
3. Enters hot-reload loop:
   - Starts Node.js process: `node --enable-source-maps ./dist/packages/app-gateway/main.js`
   - Watches `.gateway-reload-trigger` file via `inotifywait`
   - Restarts app-gateway on trigger file change
   - Auto-recovers if process crashes
4. Runs in foreground (blocks until process exits or container stops)

**Environment Variables:**

- `WORKSPACE` - Required, workspace mount path
- `GATEWAY_HTTP_PORT` - HTTP port (default: 8888)
- `LOG_FILE` - Log file path (default: `/logs/gateway.log`)
- `RELOAD_TRIGGER` - Path to hot-reload trigger file
- All app-gateway env vars (GATEWAY_ID, GATEWAY_TOKEN, etc.) should be set by container

**Hot-Reload Mechanism:**

- Watches `RELOAD_TRIGGER` file for modifications
- On change: gracefully stops app-gateway (SIGTERM, wait up to 10s), then restarts
- Checks process health every 30s (inotifywait timeout)
- **Smart restart logic:**
  - If process dies and `/tmp/gateway-resetting` marker exists: Exit (reset-gateway.sh will start new process)
  - If process dies without marker: Restart (unexpected crash/error)

---

### `lib/stop-app-gateway.sh`

**Purpose:** Stop app-gateway processes.

**Used by:** `bin/reset-gateway.sh`

**What it does:**

- Finds all Node.js processes running `app-gateway/main.js`
- Kills process groups (PGID) using SIGTERM
- Removes `/tmp/project-config.json`

**Note:** This script is used by `reset-gateway.sh` to stop app-gateway before resetting infrastructure. The entrypoint handles shutdown via signal handlers, not this script.

---

## Executable Scripts (`bin/`)

These scripts are called by app-gateway via `main.sh`.

### `bin/update-nginx-locations.sh`

**Purpose:** Dynamically update Nginx routing for user containers.

**How it's called:**

```typescript
// From app-gateway (currently disabled - see note below)
gatewayExports.updateReverseProxy([
  { host: 'jupyter-abc', ip: '172.16.1.2', port: 8888 },
  { host: 'pgadmin-def', ip: '172.16.1.3', port: 5050 },
]);
```

**Input Format (stdin):**

```
jupyter-abc 172.16.1.2 8888
pgadmin-def 172.16.1.3 5050
```

**What it does:**

1. Copies current Nginx config to temp file
2. Removes all location blocks except `/collab` and `/502.html`
3. Reads services from stdin (format: `host ip port`)
4. Adds location block for each service: `location /{host} { proxy_pass http://{ip}:{port}; }`
5. Updates Nginx config if changed
6. Reloads Nginx

**Output:** `{"status": "ok"}`

**Note:** Currently disabled in code (`packages/app-gateway/src/module/module.ts:154`) with `throw new Error('fix update-nginx-locations script')`. Needs to be fixed before use.

---

### `bin/reset-gateway.sh`

**Purpose:** Full gateway reset (stops everything, resets, restarts).

**How it's called:**

```typescript
// From gateway-reducer.ts after shutdownGateway()
import { runScript } from './module';
await runScript('reset-gateway');
```

**What it does (in order):**

1. Create marker file `/tmp/gateway-resetting` (signals reset in progress)
2. Stop OpenVPN (`lib/stop-vpn.sh`)
3. Stop app-gateway (`lib/stop-app-gateway.sh`) - **This kills the calling process!**
4. Reset Nginx (`lib/reset-nginx.sh`)
5. Start OpenVPN (`lib/start-vpn.sh`)
6. Start app-gateway (`lib/start-app-gateway.sh`) with hot-reload (in background)
7. Remove marker file (after new process starts)

**Execution:**

Always runs in background via `nohup setsid` wrapper. This ensures:

- When called from app-gateway: Script completes even after calling process is killed
- When called from entrypoint: Script runs in background, entrypoint keeps container alive with `tail -f /dev/null`

**Why nohup/setsid is required:**

When called from app-gateway, `stop-app-gateway.sh` will kill the calling process (the app-gateway Node.js process). Without `nohup setsid`, the script would be killed before it can complete the reset. The wrapper ensures the reset completes even after the calling process is terminated.

**Marker File Mechanism:**

The script creates `/tmp/gateway-resetting` before stopping app-gateway. When `start-app-gateway.sh` detects the process died, it checks for this marker:

- **Marker exists:** Exit gracefully (reset-gateway.sh will start new process)
- **Marker missing:** Restart (unexpected crash/error)

This prevents `start-app-gateway.sh` from restarting when the process was intentionally killed by `reset-gateway.sh`.

**Output:** `{"status": "ok"}` (returns immediately, reset happens in background)

**Note:** This script is called automatically by `gateway-reducer.ts` after `shutdownGateway()` when the gateway becomes inactive (5 minutes of inactivity).

---

## Script Runner (`main.sh`)

**Purpose:** Generic script executor used by app-gateway.

**Usage:**

```bash
# Execute a single script
./main.sh -r bin/update-nginx-locations.sh
```

**How it works:**

1. Sources `config.conf` for environment variables
2. Changes directory to `GATEWAY_SCRIPTS_DIR`
3. Executes specified script
4. Scripts must output JSON to stdout

**Environment Variables (from config.conf):**

- `GATEWAY_DEV` - Set to "1" for development
- `ENV_NAME` - Environment name (e.g., "dev-001")
- `DOMAIN_NAME` - Domain name (e.g., "domain.local")
- `GANYMEDE_FQDN` - Ganymede API FQDN
- `ALLOWED_ORIGINS` - CORS allowed origins
- `IF` - Network interface (default: "enX0")
- `NGINX_CONFIG` - Nginx config path

---

## Configuration (`config.conf`)

**Purpose:** Centralized configuration file for all scripts.

**Variables:**

- **Dev-only:** `GATEWAY_DEV="1"`
- **Derived from env:** `GANYMEDE_FQDN`, `ALLOWED_ORIGINS`
- **Fixed:** `IF`, `NGINX_CONFIG`

**Note:** Many variables reference `ENV_NAME` and `DOMAIN_NAME` which should be set by container environment.

---

## Interaction Flows

### Flow 1: Container Startup

```
1. Docker starts container
   ↓
2. entrypoint-dev.sh runs
   ↓
3. Validates environment, checks workspace
   ↓
4. Calls reset-gateway.sh (via main.sh)
   ↓
5. reset-gateway.sh (runs in background via nohup):
   - Stops VPN (if running)
   - Stops app-gateway (if running)
   - Resets Nginx
   - Starts VPN
   - Starts app-gateway with hot-reload loop (background)
   ↓
6. Entrypoint keeps container alive: tail -f /dev/null
   ↓
7. start-app-gateway.sh runs hot-reload loop (background)
   ↓
8. App-gateway initializes, waits for allocation
```

### Flow 2: Organization Allocation

```
1. Ganymede allocates gateway to organization
   ↓
2. Ganymede calls: POST /collab/start
   ↓
3. App-gateway initializes organization context
   ↓
4. App-gateway initializes
   ↓
5. VPN ready, user containers can connect
```

### Flow 3: User Container Starts

```
1. User starts container via frontend
   ↓
2. Container connects to gateway VPN (172.16.x.x)
   ↓
3. Container registers with gateway (watchdog)
   ↓
4. App-gateway calls: bin/update-nginx-locations.sh
   ↓
5. Script adds location block: /{service} → http://{ip}:{port}
   ↓
6. Nginx reloaded, container accessible via gateway
```

### Flow 4: Hot Reload

```
1. Developer: touch .gateway-reload-trigger
   ↓
2. start-app-gateway.sh detects file change (inotifywait)
   ↓
3. Sends SIGTERM to app-gateway process
   ↓
4. Waits up to 10s for graceful shutdown
   ↓
5. Restarts: node dist/packages/app-gateway/main.js
   ↓
6. App-gateway reinitializes (may load saved state)
   ↓
7. Hot-reload loop continues
```

### Flow 5: Gateway Shutdown (Inactivity)

```
1. App-gateway detects inactivity (5min)
   ↓
2. GatewayReducer._periodic() detects shutdown time passed
   ↓
3. Calls: shutdownGateway()
   - Stops OAuth cleanup timer
   - Pushes final data to Ganymede
   ↓
4. Calls: runScript('reset-gateway')
   ↓
5. reset-gateway.sh (always wrapped in nohup setsid):
   - Wrapped in nohup setsid (prevents script from being killed)
   - Stops VPN
   - Stops app-gateway (kills calling process!)
   - Resets Nginx
   - Starts VPN
   - Starts app-gateway with hot-reload (background)
   ↓
6. Gateway returns to pool, ready for next organization
```

**Note:** The gateway doesn't actually shut down - it resets and restarts, returning to the pool for the next organization allocation.

---

## Environment Variables Summary

### Required by Entrypoint

| Variable            | Description               | Example                            |
| ------------------- | ------------------------- | ---------------------------------- |
| `GATEWAY_HTTP_PORT` | HTTP port for app-gateway | `7100`                             |
| `GATEWAY_VPN_PORT`  | OpenVPN UDP port          | `49100`                            |
| `WORKSPACE`         | Workspace mount path      | `/home/dev/workspace`              |
| `RELOAD_TRIGGER`    | Hot-reload trigger file   | `/path/to/.gateway-reload-trigger` |

### Required by App-Gateway

| Variable              | Description            | Example                              |
| --------------------- | ---------------------- | ------------------------------------ |
| `GATEWAY_ID`          | Gateway UUID           | `550e8400-...`                       |
| `GATEWAY_TOKEN`       | JWT token for Ganymede | `eyJhbGc...`                         |
| `GATEWAY_HMAC_SECRET` | HMAC secret            | `random-secret`                      |
| `SERVER_BIND`         | Server bindings JSON   | `[{"host":"127.0.0.1","port":8888}]` |
| `GANYMEDE_FQDN`       | Ganymede API FQDN      | `ganymede.domain.local`              |
| `GATEWAY_SCRIPTS_DIR` | Path to this directory | `/path/to/gateway/app`               |

### Used by Scripts

| Variable           | Description                                 | Example                                |
| ------------------ | ------------------------------------------- | -------------------------------------- |
| `ENV_NAME`         | Environment name                            | `dev-001`                              |
| `DOMAIN_NAME`      | Domain name                                 | `domain.local`                         |
| `OPENVPN_PORT`     | OpenVPN port (from `GATEWAY_VPN_PORT`)      | `49100`                                |
| `APP_GATEWAY_PORT` | App-gateway port (from `GATEWAY_HTTP_PORT`) | `7100`                                 |
| `NGINX_CONFIG`     | Nginx config path                           | `/etc/nginx/conf.d/reverse-proxy.conf` |

---

## Related Documentation

- [Gateway Architecture](../../../doc/architecture/GATEWAY_ARCHITECTURE.md)
- [Gateway Docker Requirements](../../../doc/requirements/GATEWAY_DOCKER_REQUIREMENTS.md)
- [Local Development Guide](../../../doc/guides/LOCAL_DEVELOPMENT.md)
- [App-Gateway README](../../../packages/app-gateway/README.md)
