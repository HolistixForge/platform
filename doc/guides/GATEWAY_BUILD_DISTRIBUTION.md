# Gateway Build Distribution - Local Development

This document explains the HTTP-based build distribution system for gateway containers in the local development environment.

**Last Updated:** December 3, 2025  
**Status:** ✅ Production-ready

---

## Quick Reference

### Development Workflow

```bash
# Edit gateway code
vim packages/app-gateway/src/routes/collab.ts

# Build
npx nx build app-gateway

# Reload all gateways
./scripts/local-dev/envctl.sh restart dev-001 gateway
```

**What happens:**
1. Validates bundles are React-free
2. Repacks build (~5MB tarball)
3. Executes reload script in all gateway containers
4. Containers fetch new build and restart Node.js
5. New code running in ~10 seconds

### Diagnostic Commands

```bash
# Display Nginx config
docker exec gw-pool-dev-001-0 cat /etc/nginx/conf.d/reverse-proxy.conf

# List listening ports
docker exec gw-pool-dev-001-0 ss -tlnp | grep LISTEN

# Display app-gateway logs
docker exec gw-pool-dev-001-0 cat /tmp/gateway.log

# Check processes (nginx, openvpn, node)
docker exec gw-pool-dev-001-0 ps aux | grep -E "nginx|openvpn|node"

# Manual reload
docker exec gw-pool-dev-001-0 /opt/gateway/app/lib/reload-gateway.sh
```

---

## Architecture Overview

### The Problem

Gateway containers need:
- Compiled `app-gateway` Node.js application
- Infrastructure management scripts (VPN, Nginx, DNS)
- Hot-reload capability for development

**Previous approaches** (Docker volumes, bind mounts) failed in Docker-in-Docker environments and were overly complex.

### The Solution

**HTTP-based build distribution** - Simple, reliable, production-like.

```
┌─────────────────────────────────────────────────────────────────┐
│ Dev Container (172.17.0.2)                                      │
│                                                                  │
│  1. Build:     npx nx build app-gateway                         │
│                → dist/packages/app-gateway/main.js (8.9MB)      │
│                                                                  │
│  2. Validate:  ./scripts/validate-node-bundles.sh               │
│                → Ensures no React in backend bundles            │
│                                                                  │
│  3. Pack:      ./scripts/local-dev/pack-gateway-build.sh        │
│                → /root/.local-dev-builds/gateway-{env}.tar.gz   │
│                                                                  │
│  4. Serve:     ./scripts/local-dev/serve-builds.sh              │
│                → http://172.17.0.2:8090/gateway-{env}.tar.gz    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                            │ HTTP GET
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ Gateway Container (gw-pool-{env}-{n})                           │
│                                                                  │
│  On Startup:                                                    │
│    1. fetch-gateway-build.sh                                    │
│       → curl http://172.17.0.2:8090/gateway-{env}.tar.gz        │
│       → tar xz -C /opt                                          │
│                                                                  │
│  Directory Structure:                                           │
│    /opt/gateway/                                                │
│    ├── app-gateway/                                             │
│    │   ├── main.js          (Node.js app: 8.9MB)                │
│    │   ├── main.js.map      (Source maps: 15.4MB)               │
│    │   └── src/             (TypeScript source for debugging)   │
│    ├── app/                                                     │
│    │   ├── bin/             (reset-gateway, update-nginx)       │
│    │   ├── lib/             (start/stop/reload scripts)         │
│    │   ├── main.sh          (Script runner)                     │
│    │   └── config.conf      (Environment config)                │
│    └── BUILD_INFO.txt       (Build metadata)                    │
│                                                                  │
│  Infrastructure:                                                │
│    → /opt/gateway/app/main.sh -r bin/reset-gateway.sh          │
│       - Sets up OpenVPN (VPN for user containers)               │
│       - Configures Nginx (Stage 2 proxy)                        │
│       - Starts app-gateway (Node.js on port 8888)               │
│                                                                  │
│  Port Configuration:                                            │
│    → Node.js listens on 127.0.0.1:8888 (internal, fixed)        │
│    → Nginx listens on 0.0.0.0:7100-7199 (external, per-gateway) │
│    → Nginx proxies: 7100-7199 → 8888                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Components

### 1. Build Server (`serve-builds.sh`)

Python HTTP server serving gateway build tarballs.

**Configuration:**
- Port: `8090`
- Bind: `0.0.0.0` (accessible from bridge network)
- Directory: `/root/.local-dev-builds/`

**Security:**
- ✅ Only serves `.tar.gz` files
- ✅ No access to `.env`, keys, or configs
- ✅ Isolated from environment directories
- ✅ Only accessible from Docker bridge network

**Usage:**
```bash
# Start (runs in background)
./scripts/local-dev/serve-builds.sh &

