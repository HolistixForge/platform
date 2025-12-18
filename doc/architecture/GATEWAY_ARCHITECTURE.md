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
- **Dynamic Allocation** - Gateways allocated from pool when needed, returned after 5min idle
- **Automated Infrastructure** - DNS and Nginx managed programmatically (no manual config)
- **Hot-Reload** - Code changes reload all gateways without rebuild

**Architectural Decisions:**

- **Clean Separation of Concerns** - Each manager (PermissionManager, OAuthManager, TokenManager) is responsible for its own domain logic and uses GatewayState as a generic persistence coordinator
- **Simple Permissions (MVP)** - Permission system uses string arrays per user with exact matching (e.g., `["org:admin", "container:123:delete"]`). No hierarchy/wildcards in MVP, but designed to be extensible
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
- Registers in PostgreSQL with metadata (container_name, http_port, vpn_port)
- Generates TJwtGateway tokens via `app-ganymede-cmd`
- Containers start idle in `ready` state

### 2. Allocation (User Opens Project)

```
Frontend → POST /gateway/start → Ganymede:
  1. Query PostgreSQL for available gateway (ready=true)
  2. DNS already resolved (wildcard DNS handles org-{uuid}.domain.local)
  3. Create Nginx config: route org-{uuid} to gateway HTTP port
  4. Reload Nginx
  5. Call gateway handshake: POST /collab/start
```

### 3. Handshake

```
Gateway → POST /gateway/config → Ganymede:
  1. Exchange temp token for TJwtOrganization
  2. Receive org config (organization_id, gateway_id, organization_token)

Gateway → initializeGateway():
  3. Create GatewayState instance
  4. Set organization context → Automatically pulls data from Ganymede
  5. Create manager instances (PermissionManager, OAuthManager, etc.)
  6. Register providers → Providers automatically load their data from pulled snapshot
  7. Store instances in GatewayInstances registry
  8. Start autosave (pushes to Ganymede every 5min)
  9. Start serving organization
```

### 4. Serving

- WebSocket connections from users
- Real-time collaboration (YJS CRDT)
- Container management
- OpenVPN for user containers
- **Periodic autosave** (every 5min) → pushes data to Ganymede

### 5. Deallocation (After 5min Idle)

```
Gateway detects no activity:
  1. Push data: POST /gateway/data/push
  2. Call: POST /gateway/stop

Ganymede:
  3. Remove DNS records
  4. Remove Nginx config
  5. Reload Nginx
  6. Mark gateway ready in PostgreSQL

Gateway returns to pool, ready for next org.
```

---

## JWT Token Types

### TJwtGateway (Startup Token)

- **Generated:** During pool creation (`app-ganymede-cmd add-gateway`)
- **Payload:** `{ type: 'gateway_token', gateway_id, scope }`
- **Used for:** `/gateway/ready` (gateway signals ready after startup)
- **Lifetime:** 1 year

### TJwtOrganization (Allocation Token)

- **Generated:** During handshake (`/gateway/config`)
- **Payload:** `{ type: 'organization_token', organization_id, gateway_id, scope }`
- **Used for:** `/gateway/data/push`, `/gateway/data/pull`, `/gateway/stop`
- **Lifetime:** 1 year (while allocation exists)

**Why separate?** Gateway can be ready without being allocated. Different scopes for different operations.

### Gateway Authentication and permissions check

Permissions are Managed by PermissionManager, that maintains a set of string defined fined grain permission for all users.

#### Permission Registry System

The **PermissionRegistry** allows modules to register their permissions during module loading. Permissions are compiled and can be retrieved via gateway API endpoints.

**Permission Format:**

- Format: `{module}:[{resource-path}]:{action}`
- Resource path supports hierarchical resources: `{type}:{id|*}(/{type}:{id|*})*`
- Examples:
  - `user-containers:[user-container:*]:create`
  - `user-containers:[user-container:{uuid}/service:*]:create`
  - `gateway:[permissions:*]:read`

**How It Works:**

