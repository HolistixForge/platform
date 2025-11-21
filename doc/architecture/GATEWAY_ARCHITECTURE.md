# Gateway Architecture

> **Remaining Work:** See [TODO.md](../../TODO.md)

---

## Overview

Demiurge uses a **pool-based multi-gateway architecture** where gateway containers are dynamically allocated to organizations on-demand.

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

All domains managed by PowerDNS with single DNS delegation on host OS:

- **Frontend:** `domain.local` (or custom: `demiurge.mycompany.local`)
- **Ganymede API:** `ganymede.domain.local`
- **Gateways:** `org-{organization-uuid}.domain.local` (dynamic)
- **User Containers:** `uc-{container-uuid}.org-{org-uuid}.domain.local` (dynamic)

**SSL:** Single wildcard certificate (`*.domain.local`) handles all subdomains.

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

- **Purpose:** User container routing via VPN
- **Protocol:** Plain HTTP (SSL already terminated)
- **Routes:** `uc-{uuid}.org-{uuid}.domain.local` → User container IP:port

**Why 2 stages?** Stage 1 doesn't know user container IPs (managed inside gateway via VPN).

---

## DNS Management Architecture

### Container-Agnostic Design

handle generic FQDN → IP mapping, not container concepts.

**DNSManager Abstraction:**

- **Location:** `packages/app-gateway/src/dns/DNSManager.ts`
- **Interface:** `packages/modules/gateway/src/lib/managers.ts` (abstract `DNSManager` class)
- **Exposed via:** Gateway module exports (`TGatewayExports.dnsManager`)

**Methods:**

- `registerRecord(fqdn: string, ip: string): Promise<void>` - Generic DNS registration
- `deregisterRecord(fqdn: string): Promise<void>` - Generic DNS deregistration

**Implementation:**

- DNSManager calls Ganymede API: `POST /gateway/dns/register` or `DELETE /gateway/dns/deregister`
- Ganymede calls PowerDNS: `registerRecord(fqdn, ip)` or `deregisterRecord(fqdn)`
- PowerDNS methods are generic (no container awareness)

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
  2. Register DNS: org-{uuid}.domain.local → 127.0.0.1
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
- **TokenManager** - Generates and validates HMAC and JWT tokens (`generateHMACToken()`, `generateJWTToken()`, `validateToken()`), uses GatewayState for storage
- **ProjectRoomsManager** - Manages multiple YJS rooms (one per project), handles per-project persistence and WebSocket routing
- **DNSManager** - Generic DNS record management (FQDN → IP mapping), container-agnostic abstraction over Ganymede API

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

**powerdns-client.ts:**

- `registerGateway(org_id)` - Add DNS: `org-{uuid}.domain.local` → 127.0.0.1
- `deregisterGateway(org_id)` - Remove DNS records
- `registerRecord(fqdn, ip)` - Generic: Register any FQDN → IP mapping (container-agnostic)
- `deregisterRecord(fqdn)` - Generic: Remove any DNS record (container-agnostic)

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
- `TokenManager` - Token management (HMAC and JWT tokens) with `IPersistenceProvider`
- `ProjectRoomsManager` - YJS rooms with `IPersistenceProvider`
- `DNSManager` - Generic DNS record management (FQDN → IP mapping) - no container awareness

**Initialization (`initialization/gateway-init.ts`):**

- `initializeGateway(org_id, gateway_id, token)` - Creates all instances, pulls data, registers providers
- `shutdownGateway()` - Gracefully shutdown (gets instances from registry)
- `GatewayInstances` registry - Stores instances for route access

### API Endpoints

**Ganymede:**

- `POST /gateway/start` (user auth) - Allocate gateway, register DNS/Nginx, call handshake
- `POST /gateway/config` (temp handshake token) - Exchange for org token + config
- `POST /gateway/ready` (TJwtGateway) - Gateway signals ready to be allocated
- `POST /gateway/stop` (TJwtOrganization) - Deallocate, cleanup DNS/Nginx
- `POST /gateway/data/push` (TJwtOrganization) - Save org data snapshot
- `POST /gateway/data/pull` (TJwtOrganization) - Load org data snapshot
- `POST /gateway/dns/register` (TJwtOrganization) - Generic DNS registration (FQDN → IP)
- `DELETE /gateway/dns/deregister` (TJwtOrganization) - Generic DNS deregistration

