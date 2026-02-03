# Gateway Architecture

---

## Overview

Holistix Forge uses a **pool-based multi-gateway architecture** where gateway containers are dynamically allocated to organizations on-demand.

> **Related Documentation:**
>
> - [Gateway Container](../../docker-images/backend-images/gateway/README.md) - Shell scripts that manage OpenVPN, Nginx, and container lifecycle
> - [App-Gateway README](../../packages/app-gateway/README.md) - Node.js application that orchestrates gateway scripts

**Key Principles:**

- **Production Parity** - Dev environment mirrors production (same containers, same scripts, only SSL differs)
- **Stateless Gateways** - All data stored centrally in Ganymede (gateways are disposable)
- **Dynamic Allocation** - Gateways allocated from pool when needed, auto-shutdown after 30min idle
- **Per-Project Cleanup** - Idle projects cleaned up after 5min (gateway continues serving active projects)
- **Automated Infrastructure** - DNS and Nginx managed programmatically (no manual config)
- **Hot-Reload** - Code changes reload all gateways without rebuild
- **Organization-Specific VPN** - Each organization gets its own VPN instance with unique certificates

**Architectural Decisions:**

- **Clean Separation of Concerns** - Each manager (PermissionManager, OAuthManager, TokenManager) is responsible for its own domain logic and uses GatewayState as a generic persistence coordinator
- **Role-Based Access Control (RBAC)** - Full RBAC system with Users → Roles → Permissions model. Supports wildcard matching, org-level and project-level roles, system roles (immutable), and custom roles. See [PERMISSION_SYSTEM.md](./PERMISSION_SYSTEM.md) for details.
- **Lazy Project Initialization** - Project rooms are initialized on-demand when first accessed (WebSocket connection or API call), not at gateway startup. Improves startup performance.
- **Default Role Assignment** - Organization members automatically receive default RBAC roles during gateway initialization based on their Ganymede membership (owner → org:owner, admin → org:admin).
- **One Gateway = One Organization** - A gateway manages ALL projects within an organization, sharing VPN network and permission system
- **Separate YJS State Per Project** - Each project has its own YJS room with isolated state files, allowing concurrent multi-project collaboration

---

## Architecture Diagram

📊 **Complete System Architecture Diagram**

See: [../architecture/SYSTEM_ARCHITECTURE.md](../architecture/SYSTEM_ARCHITECTURE.md)

---

## Domain Structure

All domains resolved via CoreDNS with wildcard DNS (no dynamic registration needed):

- **Frontend:** `domain.local` (or custom: `whatever.mycompany.local`)
- **Ganymede API:** `ganymede.domain.local`
- **Gateways:** `org-{organization-uuid}.domain.local` (wildcard match)
- **User Containers:** `uc-{container-uuid}.org-{org-uuid}.domain.local` (wildcard match)

**DNS:** Wildcard record (`*.domain.local → 127.0.0.1`) automatically resolves all subdomains.  
**SSL:** Single wildcard certificate (`*.domain.local`) handles all subdomains.  
**Routing:** Nginx `server_name` matching provides the routing layer.

---

## Two-Stage Nginx Routing

### Stage 1: Main Dev Container Nginx

- **Purpose:** SSL termination and service routing
- **SSL:** Terminates all HTTPS (wildcard `*.domain.local` cert)
- **Routes:**
  - `domain.local` → Frontend (static files)
  - `ganymede.domain.local` → Ganymede HTTP :6000
  - `org-{uuid}.domain.local` → Gateway HTTP :7100-7199 (plain HTTP, no SSL)
  - `*.org-{uuid}.domain.local` → Same gateway (for user containers)

### Stage 2: Gateway Container Nginx

- **Purpose:** Route traffic to app-gateway and user containers
- **Protocol:** Plain HTTP (SSL already terminated by Stage 1)
- **Server blocks:**
  - Wildcard on gateway HTTP port → app-gateway :8888 (accepts all org-{uuid}.domain.local)
  - VPN IP (172.16.0.1) → app-gateway :8888 (used by containers over VPN)
  - Each user container FQDN (uc-{uuid}.org-{uuid}.domain.local) → container VPN IP:port (dynamic)

**Why 2 stages?** Stage 1 doesn't know user container VPN IPs (managed inside gateway). Stage 2 nginx is inside gateway and routes to VPN IPs directly.