1. During gateway initialization, a `PermissionRegistry` instance is created
2. When modules are loaded, they can access the registry via `depsExports.gateway.permissionRegistry`
3. Modules register their permissions in their `load()` function
4. The registry validates permission format and stores definitions
5. Gateway API endpoints (`GET /permissions`, etc.) retrieve compiled permissions from the registry

**Example Module Registration:**

```typescript
// In user-containers module load() function
const permissionRegistry = depsExports.gateway.permissionRegistry;
permissionRegistry.register('user-containers:[user-container:*]:create', {
  resourcePath: 'user-container:*',
  action: 'create',
  description: 'Create user containers',
});
```

The gateway also uses **scope-based authorization** with template variable substitution:

- **Generic JWT handling:** `authenticateJwt` middleware accepts any JWT type (`TJwtUser`, `TJwtOrganization`, `TJwtGateway`)
- **Scope-based authorization:** `requireScope()` middleware checks for required scopes in JWT tokens
- **Template variables:** Scopes can include variables like `{org_id}`, `${params.key}`, `${body.key}`, `${query.key}`, `${jwt.key}`
- **Organization-scoped endpoints:** VPN config endpoint requires `org:{org_id}:connect-vpn` scope (resolved at runtime)

---

## Gateway Initialization and Persistence

### Overview

The gateway uses a **registry-based persistence pattern** where managers implement the `IPersistenceProvider` interface and register themselves with `GatewayState`. All data is stored centrally in Ganymede with automatic synchronization.

**Key Principles:**

- ✅ **Stateless Gateways** - No local file storage, all data in Ganymede
- ✅ **Provider Pattern** - Managers register and provide their own persistence
- ✅ **Automatic Sync** - Data pulled on initialization, pushed periodically
- ✅ **Instance-Based** - No singletons, all instances created per organization

### Architecture

**Key Components:**

1. **GatewayState** - Registry and coordinator for all persistence providers, handles Ganymede sync
2. **IPersistenceProvider** - Interface implemented by all managers that need persistence
3. **GatewayInstances** - Registry storing all gateway instances for route access
4. **Managers** - PermissionManager, OAuthManager, TokenManager, ProjectRoomsManager - each manages its own data

### Initialization Flow

**Two initialization paths:**

1. **Hot Restart** - Gateway app restarted, loads organization config from `/config/organization.json`
2. **Normal Allocation** - Gateway allocated via `/collab/start` endpoint

**Initialization Steps:**

1. Create `GatewayState` instance and initialize with org/gateway IDs
2. Set organization context → Automatically pulls data from Ganymede
3. Create manager instances (PermissionManager, OAuthManager, etc.)
4. Register providers with `GatewayState` → Providers automatically load their data from pulled snapshot
5. Store instances in `GatewayInstances` registry for route access
6. Start autosave → `GatewayState` pushes data to Ganymede every 5 minutes

### Data Flow

**Pull Flow (Initialization):**

- `GatewayState` pulls data snapshot from Ganymede
- Data cached internally
- When providers register, they automatically receive and load their data slice

**Push Flow (Autosave/Shutdown):**

- `GatewayState` collects data from all registered providers
- Aggregates into single object
- Pushes to Ganymede via `/gateway/data/push`

**Automatic Triggers:**

- Periodic autosave every 5 minutes
- Shutdown handlers (SIGTERM/SIGINT) push final data

### Responsibilities

**GatewayState:**

- Registry for persistence providers
- Data collection from providers
- Data restoration to providers
- Ganymede sync (push/pull)
- Periodic autosave
- Does NOT store data itself

**Managers:**

- Store their own data internally
- Implement `IPersistenceProvider` interface
- Initialize from serialized data
- Serialize their data for persistence

**Manager Responsibilities:**