# Verify
curl -I http://172.17.0.2:8090/gateway-dev-001.tar.gz
```

---

### 2. Pack Script (`pack-gateway-build.sh`)

Creates distributable tarball from compiled app and scripts.

**Usage:**
```bash
./scripts/local-dev/pack-gateway-build.sh <env-name> [workspace-path]

# Example
./scripts/local-dev/pack-gateway-build.sh dev-001 /root/workspace/monorepo
```

**What it does:**
1. Copies `dist/packages/app-gateway/main.js` and `main.js.map`
2. Copies `docker-images/backend-images/gateway/app/` (scripts)
3. Creates `BUILD_INFO.txt` with metadata
4. Packs into `/root/.local-dev-builds/gateway-{env}.tar.gz`

**Output:**
```
✅ Build packed: gateway-dev-001.tar.gz (5.0M)
   Location: /root/.local-dev-builds/gateway-dev-001.tar.gz

📦 Package contents:
   - app-gateway/main.js       (compiled app)
   - app/bin/                  (reset-gateway, update-nginx-locations)
   - app/lib/                  (start/stop/reload scripts)
   - app/main.sh               (script runner)
   - app/config.conf           (configuration)

📊 Served at:
   http://172.17.0.2:8090/gateway-dev-001.tar.gz
```

---

### 3. Fetch Script (`fetch-gateway-build.sh`)

Runs inside gateway containers to download and extract builds.

**Location:** `docker-images/backend-images/gateway/app/lib/fetch-gateway-build.sh`

**Execution:**
- On container startup (entrypoint-dev.sh)
- On manual reload (reload-gateway.sh)

**What it does:**
1. Determines dev container IP (`ip route | grep default`)
2. Downloads `http://{BUILD_SERVER_IP}:8090/gateway-{ENV_NAME}.tar.gz`
3. Removes old `/opt/gateway` directory
4. Extracts tarball to `/opt/`
5. Verifies extraction succeeded

**Environment Variables:**
- `ENV_NAME` - Environment identifier (e.g., "dev-001")
- `BUILD_SERVER_IP` - Dev container IP (optional, auto-detected)

---

### 4. Reload Script (`reload-gateway.sh`)

Manual reload mechanism using `docker exec`.

**Location:** `docker-images/backend-images/gateway/app/lib/reload-gateway.sh`

**Usage:**
```bash
# Direct (from host)
docker exec gw-pool-dev-001-0 /opt/gateway/app/lib/reload-gateway.sh

# Via envctl (recommended)
./scripts/local-dev/envctl.sh restart dev-001 gateway
```

**What it does:**
1. Creates marker file `/tmp/gateway-reloading`
2. Fetches new build from HTTP server
3. Finds Node.js process (`pgrep -f "node.*main.js"`)
4. Sends SIGTERM for graceful shutdown (waits up to 10s)
5. Force kills if needed (SIGKILL)
6. `start-app-gateway.sh` detects exit and restarts Node.js

**Workflow:**
```
Developer → envctl.sh restart → pack-gateway-build.sh
                                       ↓
                          HTTP server serves new build
                                       ↓
                          docker exec reload-gateway.sh (all containers)
                                       ↓
                          fetch-gateway-build.sh downloads
                                       ↓
                          pkill Node.js (SIGTERM)
                                       ↓
                          start-app-gateway.sh detects exit, restarts
                                       ↓
                          Node.js starts with new code
```

---

### 5. Start Script (`start-app-gateway.sh`)

Simple auto-restart loop for Node.js process.

**Location:** `docker-images/backend-images/gateway/app/lib/start-app-gateway.sh`

**Mechanism:**
```bash
while true; do
    # Start Node.js (blocks until exit)
    node --enable-source-maps /opt/gateway/app-gateway/main.js
    
    # Process exited - check if it's a graceful reload
    if [ -f /tmp/gateway-reloading ]; then
        # reload-gateway.sh triggered this
        rm /tmp/gateway-reloading
        continue  # Restart immediately
    fi
    
    # Unexpected crash - restart after delay
    sleep 3
    continue
done
```

**Key Features:**
- ✅ Automatic restart on crash (3-second delay)
- ✅ Immediate restart on manual reload (no delay)
- ✅ Distinguishes between crashes and intentional reloads
- ✅ Simple, no file watching needed

---

## Port Configuration

