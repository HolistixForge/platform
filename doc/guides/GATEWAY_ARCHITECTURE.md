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

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Docker Host                               │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │      Main Dev Container (Ubuntu 24.04)                    │   │
│  │                                                            │   │
│  │  Nginx (Stage 1) :443 - SSL Termination                  │   │
│  │  ├─ domain.local → Frontend                              │   │
│  │  ├─ ganymede.domain.local → Ganymede :6000              │   │
│  │  └─ org-{uuid}.domain.local → Gateway :7100-7199        │   │
│  │                                                            │   │
│  │  Ganymede :6000                PowerDNS :53, :8081        │   │
│  │  ├─ Gateway allocation         └─ DNS records             │   │
│  │  ├─ DNS updates                                            │   │
│  │  ├─ Nginx config updates       PostgreSQL :5432           │   │
│  │  └─ Org data storage           ├─ ganymede_dev_001        │   │
│  │                                 └─ pdns                    │   │
│  │                                                            │   │
│  │  Docker Client → Manages gateway containers via socket    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              ▲                                    │
│                              │ Named Volume                      │
│                              │ demiurge-workspace                │
│  ┌──────────────────────────┴───────────────────────────────┐   │
│  │             Gateway Pool (Managed by Ganymede)            │   │
│  │                                                            │   │
│  │  gw-pool-0 :7100     gw-pool-1 :7101     gw-pool-2 :7102 │   │
│  │  State: READY        State: ALLOCATED    State: READY     │   │
│  │  ├─ app-gateway      ├─ app-gateway      ├─ app-gateway  │   │
│  │  ├─ Nginx (Stage 2)  ├─ Nginx (Stage 2)  ├─ Nginx (Stage│ │   │
│  │  └─ OpenVPN          └─ OpenVPN          └─ OpenVPN      │   │
│  │                                                            │   │
│  │  Shared workspace (/home/dev/workspace) → Hot-reload      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  User Containers                                                 │
│  └─ Connect via VPN to allocated gateway                        │
└─────────────────────────────────────────────────────────────────┘
```

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
  2. Receive org config (name, members, projects)

Gateway:
  3. Pull data: POST /gateway/data/pull
  4. Initialize YJS rooms for projects
  5. Start serving organization
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

---

## Data Storage Strategy

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
    "yjs_state": { "project-uuid": "base64..." },
    "gateway_state": {
      "permissions": {},
      "oauth_clients": {},
      "container_tokens": {}
    }
  }
}
```

**Benefits:**

- ✅ No data leakage between orgs
- ✅ Gateway crash-safe
- ✅ Same gateway serves multiple orgs sequentially
- ✅ Centralized backup

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

**nginx-manager.ts:**

- `createGatewayConfig(org_id, http_port)` - Create `/etc/nginx/.../org-{uuid}.conf`
- `removeGatewayConfig(org_id)` - Delete config file
- `reloadNginx()` - Test + reload nginx

**url-helpers.ts:**

- `makeOrgGatewayHostname(org_id)` → `org-{uuid}.domain.local`
- `makeOrgGatewayUrl(org_id)` → `https://org-{uuid}.domain.local`
- `makeUserContainerHostname(container_id, org_id)` → `uc-{uuid}.org-{uuid}.domain.local`

### Services (Gateway)

**data-sync.ts:**

- `pullDataFromGanymede()` - Load org data after allocation
- `pushDataToGanymede()` - Save org data on autosave/shutdown
- `setOrganizationContext(org_id, gateway_id, token)` - Set after handshake

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

---

## Scripts

**Setup (one-time):**

- `setup-all.sh` - Installs Node, PostgreSQL, Nginx, mkcert, PowerDNS, builds images
- `setup-powerdns.sh` - Install PowerDNS with official schema
- `build-images.sh` - Build dev-pod and gateway Docker images

**Environment management:**

- `create-env.sh <env> <domain>` - Create environment, DNS zone, gateway pool
- `envctl.sh start|stop|restart <env> [service]` - Manage services
- `gateway-pool.sh <count>` - Create gateway containers

**Hot-reload:**

- `envctl.sh restart <env> gateway` - Touch trigger file → all gateways reload

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

## PowerDNS Integration

**Installation:** Installed via `apt` in main dev container, uses existing PostgreSQL.

**Configuration:**

- API: `http://localhost:8081`
- API Key: `local-dev-api-key`
- Database: `pdns` in PostgreSQL

**Usage:**

- Zones created per environment in `create-env.sh`
- Records added/removed dynamically by Ganymede
- Host OS DNS delegated once (e.g., `*.domain.local` → dev container IP)

**Management:**

```bash
# View zone
curl http://localhost:8081/api/v1/servers/localhost/zones/domain.local. \
  -H 'X-API-Key: local-dev-api-key'

# View logs
sudo tail -f /var/log/pdns.log
```

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

1. Data sync stubs (collectDataSnapshot/applyDataSnapshot need integration)
2. No rollback on allocation failure
3. No gateway health checks before allocation
4. Hardcoded paths in some services

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

- `packages/app-ganymede/src/services/powerdns-client.ts`
- `packages/app-ganymede/src/services/nginx-manager.ts`
- `packages/app-ganymede/src/lib/url-helpers.ts`

**Ganymede Routes:**

- `packages/app-ganymede/src/routes/gateway/index.ts`
- `packages/app-ganymede/src/routes/gateway/data.ts`

**Gateway Services:**

- `packages/app-gateway/src/services/data-sync.ts`

**Database:**

- `database/schema/02-schema.sql`
- `database/procedures/proc_gateway_new.sql`
- `database/procedures/proc_organizations_start_gateway.sql`
- `database/procedures/proc_organizations_gateways_stop.sql`
- `database/procedures/func_organizations_get_active_gateway.sql`

**Docker:**

- `docker-images/backend-images/gateway/Dockerfile`
- `docker-images/backend-images/gateway/app/entrypoint-dev.sh`
