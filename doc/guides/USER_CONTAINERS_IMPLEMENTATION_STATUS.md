# User Containers - Implementation Status and Roadmap

## Goal

Enable users to create an Ubuntu Terminal container from the frontend UI, run it on any machine by copy-pasting a Docker command, and access the web terminal (ttyd) through the platform's routing layer.

---

## Architecture Overview

```
User clicks "New Container" in whiteboard context menu
         │
         ▼
┌──────────────────────────────────────────────────────┐
│ Frontend: New Container Dialog                        │
│ - Selects image from dropdown (e.g. "Ubuntu Terminal")│
│ - Enters container name                               │
│ - Dispatches user-container:new event                 │
└──────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────┐
│ Backend Reducer: _new()                               │
│ - Permission check                                    │
│ - Image lookup from ContainerImageRegistry            │
│ - Creates TUserContainer in shared state              │
│ - Creates graph node on whiteboard                    │
│ - Container appears as card node (RED, no runner)     │
└──────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────┐
│ Frontend: Container Card                              │
│ - Shows runner selection: "Local" button              │
│ - User clicks "Local"                                 │
│ - Dispatches: set-runner + start events               │
└──────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────┐
│ Backend Reducer: _setRunner() + _start()              │
│ - Sets runner to "local"                              │
│ - Requests JWT token from Ganymede via HTTP           │
│   (POST /gateway/tokens/user-container)               │
│ - Calls runner.start(container, token)                │
│ - For "Local" runner: generates docker run command    │
│   and stores it in shared state for frontend display  │
└──────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────┐
│ Frontend: Shows Docker Command                        │
│ - Displays command ready to copy-paste                │
│ - User runs it on their machine or any Docker host    │
└──────────────────────────────────────────────────────┘
         │
         ▼  (User runs the container)
┌──────────────────────────────────────────────────────┐
│ Container Startup (container-entrypoint.sh)            │
│ 1. Decodes SETTINGS env var (base64 JSON)             │
│ 2. Connects to gateway VPN (OpenVPN)                  │
│ 3. Starts ttyd on port 7681                           │
│ 4. Registers HTTP service: terminal:7681              │
│ 5. Sends watchdog every 15s with system stats         │
└──────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────┐
│ Gateway processes events from container               │
│ - Watchdog: updates last_watchdog_at (LED → BLUE)     │
│ - MapHttpService: adds to httpServices array          │
│ - Updates nginx: FQDN → VPN_IP:port                  │
└──────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────┐
│ Auth Guard Proxy (inside container, port 8443)        │
│ - Intercepts all inbound requests                     │
│ - Authenticates user via OAuth with Ganymede           │
│ - Checks permissions via gateway /containers/:id/     │
│   verify-access endpoint                              │
│ - Proxies authenticated requests to backend service   │
│   (e.g. ttyd on port 7681)                            │
└──────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────┐
│ User accesses container                               │
│ - "Open Terminal" in settings menu                    │
│ - Browser → uc-{id}.org-{org}.domain.local            │
│ - Stage 1 Nginx (SSL) → Gateway Stage 2 Nginx        │
│ - Nginx routes FQDN to container VPN IP:8443          │
│ - Auth Guard authenticates, proxies to ttyd:7681      │
│ - ttyd web terminal loads in browser                  │
└──────────────────────────────────────────────────────┘
```

---

## DNS and Routing

**DNS is wildcard-based** - no dynamic DNS registration needed.

- CoreDNS serves zone files with `* IN A 127.0.0.1` wildcard records
- ANY subdomain like `uc-abc.org-def.apollo.local` resolves to `127.0.0.1`
- **Routing is handled by Nginx**, not DNS:
  - Stage 1 Nginx (dev container): SSL termination, routes `*.domain.local` to gateway containers
  - Stage 2 Nginx (gateway container): Routes specific FQDNs to container VPN IPs

**Reference:** `doc/guides/DNS_COMPLETE_GUIDE.md`

---

## Docker Image: Ubuntu Terminal

**Location:** `packages/modules/user-containers/docker-images/ubuntu/`

**Dockerfile** - Already exists and is complete:

- Base: `ubuntu:24.04`
- Packages: tini, jq, curl, openvpn, iputils-ping, pciutils, ttyd
- Copies `container-functions.sh` (shared bootstrap)
- Copies `container-entrypoint.sh` (image-specific)
- Entrypoint: `tini -g -- container-entrypoint.sh`