**Why wildcard?** Stage 1 already routed org-{uuid}.domain.local to this specific gateway port. Only one gateway listens on each port, so no server_name filtering needed.

**Path routing:** /collab, /svc, /oauth, /permissions are Express routes inside app-gateway.

---

## DNS Architecture

### Wildcard DNS Approach

**No dynamic DNS management needed!** With wildcard DNS (`*.domain.local → 127.0.0.1`), all subdomains automatically resolve.

**DNS Setup:**

- **CoreDNS** serves zone files from `/etc/coredns/zones/`
- Each environment has a zone file: `/etc/coredns/zones/{domain}.zone`
- Zone file contains wildcard record: `* IN A 127.0.0.1`

**Example zone file:**

```dns
$ORIGIN domain.local.
$TTL 60

@           IN  A    127.0.0.1   ; Apex domain
ganymede    IN  A    127.0.0.1   ; Ganymede API
*           IN  A    127.0.0.1   ; Wildcard - ALL subdomains
```

**What this means:**

- `domain.local` → `127.0.0.1`
- `ganymede.domain.local` → `127.0.0.1`
- `org-abc123.domain.local` → `127.0.0.1` (wildcard match)
- `uc-xyz.org-abc123.domain.local` → `127.0.0.1` (wildcard match)

**Routing Layer:**

- DNS resolves all subdomains to same IP
- **Nginx `server_name` matching** provides the routing layer
- Only valid patterns (`org-{uuid}`, `uc-{uuid}`) are routed
- Invalid subdomains get 404 from Nginx

**Benefits:**

- ✅ No database for DNS
- ✅ No API for DNS management
- ✅ No dynamic registration/deregistration
- ✅ Simpler, faster, more maintainable

**See:** [DNS Complete Guide](../guides/DNS_COMPLETE_GUIDE.md) for detailed DNS architecture.

---

## Gateway Lifecycle

### 1. Pool Creation

```bash
# During create-env.sh
GATEWAY_POOL_SIZE=3 ./create-env.sh dev-001 domain.local
```

- Creates N gateway containers (`gw-pool-0`, `gw-pool-1`, ...)
- Registers in PostgreSQL with metadata (container_name, http_port, vpn_port, gateway_nginx_upstream)
- `gateway_nginx_upstream` stores the internal address Stage 1 Nginx uses to reach the gateway (e.g., `172.17.0.1:7100` for local dev)
- Generates TJwtGateway tokens via `app-ganymede-cmd`
- Containers start idle in `ready` state

### 2. Allocation (User Opens Project)

```
Frontend → POST /gateway/start → Ganymede:
  1. Query PostgreSQL for available gateway (ready=true), returns gateway_nginx_upstream
  2. DNS already resolved (wildcard DNS handles org-{uuid}.domain.local)
  3. Create Nginx config: route org-{uuid} to gateway_nginx_upstream address
  4. Reload Nginx (using nginx -s reload for reliability)
  5. Call gateway trigger: POST /collab/start (trigger config fetch)
```

### 3. Initialization

```
Gateway startup → fetchConfigFromGanymede() (using TJwtGateway):
  1. Query allocation by gateway_id
  2. If allocated:
     a. Receive org config (organization_id, gateway_id, organization_token, projects, members)
     b. Check VPN validity for organization
     c. Start/regenerate VPN with organization_id
     d. Initialize gateway for organization
  3. If not allocated:
     a. Stop any existing VPN
     b. Stay idle, wait for allocation

Gateway → initializeGatewayForOrganization():
  1. Create GatewayState instance
  2. Set organization context → Automatically pulls data from Ganymede
  3. Create manager instances (PermissionManager, OAuthManager, etc.)
  4. Initialize default RBAC roles and assign to members
  5. Register providers → Providers automatically load their data
  6. Store instances in GatewayInstances registry
  7. Start autosave (pushes to Ganymede every 5min)
  8. Start serving organization
```

### 4. Serving

- WebSocket connections from users
- Real-time collaboration (YJS CRDT)
- Container management
- Organization-specific OpenVPN for user containers
- **Periodic autosave** (every 5min) → pushes data to Ganymede

### 5. Resource Management (Idle Handling)

#### Per-Project Cleanup (After 5min Idle)

```
GatewayPeriodicTimer (every 5s):
  1. Emit periodic event for each active project
  2. GatewayReducer checks project activity timer
  3. If project idle for 5min:
     a. Save all data: POST /gateway/data/push
     b. Call ProjectRoomsManager.cleanupProject(project_id)
     c. Remove project from memory
  4. Gateway continues serving other active projects
```