**Gateway:**

- `POST /collab/start` (called by Ganymede) - Handshake, pull data, initialize

---

## Development vs Production

| Aspect         | Development        | Production              |
| -------------- | ------------------ | ----------------------- |
| **Domain**     | `domain.local`     | `demiurge.co`           |
| **SSL**        | mkcert wildcard    | Let's Encrypt wildcard  |
| **DNS**        | PowerDNS (local)   | PowerDNS (same)         |
| **Containers** | Docker (same host) | Docker (same/multi-VPS) |
| **Scripts**    | `setup-all.sh`     | **Same scripts!**       |
| **Workflow**   | Hot-reload enabled | Hot-reload enabled      |

**Production deployment:**

```bash
export ENV_NAME="prod" DOMAIN="demiurge.co" GATEWAY_POOL_SIZE=10
./scripts/local-dev/setup-all.sh
./scripts/local-dev/create-env.sh ${ENV_NAME} ${DOMAIN}
# Update nginx SSL to Let's Encrypt certs
./scripts/local-dev/envctl.sh start ${ENV_NAME}
```

---

## Hot-Reload Mechanism

**Trigger File:** `/root/workspace/monorepo/.gateway-reload-trigger`

**How it works:**

1. Developer: `envctl.sh restart gateway`
2. Script touches trigger file
3. All gateways watch trigger via `inotifywait`
4. Trigger detected → rebuild app-gateway → restart process
5. All gateways reload simultaneously

**Entrypoint:** `docker-images/backend-images/gateway/app/entrypoint-dev.sh`

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
# All records
curl http://localhost:8081/api/v1/servers/localhost/zones/domain.local. \
  -H 'X-API-Key: local-dev-api-key' | jq '.rrsets[] | select(.type == "A")'

# Test resolution
dig @localhost org-550e8400-e29b-41d4-a716-446655440000.domain.local
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
# Reload all gateways in environment
./scripts/local-dev/envctl.sh restart dev-001 gateway

# Or manually touch trigger
touch /root/workspace/monorepo/.gateway-reload-trigger
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

See [TODO.md](../../TODO.md) for detailed improvement tasks.

**Main Gaps:**

1. No rollback on allocation failure
2. No gateway health checks before allocation
3. Hardcoded paths in some services

**Not Critical:** These don't block basic functionality, but should be addressed for production.

---

## Quick Reference

### Files by Category

**Scripts:**

- `scripts/local-dev/setup-powerdns.sh`
- `scripts/local-dev/build-images.sh`
- `scripts/local-dev/gateway-pool.sh`
- `scripts/local-dev/create-env.sh`
- `scripts/local-dev/envctl.sh`

**Ganymede Services:**

- `packages/app-ganymede/src/services/powerdns-client.ts` - Generic DNS operations
- `packages/app-ganymede/src/services/nginx-manager.ts`
- `packages/app-ganymede/src/lib/url-helpers.ts`

**Ganymede Routes:**

- `packages/app-ganymede/src/routes/gateway/index.ts`
- `packages/app-ganymede/src/routes/gateway/data.ts`
- `packages/app-ganymede/src/routes/gateway/dns.ts` - Generic DNS management endpoints

**Gateway Services:**

- `packages/app-gateway/src/dns/DNSManager.ts` - DNSManager implementation (calls Ganymede API)
- `packages/app-gateway/src/module/module.ts` - Gateway module (exposes DNSManager)

**Database:**

- `database/schema/02-schema.sql`
- `database/procedures/proc_gateway_new.sql`
- `database/procedures/proc_organizations_start_gateway.sql`
- `database/procedures/proc_organizations_gateways_stop.sql`
- `database/procedures/func_organizations_get_active_gateway.sql`

**Docker:**

- `docker-images/backend-images/gateway/Dockerfile`
- `docker-images/backend-images/gateway/app/entrypoint-dev.sh`