**container-entrypoint.sh** - Already exists and is complete:

1. Sources container-functions.sh (extracts SETTINGS, defines VPN/watchdog functions)
2. Starts VPN + watchdog loop in background
3. Starts Auth Guard Proxy binary (from bootstrap-tools image) on port 8443
4. Starts `ttyd -p 7681 /bin/bash` in background
5. Maps HTTP service `terminal:7681` to gateway
6. `tail -f /dev/null` to keep container running

The auth guard binary is included in the base bootstrap-tools image and started by `container-entrypoint.sh`.

**container-functions.sh** (`packages/modules/user-containers/docker-images/base/`) - Already exists and is complete:

- `extract_settings()` - Parses base64 SETTINGS env var into: TOKEN, GATEWAY_FQDN, PROJECT_ID, USER_CONTAINER_ID, etc.
- `start_vpn()` - Fetches VPN config from gateway (requires `org:{org_id}:connect-vpn` scope), starts OpenVPN
- `watchdog()` - Sends system stats via POST to gateway (includes `project_id` in payload)
- `vpn_loop()` - Maintains VPN connection, sends watchdog every 15s
- `map_http_service()` - Registers HTTP service with gateway via POST (includes `project_id` in payload)

**Image needs to be built:** `holistixforge/ubuntu-terminal:24.04` must exist locally.

---

## Runner System

The runner architecture supports pluggable execution backends. The "Local" runner is the simplest.

### Local Runner - Design Intent

The Local runner is a **display-only runner**. It does NOT execute Docker commands. Instead:

1. Backend generates the `docker run` command with all settings (JWT, SETTINGS env var, capabilities)
2. The command is stored in shared state so the frontend can display it
3. Frontend shows the command in a copy-paste-ready format
4. User runs the command themselves on any Docker host

### Key Files

| File                        | Purpose                                      | Status                            |
| --------------------------- | -------------------------------------------- | --------------------------------- |
| `runner.ts`                 | Abstract base class with `generateCommand()` | Done                              |
| `local-runner.ts`           | Backend: `LocalRunnerBackend.start()`        | Stub - needs implementation       |
| `local-runner-frontend.tsx` | Frontend: icon + UI component                | Minimal - needs command display   |
| `server-card.tsx`           | Container card with runner selection         | Done - needs command display area |
| `node-server.tsx`           | Whiteboard node wrapping server-card         | Done                              |

### `generateCommand()` (runner.ts) - Already Implemented

Produces a command like:

```bash
docker run --restart unless-stopped \
  --name holistix_MyUbuntu_uc_ab12 \
  -e SETTINGS=<base64_encoded_json> \
  --cap-add=NET_ADMIN \
  --device /dev/net/tun \
  holistixforge/ubuntu-terminal:24.04
```

The SETTINGS JSON contains: user_id, frontend_fqdn, ganymede_fqdn, gateway_fqdn, token (JWT), project_id, user_container_id, auth_guard.

---

## Implementation Status

### Done

- [x] Image registry with `getAll()` for listing images
- [x] `project:init` handler syncs images to per-project shared map
- [x] Frontend "New Container" dialog with image dropdown
- [x] Backend reducer: create, delete, watchdog, map-http-service, set-runner, start, periodic
- [x] Container card UI with status LED, runner selection, settings menu
- [x] `generateCommand()` in runner base class
- [x] Docker image definition (Dockerfile + entrypoint + bootstrap scripts)
- [x] Image registered in backend registry (`ubuntu:terminal`)
- [x] DNS wildcard setup (CoreDNS zone files)
- [x] Gateway nginx update script (`update-nginx-locations.sh`)
- [x] Permission system (container:create, container:delete, terminal)
- [x] Auth Guard Proxy for container authentication
- [x] Event types for all container lifecycle events
- [x] Auth Guard Proxy binary (Go)
- [x] Per-container OAuth client registration via Ganymede
- [x] Gateway verify-access endpoint
- [x] Legacy Protected Services removal
- [x] Legacy Gateway OAuth removal

### TODO