**Benefit**: Efficient memory usage, inactive projects unloaded while gateway serves active ones

#### Gateway Auto-Shutdown (After 30min if ALL Idle)

```
GatewayShutdownTimer (every 30s):
  1. Check if ANY projects exist
  2. If NO projects for 30 minutes:
     a. Push final data: POST /gateway/data/push
     b. Notify Ganymede: POST /gateway/stop (deallocate, mark as available)
     c. Stop VPN (organization-specific VPN stopped)
     d. Call shutdownGateway()
     e. Process exits cleanly (exit code 0)
  3. Shell auto-restart loop detects exit
  4. New Node.js process starts
  5. Fetches config from Ganymede (finds no allocation)
  6. Gateway stays idle (no VPN), waits for next allocation
```

**Benefit**: Gateway resources freed when completely idle, auto-returns to pool

**Auto-Restart Mechanism**: Gateway Docker container never stops, but the Node.js process inside restarts automatically via `start-app-gateway.sh` infinite loop.

---

## VPN Management (Organization-Specific)

### Overview

VPN is **organization-specific** and managed dynamically by TypeScript based on gateway allocation:

- ✅ VPN starts when gateway is allocated to an organization
- ✅ VPN includes `organization_id` in configuration
- ✅ VPN regenerates when organization changes
- ✅ VPN stops when gateway is idle (security)
- ✅ Different certificates per organization (isolation)

### VPN Lifecycle

```
┌─────────────────────────────────────────────────────┐
│ Gateway Idle (No VPN)                               │
│ • No organization allocated                         │
│ • No VPN running                                    │
│ • Waiting for allocation                            │
└──────────────────┬──────────────────────────────────┘
                   │
        Allocated to Organization A
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│ VPN Started for Org A                               │
│ • startVpnAsync(organization_id)                    │
│ • Unique certificates generated                     │
│ • Config: /tmp/vpn-config.json                      │
└──────────────────┬──────────────────────────────────┘
                   │
        Org change OR 30min idle
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│ VPN Stopped                                         │
│ • stopVpn() cleans up all resources                │
│ • Removes config and temp directories               │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
            Idle OR New Organization
```

### VPN Configuration

**File**: `/tmp/vpn-config.json`

```json
{
  "organization_id": "9b886a5e-2541-45c6-b92e-c5152dc8ceec",
  "status": "ok",
  "pid": 12345,
  "temp_dir": "/tmp/ovpn-a1b2c3d4e5",
  "port": 40001,
  "hostname": "gw-pool-apollo-4",
  "certificates": {
    "clients.crt": "base64...",
    "clients.key": "base64...",
    "ca.crt": "base64...",
    "ta.key": "base64..."
  }
}
```

### VPN Manager

**File**: `packages/app-gateway/src/vpn/vpn-manager.ts`

**Functions:**

- `loadVpnConfig()` - Read VPN config from file
- `isVpnValidForOrg(vpn, org_id)` - Check if VPN is valid for organization
- `startVpnAsync(org_id)` - Start VPN with organization ID
- `stopVpn()` - Stop VPN and cleanup (calls shell script)

**Environment Requirements:**

- `GATEWAY_VPN_PORT` - From container environment (set by `docker run -e`)
- `ORGANIZATION_ID` - Passed explicitly by TypeScript

**Shell Scripts:**

- `docker-images/backend-images/gateway/app/lib/start-vpn.sh` - Setup OpenVPN server
- `docker-images/backend-images/gateway/app/lib/stop-vpn.sh` - Stop OpenVPN and cleanup

---

## Shell Script Integration

Gateway uses a **hybrid approach** where TypeScript orchestrates high-level logic while shell scripts handle low-level infrastructure.

### Script Patterns

#### Pattern 1: `runScript()` for JSON-Returning Scripts

**When to use:**

- Scripts in `bin/` directory
- Return JSON to stdout: `{"status": "ok"}` or `{"status": "error", "error": "..."}`
- Called via `main.sh` wrapper

**Example:**

```typescript
runScript('update-nginx-locations', inputString);
// Calls: /opt/gateway/app/main.sh -r bin/update-nginx-locations.sh
```

#### Pattern 2: Direct `spawnSync()` for Infrastructure Scripts

**When to use:**

- Scripts in `lib/` directory
- Write output to files (not stdout)
- Start daemon processes
- Need custom environment variables