### Fixed Architecture

**Nginx (Stage 2 in gateway container):**
- Listens on: `0.0.0.0:${GATEWAY_HTTP_PORT}` (7100-7199, unique per gateway)
- Proxies to: `127.0.0.1:8888`

**Node.js (app-gateway):**
- Always listens on: `127.0.0.1:8888` (fixed, hardcoded)
- No `SERVER_BIND` environment variable needed

**Why this works:**
- External clients connect to port 7100-7199 (exposed via Docker `-p`)
- Nginx proxies everything to internal port 8888
- Node.js only needs to listen on one fixed port
- Simple, predictable, production-like

### Two-Stage Nginx Routing

**Stage 1: Main Dev Container**
- SSL termination for `*.domain.local`
- Routes `org-{uuid}.domain.local` → Gateway port 7100-7199

**Stage 2: Gateway Container**
- Plain HTTP (SSL already terminated)
- Routes all paths to app-gateway on port 8888
- Dynamic location blocks for user containers

---


## Bundle Validation

**Critical:** Backend bundles must be React-free.

Bundle validation runs automatically during environment creation and can be run manually:

```bash
# Automatic (during create-env.sh)
./scripts/local-dev/create-env.sh dev-001

# Manual
./scripts/validate-node-bundles.sh
```

**Result:**
```
✅ All bundles are clean!
# or
❌ BUILD VALIDATION FAILED: React dependencies found
```

> **See:** [Package Architecture Guide](PACKAGE_ARCHITECTURE.md) for:
> - React dependency troubleshooting
> - Package architecture standards
> - Validation tools documentation
> - Import patterns and best practices

---

## Reload Mechanism (Option C: Docker Exec)

### Design

**No file watching.** Manual trigger via `docker exec`.

**Why this approach:**
- ✅ Simple and reliable
- ✅ Works even if Node.js is crashed
- ✅ No inotifywait dependency
- ✅ No filesystem mounts needed
- ✅ Standard Unix mechanism

### Implementation

**`reload-gateway.sh`** script:
1. Sets marker file (`/tmp/gateway-reloading`)
2. Fetches latest build from HTTP server
3. Kills Node.js process (SIGTERM)
4. `start-app-gateway.sh` detects marker, restarts immediately

**`start-app-gateway.sh`** loop:
```bash
while true; do
    node /opt/gateway/app-gateway/main.js
    
    if [ -f /tmp/gateway-reloading ]; then
        # Graceful reload - restart immediately
        rm /tmp/gateway-reloading
        continue
    fi
    
    # Crash - wait 3s before restart
    sleep 3
done
```

### Trigger Reload

**Via envctl (recommended):**
```bash
./scripts/local-dev/envctl.sh restart dev-001 gateway
```

**What happens:**
1. Builds and validates bundles
2. Repacks gateway build
3. Executes `reload-gateway.sh` in all gateway containers via `docker exec`
4. Each container fetches new build and restarts

**Direct (manual):**
```bash
# Single container
docker exec gw-pool-dev-001-0 /opt/gateway/app/lib/reload-gateway.sh

# All containers
for container in $(docker ps -q --filter "label=environment=dev-001"); do
    docker exec $container /opt/gateway/app/lib/reload-gateway.sh
done
```

---

## Environment Variables

### Required

| Variable            | Description                  | Example                      |
| ------------------- | ---------------------------- | ---------------------------- |
| `ENV_NAME`          | Environment identifier       | `dev-001`                    |
| `GATEWAY_HTTP_PORT` | External HTTP port (Nginx)   | `7100`                       |
| `GATEWAY_VPN_PORT`  | OpenVPN UDP port             | `49100`                      |
| `GATEWAY_ID`        | Gateway UUID                 | `550e8400-...`               |
| `GATEWAY_TOKEN`     | JWT token for Ganymede auth  | `eyJhbGc...`                 |
| `GANYMEDE_FQDN`     | Ganymede API endpoint        | `ganymede.domain.local`      |
| `DOMAIN`            | Base domain                  | `domain.local`               |

### Optional

| Variable           | Description             | Default            |
| ------------------ | ----------------------- | ------------------ |
| `BUILD_SERVER_IP`  | Dev container IP        | Auto-detected      |
| `GATEWAY_ROOT`     | Build extraction path   | `/opt/gateway`     |
| `LOG_FILE`         | App-gateway log path    | `/tmp/gateway.log` |

### Removed Variables

These are NO LONGER USED:
- ❌ `SERVER_BIND` - Port 8888 is now hardcoded
- ❌ `RELOAD_TRIGGER` - No file watching mechanism
- ❌ `WORKSPACE` - No bind mounts

