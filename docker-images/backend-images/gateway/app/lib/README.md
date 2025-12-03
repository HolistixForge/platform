# Gateway Scripts Library

Scripts for managing gateway container infrastructure (VPN, Nginx, app-gateway).

## Quick Reference

### Reload Gateway

```bash
# Fetch new build and restart Node.js
docker exec <container> /opt/gateway/app/lib/reload-gateway.sh
```

### Start/Stop Services

```bash
# OpenVPN
./start-vpn.sh
./stop-vpn.sh

# Nginx
./reset-nginx.sh

# App-gateway
./start-app-gateway.sh  # (runs in loop, typically started by reset-gateway.sh)
./stop-app-gateway.sh
```

---

## Scripts

### `reload-gateway.sh`

**Purpose:** Manual reload - fetch new build and restart app-gateway.

**Trigger:** Via `docker exec` from host machine.

**What it does:**
1. Creates marker file (`/tmp/gateway-reloading`)
2. Fetches latest build from HTTP server
3. Kills Node.js process (SIGTERM, then SIGKILL if needed)
4. `start-app-gateway.sh` detects marker and restarts immediately

**Usage:**
```bash
# Single container
docker exec gw-pool-dev-001-0 /opt/gateway/app/lib/reload-gateway.sh

# All containers (via envctl)
./scripts/local-dev/envctl.sh restart dev-001 gateway
```

---

### `fetch-gateway-build.sh`

**Purpose:** Download and extract gateway build from HTTP server.

**Called by:**
- `entrypoint-dev.sh` (container startup)
- `reload-gateway.sh` (manual reload)

**What it does:**
1. Determines dev container IP (via `ip route | grep default`)
2. Downloads: `http://{BUILD_SERVER_IP}:8090/gateway-{ENV_NAME}.tar.gz`
3. Removes old `/opt/gateway`
4. Extracts to `/opt/` (creates `/opt/gateway/`)

**Environment Variables:**
- `ENV_NAME` - Required
- `BUILD_SERVER_IP` - Optional (auto-detected)

---

### `start-app-gateway.sh`

**Purpose:** Start app-gateway with auto-restart loop.

**Simple restart loop:**
```bash
while true; do
    node /opt/gateway/app-gateway/main.js > /tmp/gateway.log 2>&1
    
    # Graceful reload (no delay)
    if [ -f /tmp/gateway-reloading ]; then
        rm /tmp/gateway-reloading
        continue
    fi
    
    # Crash (3-second delay)
    sleep 3
done
```

**Features:**
- Auto-restarts on crash (3-second delay)
- Immediate restart on manual reload (no delay)
- Logs to `/tmp/gateway.log`

---

### `stop-app-gateway.sh`

**Purpose:** Stop app-gateway processes.

**Used by:** `bin/reset-gateway.sh`

**What it does:**
- Finds Node.js processes running `main.js`
- Kills process groups (SIGTERM)
- Removes `/tmp/project-config.json`

---

### `start-vpn.sh`

**Purpose:** Start OpenVPN server for user containers.

**What it does:**
1. Generates VPN certificates (Easy-RSA)
2. Creates OpenVPN server config
3. Starts OpenVPN daemon
4. Returns VPN details as JSON

**Output:**
```json
{
  "status": "ok",
  "pid": 123,
  "port": 49100,
  "hostname": "abc123def456",
  "certificates": {
    "clients.crt": "...",
    "clients.key": "...",
    "ca.crt": "...",
    "ta.key": "..."
  }
}
```

---

### `stop-vpn.sh`

**Purpose:** Stop OpenVPN server.

**What it does:**
- Kills OpenVPN process
- Cleans up temp directory

---

### `reset-nginx.sh`

**Purpose:** Reset Nginx configuration to base state.

**What it does:**

Creates base Nginx config with 2 server blocks:

1. **External traffic** (port `GATEWAY_HTTP_PORT` - 7100-7199):
   - Server name: `_` (accept all)
   - Proxies to: `http://127.0.0.1:8888`

2. **VPN traffic** (port 80, IP 172.16.0.1):
   - For user containers over VPN
   - Proxies to: `http://127.0.0.1:8888`

**Note:** Node.js app-gateway always listens on port **8888** (fixed, hardcoded).

---

## Port Architecture

### Fixed Design

**Nginx (Stage 2):**
- Listens: `0.0.0.0:${GATEWAY_HTTP_PORT}` (7100-7199, unique per gateway)
- Also listens: `0.0.0.0:80` (for VPN traffic)
- Proxies all traffic to: `127.0.0.1:8888`

**Node.js (app-gateway):**
- Always listens: `127.0.0.1:8888` (internal, hardcoded)
- No configuration needed

**Why 8888?**
- Consistent across all gateways
- Simple configuration (no variables)
- Production-like (fixed internal port)
- Nginx handles external port mapping

---

## Marker Files

### `/tmp/gateway-reloading`

**Created by:** `reload-gateway.sh`  
**Checked by:** `start-app-gateway.sh`  
**Purpose:** Signal graceful reload (not a crash)

When `start-app-gateway.sh` detects Node.js exited:
- ✅ Marker exists → Immediate restart (reload)
- ❌ Marker missing → 3-second delay (crash recovery)

---

### `/tmp/gateway-resetting`

**Created by:** `bin/reset-gateway.sh`  
**Checked by:** `start-app-gateway.sh`  
**Purpose:** Signal full gateway reset in progress

Prevents `start-app-gateway.sh` from restarting when `reset-gateway.sh` intentionally kills Node.js.

---

## See Also

- **[GATEWAY_BUILD_DISTRIBUTION.md](../../../../../doc/guides/GATEWAY_BUILD_DISTRIBUTION.md)** - Complete architecture and troubleshooting
- **[../../README.md](../../README.md)** - Gateway container overview