**Example:**

```typescript
// VPN Scripts
spawnSync('/opt/gateway/app/lib/start-vpn.sh', [], {
  env: { ...process.env, ORGANIZATION_ID: organization_id },
  stdio: 'pipe',
  timeout: 60000,
});
```

### Script Responsibilities

| Script                      | Pattern              | Purpose                      |
| --------------------------- | -------------------- | ---------------------------- |
| `update-nginx-locations.sh` | `runScript()`        | Update user container routes |
| `reset-gateway.sh`          | `runScript()`        | Full infrastructure reset    |
| `start-vpn.sh`              | Direct `spawnSync()` | Start org-specific VPN       |
| `stop-vpn.sh`               | Direct `spawnSync()` | Stop VPN and cleanup         |
| `start-app-gateway.sh`      | Auto-restart loop    | Keep Node.js running         |

---

## Auto-Shutdown and Restart Flow

### Complete Flow

```
1. TypeScript: 30min idle detected
   └─ GatewayShutdownTimer triggers shutdownGateway()

2. TypeScript: Graceful shutdown
   └─ Stop timers, save state to Ganymede
   └─ POST /gateway/stop (notify Ganymede)
   └─ Stop VPN (stopVpn())
   └─ process.exit(0)

3. Shell: Auto-restart loop
   └─ start-app-gateway.sh detects exit
   └─ Sleep 3 seconds
   └─ Restart: node main.js

4. TypeScript: Fetch config on startup
   └─ fetchConfigFromGanymede() using TJwtGateway

5. Ganymede: Check allocation
   └─ Returns config if allocated
   └─ Returns 404 if not allocated

6. TypeScript: Initialize or stay idle
   └─ If allocated: Start VPN, initialize gateway
   └─ If idle: Stop VPN, wait for allocation
```

### Auto-Restart Script

**File**: `docker-images/backend-images/gateway/app/lib/start-app-gateway.sh`

```bash
while true; do
    # Start Node.js (blocks until exit)
    node main.js > /tmp/gateway.log 2>&1
    EXIT_CODE=$?

    # Check for marker files
    if [ -f /tmp/gateway-reloading ]; then
        # Graceful reload
        continue
    fi

    if [ -f /tmp/gateway-resetting ]; then
        # Full reset
        exit 0
    fi

    # No markers → auto-shutdown or crash
    echo "⚠️  app-gateway exited with code: $EXIT_CODE"
    echo "   Restarting in 3 seconds..."
    sleep 3
done
```

**Key Points:**

- Container never stops, only Node.js process restarts
- Infinite loop ensures gateway always runs
- Marker files signal intentional operations
- 3-second delay prevents rapid restart loops

---

## Deployment Workflow

### When Gateway Code Changes

**Correct workflow when updating gateway code and testing:**

```bash
# 1. Build all packages (includes gateway)
npx nx run-many -t build

# 2. Package gateway build
./scripts/local-dev/pack-gateway-build.sh <env-name>

# 3. Restart environment (triggers gateway refetch and restart)
./scripts/local-dev/envctl.sh restart <env-name>
```

**What happens:**

1. `envctl.sh restart` → Ganymede container restarts
2. Ganymede serves new gateway build via HTTP
3. Each gateway container fetches new build
4. Gateway Node.js processes restart with new code
5. All gateways re-initialize and resume serving

**Important:**

- ❌ `npx nx build app-gateway` alone is NOT enough
- ✅ Must package build and trigger environment restart
- ✅ No Docker image rebuild needed for code changes

### Manual Gateway Reload

```bash
# Reload all gateways in environment
./scripts/local-dev/envctl.sh restart <env-name> gateway

# Or reload single gateway directly
docker exec gw-pool-<env>-<N> /opt/gateway/app/lib/reload-gateway.sh
```

---

## JWT Token Types

### TJwtGateway (Startup Token)

- **Generated:** During pool creation (`app-ganymede-cmd add-gateway`)
- **Payload:** `{ type: 'gateway_token', gateway_id, scope }`
- **Used for:** `/gateway/config` (fetch allocation info), `/gateway/ready` (signal ready)
- **Lifetime:** 1 year

### TJwtOrganization (Allocation Token)

- **Generated:** During config fetch (`/gateway/config`)
- **Payload:** `{ type: 'organization_token', organization_id, gateway_id, scope }`
- **Used for:** `/gateway/data/push`, `/gateway/data/pull`, `/gateway/stop`
- **Lifetime:** 1 year (while allocation exists)