- **PermissionManager** - Manages string-based permissions per user, exact matching (`hasPermission(user_id, permission)`), uses GatewayState for persistence
- **OAuthManager** - Manages OAuth clients, authorization codes, and tokens for container applications, implements OAuth2Server model interface
- **TokenManager** - Generates JWT tokens (`generateJWTToken()`), used for container authentication tokens
- **ProjectRoomsManager** - Manages multiple YJS rooms (one per project), handles per-project persistence and WebSocket routing

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
    "permissions": {
      "user-123": ["org:admin", "project:abc:member"]
    },
    "oauth": {
      "oauth_clients": {},
      "oauth_authorization_codes": {},
      "oauth_tokens": {}
    },
    "containers": {
      "container_tokens": {}
    },
    "projects": {
      "project-uuid-1": {
        /* YJS snapshot */
      },
      "project-uuid-2": {
        /* YJS snapshot */
      }
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

- `gateways` - Pool registry (container_name, http_port, vpn_port, ready flag)
- `organizations_gateways` - Active allocations (org_id, gateway_id, started_at, ended_at)

**Procedures:**

- `proc_gateway_new(hostname, version, container_name, http_port, vpn_port)` - Add to pool
- `proc_organizations_start_gateway(org_id)` - Allocate gateway, returns metadata
- `proc_organizations_gateways_stop(gateway_id)` - Deallocate, mark ready
- `func_organizations_get_active_gateway(org_id)` - Check if org has gateway

### Services (Ganymede)

**nginx-manager.ts:**

- `createGatewayConfig(org_id, http_port)` - Create `/etc/nginx/.../org-{uuid}.conf`
- `removeGatewayConfig(org_id)` - Delete config file
- `reloadNginx()` - Test + reload nginx

**url-helpers.ts:**

- `makeOrgGatewayHostname(org_id)` → `org-{uuid}.domain.local`
- `makeOrgGatewayUrl(org_id)` → `https://org-{uuid}.domain.local`
- `makeUserContainerHostname(container_id, org_id)` → `uc-{uuid}.org-{uuid}.domain.local`

### Services (Gateway)

**GatewayState (`state/GatewayState.ts`):**

- Registry for persistence providers
- `register(id, provider)` - Register provider and auto-load its data
- `collectData()` - Aggregate data from all providers
- `restoreData(data)` - Restore data to all registered providers
- `pullDataFromGanymede()` - Pull org data from Ganymede
- `pushDataToGanymede()` - Push org data to Ganymede
- `setOrganizationContext(org_id, gateway_id, token)` - Set context and pull data
- `startAutosave()` - Start periodic push (every 5min)
- `shutdown()` - Stop autosave and push final data

**Managers:**

- `PermissionManager` - Permissions with `IPersistenceProvider`
- `OAuthManager` - OAuth data with `IPersistenceProvider`
- `TokenManager` - Token management (JWT tokens) for container authentication
- `ProjectRoomsManager` - YJS rooms with `IPersistenceProvider`
- `PermissionRegistry` - Registry of permission definitions registered by modules (used by `/permissions` routes)
- `ProtectedServiceRegistry` - Registry of generic "protected services" registered by modules (used by `/svc/*` routes)

**Initialization (`initialization/gateway-init.ts`):**

- `initializeGateway(org_id, gateway_id, token)` - Creates all instances, pulls data, registers providers
- `shutdownGateway()` - Gracefully shutdown (gets instances from registry)
- `GatewayInstances` registry - Stores instances for route access (GatewayState, managers, PermissionRegistry, ProtectedServiceRegistry)

### API Endpoints

**Ganymede:**

- `POST /gateway/start` (user auth) - Allocate gateway, register DNS/Nginx, call handshake
- `POST /gateway/config` (temp handshake token) - Exchange for org token + config
- `POST /gateway/ready` (TJwtGateway) - Gateway signals ready to be allocated
- `POST /gateway/stop` (TJwtOrganization) - Deallocate, cleanup DNS/Nginx
- `POST /gateway/data/push` (TJwtOrganization) - Save org data snapshot
- `POST /gateway/data/pull` (TJwtOrganization) - Load org data snapshot

**Gateway:**

- `POST /collab/start` (called by Ganymede) - Handshake, pull data, initialize
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
- `ALL /svc/{serviceId}` (TJwtUser usually) - Resolve module-defined protected service

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

## Reload Mechanism

**How it works:**

1. Developer: `./scripts/local-dev/envctl.sh restart dev-001 gateway`
2. envctl.sh: Rebuild → Validate → Repack build
3. docker exec reload-gateway.sh (on each container)
4. Each gateway fetches new build and restarts Node.js
5. New code running (~10 seconds total)

**Implementation:**

- No file watching - triggered via `docker exec`
- Fetch new build from HTTP server
- Restart Node.js process automatically

**Entrypoint:** `docker-images/backend-images/gateway/app/entrypoint-dev.sh`

> **See:** [Gateway Container Scripts](../../docker-images/backend-images/gateway/README.md#flow-4-manual-reload-docker-exec) and [Build Distribution Guide](../guides/GATEWAY_BUILD_DISTRIBUTION.md) for detailed implementation.

---

## Database Schema (Gateways)

### gateways table

```sql
CREATE TABLE gateways (
    gateway_id uuid PRIMARY KEY,
    hostname varchar(256) NOT NULL,
    version varchar(15) NOT NULL,
    ready boolean NOT NULL DEFAULT false,
    container_name varchar(100),      -- NEW: gw-pool-0, gw-pool-1, etc.
    http_port integer,                -- NEW: 7100, 7101, etc.
    vpn_port integer,                 -- NEW: 49100, 49101, etc.
    UNIQUE (container_name)
);
```

### organizations_gateways table

```sql
CREATE TABLE organizations_gateways (
    organization_id uuid NOT NULL,
    gateway_id uuid NOT NULL,
    tmp_handshake_token uuid NOT NULL UNIQUE,
    started_at timestamp NOT NULL DEFAULT now(),
    ended_at timestamp,               -- NULL = active
    PRIMARY KEY (organization_id, gateway_id, started_at)
);

-- Index for finding active allocations
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

### View DNS Records

```bash
# View zone file
cat /etc/coredns/zones/domain.local.zone

# Test resolution
dig @localhost org-550e8400-e29b-41d4-a716-446655440000.domain.local
dig @localhost ganymede.domain.local
```

### View Nginx Configs

```bash
# List gateway configs
ls -la /root/.local-dev/dev-001/nginx-gateways.d/

# View specific org config
cat /root/.local-dev/dev-001/nginx-gateways.d/org-550e8400-e29b-41d4-a716-446655440000.conf
```

### Manually Trigger Gateway Reload

```bash
# Reload all gateways in environment (recommended)
./scripts/local-dev/envctl.sh restart dev-001 gateway

# Or reload single container directly
docker exec gw-pool-dev-001-0 /opt/gateway/app/lib/reload-gateway.sh
```

### Add More Gateways to Pool

```bash
# Create 2 additional gateways
cd /root/workspace/monorepo
ENV_NAME=dev-001 DOMAIN=domain.local \
  ./scripts/local-dev/gateway-pool.sh 2
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

**Ganymede Services:**

- `packages/app-ganymede/src/services/nginx-manager.ts`
- `packages/app-ganymede/src/lib/url-helpers.ts`

**Ganymede Routes:**

- `packages/app-ganymede/src/routes/gateway/index.ts`
- `packages/app-ganymede/src/routes/gateway/data.ts`

**Gateway Services:**

- `packages/app-gateway/src/module/module.ts` - Gateway module

**Database:**

- `database/schema/02-schema.sql`
- `database/procedures/proc_gateway_new.sql`
- `database/procedures/proc_organizations_start_gateway.sql`
- `database/procedures/proc_organizations_gateways_stop.sql`
- `database/procedures/func_organizations_get_active_gateway.sql`

**Docker:**

- `docker-images/backend-images/gateway/Dockerfile`
- `docker-images/backend-images/gateway/app/entrypoint-dev.sh`

---

## Related Documentation

- [Gateway Container Scripts](../../docker-images/backend-images/gateway/README.md) - Shell scripts for OpenVPN, Nginx, and container lifecycle
- [App-Gateway](../../packages/app-gateway/README.md) - Node.js application
- [Protected Services](./PROTECTED_SERVICES.md) - Module-driven protected endpoints
- [System Architecture](./SYSTEM_ARCHITECTURE.md) - Complete system diagram
- [User Containers Module](../../packages/modules/user-containers/README.md) - Container management and terminal access