---

## Security Considerations

### HTTP Build Server

**Isolation:**
- Only serves from `/root/.local-dev-builds/`
- Cannot access parent directories
- No access to environment configs (`.env.ganymede`)
- No access to SSL certificates or JWT keys

**Network:**
- Binds to `0.0.0.0:8090` on Docker bridge network
- Only accessible from containers on same network
- NOT exposed to Windows host or internet
- User containers on VPN network (cannot reach build server)

### Build Contents

**Included:**
- ✅ Compiled JavaScript (`main.js`)
- ✅ Source maps (`main.js.map`)
- ✅ TypeScript source (for debugging)
- ✅ Infrastructure scripts
- ✅ Build metadata

**Excluded:**
- ❌ Environment files (`.env`)
- ❌ SSL certificates
- ❌ JWT keys
- ❌ Database credentials
- ❌ User data

### Attack Surface

**Compromised Gateway Container:**
- Can fetch new builds from HTTP server
- Can restart with fetched code
- Cannot access dev container filesystem
- Cannot access other environments' builds (isolated by ENV_NAME)

**Compromised User Container:**
- On VPN network (172.16.x.x)
- Cannot reach build server (172.17.x.x - bridge network)
- No access to gateway internals

---

## Troubleshooting

### Gateway Not Starting

**Symptoms:**
- Container running but no response on port 7100-7199

**Diagnosis:**
```bash
# Check container is running
docker ps --filter "label=environment=dev-001"

# Check container startup logs
docker logs gw-pool-dev-001-0

# Check app-gateway logs
docker exec gw-pool-dev-001-0 cat /tmp/gateway.log

# Check processes
docker exec gw-pool-dev-001-0 ps aux | grep -E "nginx|openvpn|node"

# Check listening ports
docker exec gw-pool-dev-001-0 ss -tlnp | grep LISTEN
```

**Expected state:**
```
✅ Nginx:   Listening on 0.0.0.0:7100 and 0.0.0.0:80
✅ OpenVPN: Listening on 127.0.0.1:5555
✅ Node.js: Listening on 127.0.0.1:8888
```

**Common Issues:**
1. **VPN still initializing** - Wait 60-75 seconds for DH params generation
2. **Build not found** - Ensure HTTP server running and build packed
3. **Port conflict** - Check no other process using 8888
4. **JSON parse error** - Check environment variables are valid JSON

---

### Build Not Updating

**Symptoms:**
- Code changes not reflected after reload

**Solutions:**
```bash
# 1. Verify build is fresh
npx nx build app-gateway
ls -lh dist/packages/app-gateway/main.js

# 2. Repack build
./scripts/local-dev/pack-gateway-build.sh dev-001

# 3. Verify HTTP server has new file
curl -I http://172.17.0.2:8090/gateway-dev-001.tar.gz
ls -lh /root/.local-dev-builds/gateway-dev-001.tar.gz

# 4. Trigger reload
./scripts/local-dev/envctl.sh restart dev-001 gateway

# 5. Verify container fetched new build
docker exec gw-pool-dev-001-0 cat /opt/gateway/BUILD_INFO.txt
```

---

### React Dependency Detected

**Symptoms:**
- Build validation fails
- Runtime error: "Cannot find module 'react'"

**Diagnosis:**
```bash
# Run validator
./scripts/validate-node-bundles.sh

# Check specific bundle
node scripts/analyze-bundle.js dist/packages/app-gateway/main.js
```

**Output if issues found:**
```
❌ dist/packages/app-gateway/main.js: Found 1 issue(s):

   ⚠️  React: 4 occurrence(s)
      Line 181638: var e4 = require("react");
      Line 181853: var react = require("react");

❌ BUILD VALIDATION FAILED
```

**Common Fixes:**

1. **Missing `type` keyword:**
   ```typescript
   // Wrong
   import { TFrontendExports } from '@holistix/collab/frontend';
   
   // Correct
   import type { TFrontendExports } from '@holistix/collab/frontend';
   ```

2. **Backend exporting frontend code:**
   ```typescript
   // packages/my-package/src/index.ts
   
   // Wrong
   export { useMyHook } from './lib/hooks';
   
   // Correct - move to frontend.ts
   // packages/my-package/src/frontend.ts
   export { useMyHook } from './lib/hooks';
   ```

3. **Mixed React/non-React in same file:**
   ```typescript
   // Wrong - both in one file
   export class MyClass { }
   export function useMyHook() { }
   
   // Correct - separate files
   // lib/my-class.ts
   export class MyClass { }
   
   // lib/my-hook.ts
   export function useMyHook() { }
   ```