**Why separate?** Gateway can be ready without being allocated. Different scopes for different operations.

### Gateway Authentication and Permissions

Permissions are managed by PermissionManager, maintaining fine-grain permissions for all users with RBAC (Role-Based Access Control).

The gateway also uses **scope-based authorization** with template variable substitution:

- **Generic JWT handling:** `authenticateJwt` middleware accepts any JWT type
- **Scope-based authorization:** `requireScope()` middleware checks for required scopes
- **Template variables:** Scopes can include `{org_id}`, `${params.key}`, `${body.key}`, `${query.key}`, `${jwt.key}`
- **Organization-scoped endpoints:** VPN config requires `org:{org_id}:connect-vpn` scope (resolved at runtime)

---

## Gateway Initialization and Persistence

### Overview

The gateway uses a **registry-based persistence pattern** where managers implement the `IPersistenceProvider` interface and register themselves with `GatewayState`. All data is stored centrally in Ganymede with automatic synchronization.

**Key Principles:**

- ✅ **Stateless Gateways** - No local file storage, all data in Ganymede
- ✅ **Provider Pattern** - Managers register and provide their own persistence
- ✅ **Automatic Sync** - Data pulled on initialization, pushed periodically
- ✅ **Instance-Based** - No singletons, all instances created per organization

### Initialization Flow

**Initialization:**

Gateway always fetches config from Ganymede at startup using TJwtGateway. This happens:

1. **Automatically** - On gateway startup (hot restart)
2. **On trigger** - When Ganymede calls `/collab/start` after allocation

**Initialization Steps:**

1. Create `GatewayState` instance and initialize with org/gateway IDs
2. Set organization context → Automatically pulls data from Ganymede
3. Create manager instances (RoleManager, UserRoleManager, PermissionManager, OAuthManager, etc.)
4. Initialize default RBAC roles (org:owner, org:admin) and assign to organization members
5. Register providers with `GatewayState` → Providers automatically load their data
6. Load backend modules (collab, reducers, gateway, user-containers, etc.)
7. Store instances in `GatewayInstances` registry
8. Start autosave → `GatewayState` pushes data to Ganymede every 5 minutes
9. Start VPN with organization_id (if allocated)
10. Initialize WebSocket handler (projects initialized lazily on first access)

**Note:** Projects are **not** initialized at startup. Project rooms are created on-demand when:

- A WebSocket connection attempts to access the project
- An API endpoint requires the project data

This improves gateway startup performance and reduces memory usage for inactive projects.

### Data Flow

#### Pull Flow (Initialization)

When a gateway is allocated to an organization:

1. `GatewayState.setOrganizationContext(org_id, gateway_id, token)` is called
2. `GatewayState` calls `pullDataFromGanymede()` internally
3. Data snapshot fetched from Ganymede via `POST /gateway/data/pull`
4. Data cached internally in `GatewayState`
5. When providers register via `register(id, provider)`, they automatically receive their data slice
6. Each provider's `restoreData(data)` method is called with its slice

**Result**: All managers have their persisted data loaded from Ganymede snapshot.

#### Push Flow (Autosave/Shutdown)

Periodically (every 5 minutes) and on shutdown:

1. `GatewayState` calls `collectData()` on all registered providers
2. Each provider's `collectData()` method returns its current state
3. `GatewayState` aggregates all data into a single object
4. Data pushed to Ganymede via `POST /gateway/data/push`
5. Ganymede saves snapshot to `/root/.local-dev/{env}/org-data/{org-uuid}.json`

**Result**: All manager state synchronized to Ganymede (gateway crash-safe).

#### Automatic Triggers

**Periodic Autosave** (every 5 minutes):

- `GatewayState.startAutosave()` called during initialization
- Interval timer pushes data to Ganymede
- Non-blocking (continues serving requests)
- Logs errors but doesn't crash

**Shutdown Push** (on SIGTERM/SIGINT/exit):

- `GatewayState.shutdown()` called
- Stops autosave timer
- Pushes final data snapshot
- Ensures no data loss on graceful shutdown

### Core Architecture Components

#### GatewayState

**Purpose**: Central registry and coordinator for all persistence providers, handles Ganymede synchronization.

**Key Methods**:

- `register(id, provider)` - Register provider and auto-load its data
- `collectData()` - Aggregate data from all providers
- `restoreData(data)` - Restore data to all registered providers
- `pullDataFromGanymede()` - Pull org data from Ganymede
- `pushDataToGanymede()` - Push org data to Ganymede
- `setOrganizationContext(org_id, gateway_id, token)` - Set context and pull data
- `startAutosave()` - Start periodic push (every 5min)
- `shutdown()` - Stop autosave and push final data

#### IPersistenceProvider Interface

**Purpose**: Interface implemented by all managers that need persistence.

**Required Methods**:

```typescript
interface IPersistenceProvider {
  collectData(): any; // Return data to be saved
  restoreData(data: any): void; // Load data from snapshot
}
```

**Providers** register with `GatewayState`, which automatically:

- Loads their data on initialization
- Collects their data during autosave/shutdown
- Synchronizes with Ganymede

#### GatewayInstances Registry

**Purpose**: Central registry storing all gateway instances for route access.

**Stored Instances**:

- `gatewayState` - GatewayState instance
- `roleManager` - RoleManager instance
- `userRoleManager` - UserRoleManager instance
- `permissionManager` - PermissionManager instance
- `oauthManager` - OAuthManager instance
- `tokenManager` - TokenManager instance
- `projectRoomsManager` - ProjectRoomsManager instance
- `permissionRegistry` - PermissionRegistry instance
- `protectedServiceRegistry` - ProtectedServiceRegistry instance

**Usage**: Routes access instances via `getGatewayInstances()` to avoid singletons.

### Manager Responsibilities

#### RoleManager

Manages role definitions with persistence.

- CRUD operations for roles
- System roles (org:owner, org:admin, project:owner)
- Custom role creation
- Implements `IPersistenceProvider`

#### UserRoleManager

Manages user-role assignments with persistence.

- Assign/revoke roles at org and project levels
- Query user roles by scope
- Support role inheritance (org roles → project roles)
- Implements `IPersistenceProvider`

#### PermissionManager

Implements RBAC permission checking (read-only, no persistence).

- Resolve user permissions via role resolution
- Check permissions: `hasPermission(user_id, permission, scope?)`
- Permission expansion from roles
- Fine-grained permission strings

#### OAuthManager

Manages OAuth clients, codes, tokens for container apps.

- Create/delete OAuth clients
- Generate authorization codes
- Exchange codes for tokens
- Token validation
- Implements `IPersistenceProvider`

#### TokenManager

Handles JWT token verification for container authentication (no persistence).

- Validates `TJwtUserContainer` tokens (signed by Ganymede)
- Token verification using public key
- **Note**: User container tokens are now generated by Ganymede via `POST /gateway/tokens/user-container`, not by the gateway. The gateway only verifies tokens using the public key.

#### ProjectRoomsManager

Manages YJS collaboration rooms with persistence.

- One room per project (lazy initialization)
- Store YJS snapshots
- Handle collaborative events
- Cleanup idle projects
- Implements `IPersistenceProvider`

#### PermissionRegistry

Registry of permission definitions registered by modules (no persistence).

- Modules register permissions during load
- Permission validation
- Permission listing via `/permissions` endpoints
- Used for UI permission management

#### ProtectedServiceRegistry

Registry of generic "protected services" registered by modules (no persistence).

- Modules register custom services
- Route matching: `/svc/{serviceId}`
- Middleware injection
- Dynamic service resolution

### Centralized Storage (Stateless Gateways)

**Gateway stores NO persistent data locally.** All data pushed to Ganymede:

**Location:** `/root/.local-dev/{env}/org-data/{org-uuid}.json`

**Format:**

```json
{
  "organization_id": "uuid",
  "gateway_id": "uuid",
  "timestamp": "2025-11-12T10:30:00Z",
  "stored_at": "2025-11-12T10:30:01Z",
  "data": {
    "organization_id": "uuid",
    "gateway_id": "uuid",
    "saved_at": "2025-11-12T10:30:00Z",
    "roles": { ... },
    "user_roles": { ... },
    "permissions": { ... },
    "oauth": { ... },
    "containers": { ... },
    "projects": {
      "project-uuid-1": { /* YJS snapshot */ },
      "project-uuid-2": { /* YJS snapshot */ }
    }
  }
}
```

**Benefits:**

- ✅ No data leakage between orgs
- ✅ Gateway crash-safe
- ✅ Same gateway serves multiple orgs sequentially
- ✅ Centralized backup
- ✅ Automatic synchronization