- [x] **Build Docker image** - `holistixforge/ubuntu-terminal:24.04` built and available locally
- [x] **Implement `LocalRunnerBackend.start()`** - Generates the docker command and stores it in shared state (in `runner` field of `TUserContainer`). Does NOT execute the command.
- [x] **Frontend command display** - After clicking "Local" runner, the container card shows the docker run command in a copyable text area with "Copy" button
- [x] **Store command in shared state** - The `runner` field on `TUserContainer` holds `{ id: 'local', command: '...' }`. The `_start()` reducer saves this.
- [x] **Centralized token generation** - User container tokens (`TJwtUserContainer`) are now signed by Ganymede, not the gateway. Gateway calls `POST /gateway/tokens/user-container` to request tokens.
- [ ] **Verify VPN flow** - Container connects to gateway VPN, gets IP, watchdog works
- [ ] **Verify nginx routing** - After container maps HTTP service, gateway nginx routes FQDN to VPN IP
- [ ] **End-to-end test** - Create container via UI, copy command, run it, verify terminal accessible

---

## Key Design Decisions

1. **Local runner = display command only.** The user copy-pastes and runs the container themselves. This is the simplest runner and doesn't require Docker socket access from the gateway.

2. **DNS is static wildcard.** No dynamic DNS registration needed. CoreDNS zone files have `* IN A 127.0.0.1`. All routing differentiation happens at the Nginx layer via `server_name` matching.

3. **Container communication via VPN.** Containers connect to gateway OpenVPN, get a VPN IP (172.16.x.x), and communicate with the gateway over the VPN tunnel. The gateway's Stage 2 Nginx routes external FQDNs to VPN IPs.

4. **Shared state, not database.** Container metadata lives in the collab shared state (Yjs), not in PostgreSQL. This enables real-time sync between frontend and backend.

5. **Runner field is extensible.** `TUserContainer.runner` is `{ id: string } & TJsonObject`, allowing runners to store arbitrary data (like the docker command for the local runner).

6. **Centralized token signing (Ganymede).** User container tokens (`TJwtUserContainer`) are signed exclusively by Ganymede. The gateway does NOT have the JWT private key - it only has the public key for verification. When the gateway needs a token for a container, it calls `POST /gateway/tokens/user-container` on Ganymede. This improves security by centralizing secret management.

7. **Auth Guard Proxy for container auth.** A compiled Go binary runs inside every container as the sole network entry point. It authenticates via OAuth with Ganymede, checks permissions with the gateway, and reverse-proxies to backend services. This replaces the old Protected Services pattern and per-service OAuth configuration.

---

## Token Generation Architecture

### Overview

User container hosting tokens (`user_container_token`) are JWT tokens that allow containers to authenticate with the gateway. These tokens are **signed by Ganymede** (the only service with the JWT private key).

### Flow

```
┌──────────────────────────────────────────────────────┐
│ User clicks "Local" runner on container card          │
└──────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────┐
│ Frontend dispatches: user-container:set-runner        │
│ + user-container:start events                         │
└──────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────┐
│ Gateway Reducer: _start()                             │
│ 1. Calls tokenManager.generateProjectScopedToken()    │
│    (internally calls Ganymede: POST /gateway/tokens/scoped)
│    Body: { type, project_id, claims }                 │
│    Auth: TJwtOrganization (gateway's org token)       │
│ 2. Receives signed JWT token from Ganymede            │
│ 3. Calls runner.start(container, hostingToken)        │
└──────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────┐
│ LocalRunnerBackend.start()                            │
│ 1. Generates SETTINGS JSON with token                 │
│ 2. Creates docker run command                         │
│ 3. Stores command in shared state                     │
│ 4. Frontend displays copyable command                 │
└──────────────────────────────────────────────────────┘
```

### Why Centralized Token Signing?

- **Security**: JWT private key exists only in Ganymede, not in gateway containers
- **Auditability**: All token generation goes through a central point
- **Simplicity**: Gateway containers don't need secret management
- **Scalability**: Can add rate limiting, logging, and policy at Ganymede level

### Ganymede Endpoint

**`POST /gateway/tokens/scoped`** (Generic token signing service)

- **Authentication**: `TJwtOrganization` (organization token)
- **Request Body**:
  ```json
  {
    "project_id": "uuid",
    "payload": { ... }  // Any payload - Ganymede signs as-is
  }
  ```
- **Response**: `{ token: string }` (signed JWT with `project_id` + payload merged)
- **Validations** (Ganymede only validates ownership, not content):
  - `project_id` must be a valid UUID
  - Project must belong to the authenticated organization
- **Ganymede is agnostic** - it doesn't know about token types or payload structure

### TokenManager Abstraction

TokenManager is a dumb pipe - the caller (reducer) constructs the complete payload:

```typescript
// In reducer - caller defines the full payload structure:
const tokenManager = this.depsExports.gateway.tokenManager;
const organization_id = this.depsExports.gateway.organization_id;
const hostingToken = await tokenManager.generateProjectScopedToken(project_id, {
  type: 'user_container_token',
  user_container_id: containerId,
  // Scopes (space-separated, standard JWT format):
  // - project:${project_id}:access - for /collab/event access
  // - org:${organization_id}:connect-vpn - for /collab/vpn-config access
  scope: `project:${project_id}:access org:${organization_id}:connect-vpn`,
});
```

**Separation of concerns:**

- **Reducer**: Knows about token types, scopes, and claim structures
- **TokenManager**: Just passes payload to Ganymede (no business logic)
- **Ganymede**: Validates project ownership and signs (no knowledge of payload content)

### Token Scopes

Container tokens include two scopes (space-separated):

| Scope                                | Purpose                        | Checked By                          |
| ------------------------------------ | ------------------------------ | ----------------------------------- |
| `project:${project_id}:access`       | Access to `/collab/event`      | `requireProjectAccess()` middleware |
| `org:${organization_id}:connect-vpn` | Access to `/collab/vpn-config` | `requireScope()` middleware         |

**How `requireProjectAccess()` works:**

Access is granted if ANY of these conditions are met:

1. JWT has scope `project:{project_id}:access` (for container tokens)
2. User has permission `project:{project_id}:member` or `project:{project_id}:admin`
3. User has permission `org:admin` or `org:owner`

Container scripts send `project_id` in the request body for all events.

---

## File Reference

### Core Module

| File                                                                 | Description                                                 |
| -------------------------------------------------------------------- | ----------------------------------------------------------- |
| `packages/modules/user-containers/src/index.ts`                      | Module backend: registry, runners, permissions, shared data |
| `packages/modules/user-containers/src/frontend.ts`                   | Module frontend: node registration, runner UI               |
| `packages/modules/user-containers/src/lib/image-registry.ts`         | `ContainerImageRegistry` class                              |
| `packages/modules/user-containers/src/lib/servers-reducer.ts`        | All event handlers                                          |
| `packages/modules/user-containers/src/lib/servers-events.ts`         | Event type definitions                                      |
| `packages/modules/user-containers/src/lib/servers-types.ts`          | `TUserContainer`, `serviceUrl()`                            |
| `packages/modules/user-containers/src/lib/servers-shared-model.ts`   | Shared data type definitions                                |
| `packages/modules/user-containers/src/lib/runner.ts`                 | `ContainerRunner` abstract class                            |
| `packages/modules/user-containers/src/lib/local-runner.ts`           | `LocalRunnerBackend` (stub)                                 |
| `packages/modules/user-containers/src/lib/local-runner-frontend.tsx` | Local runner frontend UI                                    |

### Frontend Components

| File                                             | Description                               |
| ------------------------------------------------ | ----------------------------------------- |
| `src/lib/components/node-server/node-server.tsx` | Whiteboard node component                 |
| `src/lib/components/server-card.tsx`             | Container card with status, runners, menu |
| `src/lib/components/status-led.tsx`              | Status LED indicator                      |
| `src/lib/form/new-server.tsx`                    | "New Container" dialog form               |

### Docker Images

| File                                                                            | Description                            |
| ------------------------------------------------------------------------------- | -------------------------------------- |
| `packages/modules/user-containers/docker-images/ubuntu/Dockerfile`              | Ubuntu terminal image                  |
| `packages/modules/user-containers/docker-images/ubuntu/container-entrypoint.sh` | Image entrypoint                       |
| `packages/modules/user-containers/docker-images/base/container-functions.sh`    | Shared bootstrap (VPN, watchdog, etc.) |

### Auth Guard Proxy

| File                                                  | Description                            |
| ----------------------------------------------------- | -------------------------------------- |
| `packages/modules/user-containers/auth-guard/`        | Auth Guard Proxy Go binary             |
| `packages/app-gateway/src/routes/container-access.ts` | Container access verification endpoint |

### Infrastructure

| File                                                                     | Description        |
| ------------------------------------------------------------------------ | ------------------ |
| `docker-images/backend-images/gateway/app/bin/update-nginx-locations.sh` | Nginx FQDN routing |
| `docker-images/backend-images/gateway/app/lib/start-vpn.sh`              | Gateway VPN server |
| `doc/guides/DNS_COMPLETE_GUIDE.md`                                       | DNS architecture   |