4. **TypeScript config not excluding `.tsx`:**
   ```json
   // tsconfig.lib.json
   {
     "exclude": [
       "src/**/*.tsx",
       "src/frontend.ts"
     ]
   }
   ```

**After fixing:**
```bash
# Clear Nx cache
npx nx reset

# Rebuild
npx nx build <package>

# Validate
./scripts/validate-node-bundles.sh
```

---

### HTTP Server Not Running

**Symptoms:**
- Gateway containers fail to fetch build
- Error: "Failed to connect to 172.17.0.2 port 8090"

**Solutions:**
```bash
# Check if running
ps aux | grep "python.*http.server.*8090"

# Start server
cd /root/workspace/monorepo/scripts/local-dev
./serve-builds.sh &

# Verify
curl -I http://172.17.0.2:8090/gateway-dev-001.tar.gz
```

---

## Multi-Workspace Support

Different environments can use different workspaces/branches:

```bash
# Environment 1: main branch
cd /root/workspace/monorepo
./scripts/local-dev/create-env.sh dev-001 domain.local

# Environment 2: feature branch  
cd /root/workspace-feature/monorepo
./scripts/local-dev/create-env.sh dev-002 domain.local /root/workspace-feature/monorepo
```

**How it works:**
- Each environment has unique `ENV_NAME`
- Build server serves: `gateway-{ENV_NAME}.tar.gz`
- Gateways fetch based on their `ENV_NAME`
- Environments are isolated

**Benefits:**
- ✅ Test features without affecting main environment
- ✅ Compare different implementations side-by-side
- ✅ Multiple developers can have separate environments

---

## Migration from Bind Mounts

Previous versions used Docker bind mounts to share the workspace.

**Problems with bind mounts:**
- ❌ Don't work in Docker-in-Docker on WSL2
- ❌ Path resolution conflicts (host vs container paths)
- ❌ Security: Full source code access in containers
- ❌ Complexity: Managing multiple mount points
- ❌ All environments share same code

**HTTP distribution advantages:**
- ✅ Works in any Docker configuration
- ✅ Simple path structure (`/opt/gateway`)
- ✅ Security: Only compiled code, no secrets
- ✅ Clean: Single HTTP server, simple fetch
- ✅ Multi-workspace ready

---

## Validation Results

### Bundle Analysis

All Node.js applications are **100% React-free**:

| Application        | Size   | Lines   | Status |
| ------------------ | ------ | ------- | ------ |
| app-gateway        | 8.83MB | 210,767 | ✅ CLEAN |
| app-ganymede       | 8.54MB | 200,909 | ✅ CLEAN |
| app-ganymede-cmds  | 4.10MB | 94,107  | ✅ CLEAN |

### System Status

```
✅ HTTP Build Server:      Running (port 8090)
✅ Bundle Validation:       All apps pass
✅ Gateway Containers:      3 running per environment
✅ Node.js Process:         Active (port 8888)
✅ Nginx Proxy:             Active (port 7100-7199 → 8888)
✅ Infrastructure:          VPN + Nginx operational
✅ Reload Mechanism:        Docker exec functional
```

---

## Related Documentation

- **[LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md)** - Complete setup guide with DNS and SSL configuration
- **[PACKAGE_ARCHITECTURE.md](PACKAGE_ARCHITECTURE.md)** - React dependency management and package patterns
- **[SYSTEM_ARCHITECTURE.md](../architecture/SYSTEM_ARCHITECTURE.md)** - Full system architecture diagrams
- **[GATEWAY_ARCHITECTURE.md](../architecture/GATEWAY_ARCHITECTURE.md)** - Gateway-specific architecture
- **[scripts/local-dev/README.md](../../scripts/local-dev/README.md)** - Scripts reference

---

## Key Improvements Summary

1. ✅ **HTTP Build Distribution** - Gateways fetch builds via HTTP (no bind mounts)
2. ✅ **React-Free Bundles** - All Node.js apps validated and clean
3. ✅ **Automated Validation** - Bundle checking integrated into build process
4. ✅ **Docker Exec Reload** - Simple, reliable reload mechanism
5. ✅ **Fixed Port Architecture** - Node.js always on 8888, Nginx proxies from external port
6. ✅ **Multi-Workspace** - Support different code per environment
7. ✅ **Production-Like** - Clean separation, proper paths

---

**Status:** ✅ Production-ready  
**Date:** December 3, 2025