---

## Key Components

### Database (PostgreSQL)

**Tables:**

- `gateways` - Pool registry (container_name, http_port, vpn_port, gateway_nginx_upstream, ready flag)
- `organizations_gateways` - Active allocations (org_id, gateway_id, started_at, ended_at)

**Procedures:**

- `proc_gateway_new(version, container_name, http_port, vpn_port, gateway_nginx_upstream)` - Add to pool
- `proc_organizations_start_gateway(org_id)` - Allocate gateway, returns metadata
- `proc_organizations_gateways_stop(gateway_id)` - Deallocate, mark ready
- `func_organizations_get_active_gateway(org_id)` - Check if org has gateway
- `func_organizations_get_allocation_by_gateway_id(gateway_id)` - Get allocation by gateway ID

### API Endpoints

**Ganymede:**

- `POST /gateway/start` (user auth) - Allocate gateway, configure Nginx, trigger init
- `POST /gateway/config` (TJwtGateway) - Fetch org config and organization token
- `POST /gateway/ready` (TJwtGateway) - Gateway signals ready to be allocated
- `POST /gateway/stop` (TJwtOrganization) - Deallocate, cleanup Nginx, mark as available
- `POST /gateway/data/push` (TJwtOrganization) - Save org data snapshot
- `POST /gateway/data/pull` (TJwtOrganization) - Load org data snapshot

**Gateway:**

- `POST /collab/start` (public trigger) - Trigger config fetch and initialization
- `GET /collab/ping` - Health check
- `POST /collab/event` (TJwtUser or TJwtUserContainer) - Process collaborative events
- `GET /collab/room-id` (TJwtUser with project access) - Get YJS room ID for project
- `GET /collab/vpn-config` (JWT with `org:{org_id}:connect-vpn` scope) - Get OpenVPN config
- `GET /permissions` (TJwtUser) - List all permissions
- `GET /permissions/projects/{id}` (TJwtUser) - Get project user permissions
- `PATCH /permissions/projects/{id}/users/{id}` (TJwtUser) - Update user permissions
- `GET /oauth/authorize` (TJwtUser) - OAuth authorization for container apps
- `POST /oauth/token` - OAuth token exchange
- `POST /oauth/authenticate` (OAuth Bearer token) - Validate OAuth token
- `ALL /svc/{serviceId}` (TJwtUser usually) - Module-defined protected service

---

## Development vs Production

| Aspect         | Development          | Production              |
| -------------- | -------------------- | ----------------------- |
| **Domain**     | `domain.local`       | `your-domain.com`       |
| **SSL**        | mkcert wildcard      | Let's Encrypt wildcard  |
| **DNS**        | CoreDNS (zone files) | CoreDNS (zone files)    |
| **Containers** | Docker (same host)   | Docker (same/multi-VPS) |
| **Scripts**    | `setup-all.sh`       | **Same scripts!**       |
| **Workflow**   | Hot-reload enabled   | Hot-reload enabled      |

**Production deployment:**

```bash
export ENV_NAME="prod" DOMAIN="your-domain.com" GATEWAY_POOL_SIZE=10
./scripts/local-dev/setup-all.sh
./scripts/local-dev/create-env.sh ${ENV_NAME} ${DOMAIN}
# Update nginx SSL to Let's Encrypt certs
./scripts/local-dev/envctl.sh start ${ENV_NAME}
```

---

## Database Schema

### gateways table

```sql
CREATE TABLE gateways (
    gateway_id uuid PRIMARY KEY,
    hostname varchar(256) NOT NULL,
    version varchar(15) NOT NULL,
    ready boolean NOT NULL DEFAULT false,
    container_name varchar(100),
    http_port integer,
    vpn_port integer,
    gateway_nginx_upstream varchar(255),
    UNIQUE (container_name)
);
```

### organizations_gateways table

```sql
CREATE TABLE organizations_gateways (
    organization_id uuid NOT NULL,
    gateway_id uuid NOT NULL,
    started_at timestamp NOT NULL DEFAULT now(),
    ended_at timestamp,
    PRIMARY KEY (organization_id, gateway_id, started_at)
);

CREATE INDEX idx_organizations_gateways_active
  ON organizations_gateways (organization_id, gateway_id)
  WHERE ended_at IS NULL;
```

---

## Common Operations

### Check Gateway Pool Status

```bash
# Via Docker
docker ps --filter label=environment=dev-001

# Via PostgreSQL
PGPASSWORD=devpassword psql -U postgres -d ganymede_dev_001 -c \
  "SELECT gateway_id, ready, container_name, http_port FROM gateways;"
```

### Check Active Allocations

```bash
PGPASSWORD=devpassword psql -U postgres -d ganymede_dev_001 -c "
  SELECT
    o.name as org_name,
    g.container_name,
    g.http_port,
    og.started_at,
    now() - og.started_at as duration
  FROM organizations_gateways og
  JOIN gateways g ON og.gateway_id = g.gateway_id
  JOIN organizations o ON og.organization_id = o.organization_id
  WHERE og.ended_at IS NULL;
"
```

### Clear Gateway Allocation (Reset to Idle)

```bash
# When testing allocation/deallocation
PGPASSWORD=devpassword psql -U postgres -d ganymede_<env> -c \
  "DELETE FROM organizations_gateways;"
```

### Manually Trigger Gateway Reload

```bash
# Reload all gateways in environment (recommended)
./scripts/local-dev/envctl.sh restart dev-001 gateway

# Or reload single container directly
docker exec gw-pool-dev-001-0 /opt/gateway/app/lib/reload-gateway.sh
```

### Check VPN Status

```bash
# Check VPN config
docker exec gw-pool-dev-001-0 cat /tmp/vpn-config.json

# Check OpenVPN process
docker exec gw-pool-dev-001-0 ps aux | grep openvpn
```

---

## Known Limitations

**Main Gaps:**

1. No rollback on allocation failure
2. No gateway health checks before allocation
3. Hardcoded paths in some services

**Not Critical:** These don't block basic functionality, but should be addressed for production.

---

## Quick Reference

### Files by Category

**Scripts:**

- `scripts/local-dev/setup-coredns.sh`
- `scripts/local-dev/build-images.sh`
- `scripts/local-dev/gateway-pool.sh`
- `scripts/local-dev/create-env.sh`
- `scripts/local-dev/envctl.sh`
- `scripts/local-dev/pack-gateway-build.sh`

**Ganymede Services:**

- `packages/app-ganymede/src/services/nginx-manager.ts`
- `packages/app-ganymede/src/lib/url-helpers.ts`

**Ganymede Routes:**

- `packages/app-ganymede/src/routes/gateway/index.ts`
- `packages/app-ganymede/src/routes/gateway/data.ts`

**Gateway Services:**

- `packages/app-gateway/src/module/module.ts` - Gateway module and script execution
- `packages/app-gateway/src/vpn/vpn-manager.ts` - VPN lifecycle management
- `packages/app-gateway/src/initialization/fetch-config.ts` - Config fetching from Ganymede
- `packages/app-gateway/src/initialization/gateway-init.ts` - Gateway initialization and shutdown

**Database:**

- `database/schema/02-schema.sql`
- `database/procedures/proc_gateway_new.sql`
- `database/procedures/proc_organizations_start_gateway.sql`
- `database/procedures/proc_organizations_gateways_stop.sql`
- `database/procedures/func_organizations_get_active_gateway.sql`
- `database/procedures/func_organizations_get_allocation_by_gateway_id.sql`

**Docker:**

- `docker-images/backend-images/gateway/Dockerfile`
- `docker-images/backend-images/gateway/app/entrypoint-dev.sh`
- `docker-images/backend-images/gateway/app/bin/reset-gateway.sh`
- `docker-images/backend-images/gateway/app/lib/start-app-gateway.sh`
- `docker-images/backend-images/gateway/app/lib/start-vpn.sh`
- `docker-images/backend-images/gateway/app/lib/stop-vpn.sh`

**Rules:**

- `.cursor/rules/gateway-deployment-workflow.mdc` - Deployment workflow
- `.cursor/rules/database-access.mdc` - Database access guide

---

## Related Documentation

- [Gateway Container Scripts](../../docker-images/backend-images/gateway/README.md) - Shell scripts for OpenVPN, Nginx, and container lifecycle
- [App-Gateway](../../packages/app-gateway/README.md) - Node.js application
- [Protected Services](./PROTECTED_SERVICES.md) - Module-driven protected endpoints
- [Permission System](./PERMISSION_SYSTEM.md) - RBAC implementation details
- [System Architecture](./SYSTEM_ARCHITECTURE.md) - Complete system diagram
- [User Containers Module](../../packages/modules/user-containers/README.md) - Container management
