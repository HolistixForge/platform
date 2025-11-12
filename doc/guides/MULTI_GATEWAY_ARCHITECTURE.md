# Multi-Gateway Architecture for Development and Production

## Executive Summary

This document proposes an enhanced architecture for running multiple isolated gateway containers that:

1. **Mirrors production** - Each gateway runs in its own container, like production VPS deployments
2. **Enables rapid iteration** - Gateways share the monorepo codebase via volume mounts (no rebuild needed)
3. **Minimizes host OS dependencies** - DNS zone delegation means host only configures DNS once
4. **Supports multiple organizations** - Each gateway serves one organization with multiple projects
5. **Production-ready** - Dev setup is nearly identical to production (only SSL and compilation differ)

## Current Architecture Analysis

### Current Local Development Setup (LOCAL_DEVELOPMENT.md)

**What works well:**

- ✅ Multiple isolated environments (`dev-001`, `dev-002`, etc.)
- ✅ Real HTTPS with mkcert
- ✅ Full stack: PostgreSQL, Nginx, Ganymede, Gateway
- ✅ User containers run in Docker

**Limitations:**

- ❌ Gateway runs **directly in dev container** (not containerized)
- ❌ Only **one gateway at a time** per environment
- ❌ Not production-like (prod has many gateway containers on VPS instances)
- ❌ Limited DNS capabilities (static nginx config, no dynamic routing)

### Current Production Setup (from docker-images/backend-images/gateway/)

**How it works:**

1. Gateway Docker image built with `FROM dev-pod:latest`
2. Gateway container started via `start-gw-container.sh`
3. Workspace mounted via **named volume**:
   ```bash
   -v demiurge-workspace:/home/dev/workspace  # Named volume mount
   ```
4. Gateway runs `node dist/packages/app-gateway/main.js` from mounted workspace
5. OpenVPN and Nginx run inside gateway container
6. **No SSL in gateway:** All SSL termination in stage 1 nginx (main dev container)

**Key insight:** Production and dev use the same approach - shared workspace for hot reload! 🎯

## Proposed Architecture

### Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          Docker Host (Dev Machine)                        │
│                                                                            │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │         Main Dev Container (demiurge-dev)                           │  │
│  │                                                                      │  │
│  │  ╔══════════════════════════════════════════════════════════════╗  │  │
│  │  ║              Nginx (Port 80/443) - Stage 1                    ║  │  │
│  │  ║  - SSL termination for ALL domains                           ║  │  │
│  │  ║  - Routes: Frontend, Ganymede, Gateways, User Containers     ║  │  │
│  │  ║  - Dynamic config: org-{uuid}.domain.local → gateway pool    ║  │  │
│  │  ╚═══════════╤══════════════════════════════════════════════════╝  │  │
│  │              │                                                       │  │
│  │  ┌───────────┴───────────┐   ┌────────────────────────────────┐   │  │
│  │  │   Ganymede            │   │   PostgreSQL                    │   │  │
│  │  │   :6000               │──▶│   :5432                         │   │  │
│  │  │   (node process)      │   │   - Ganymede DB                 │   │  │
│  │  │                       │   │   - PowerDNS DB (pdns)          │   │  │
│  │  │  Responsibilities:    │   └────────────────────────────────┘   │  │
│  │  │  - Allocate gateways  │                                         │  │
│  │  │  - Update PowerDNS    │   ┌────────────────────────────────┐   │  │
│  │  │  - Update Nginx       │   │   PowerDNS                      │   │  │
│  │  │  - Store org data     │   │   :53, :8081                    │   │  │
│  │  └───────────────────────┘   │   (apt installed)               │   │  │
│  │                               └────────────────────────────────┘   │  │
│  │                                                                      │  │
│  │  Volumes mounted:                                                   │  │
│  │  - demiurge-workspace (named volume, shared with gateways)         │  │
│  │  - /var/run/docker.sock (for gateway container management)         │  │
│  └──────────────────────────────────────────────────────────────────────┘
│                                                                            │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │               Gateway Containers (Multiple)                         │  │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐ │  │
│  │  │ gateway-org-001  │  │ gateway-org-002  │  │ gateway-org-003  │ │  │
│  │  │ Organization A   │  │ Organization B   │  │ Organization C   │ │  │
│  │  ├──────────────────┤  ├──────────────────┤  ├──────────────────┤ │  │
│  │  │ app-gateway      │  │ app-gateway      │  │ app-gateway      │ │  │
│  │  │ :7100            │  │ :7200            │  │ :7300            │ │  │
│  │  │                  │  │                  │  │                  │ │  │
│  │  │ OpenVPN          │  │ OpenVPN          │  │ OpenVPN          │ │  │
│  │  │ :49100/udp       │  │ :49200/udp       │  │ :49300/udp       │ │  │
│  │  │                  │  │                  │  │                  │ │  │
│  │  │ Nginx            │  │ Nginx            │  │ Nginx            │ │  │
│  │  │ (proxy user      │  │ (proxy user      │  │ (proxy user      │ │  │
│  │  │  containers)     │  │  containers)     │  │  containers)     │ │  │
│  │  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘ │  │
│  │           │                     │                     │            │  │
│  │           │  Volume Mount:      │                     │            │  │
│  │           │  /home/dev/workspace (READ-ONLY)          │            │  │
│  │           │  → /root/workspace/monorepo (host)        │            │  │
│  └───────────┴─────────────────────┴─────────────────────┴────────────┘  │
│                                                                            │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │               User Containers (Multiple)                            │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │  │
│  │  │ jupyter-abc  │  │ pgadmin-def  │  │ vscode-ghi   │             │  │
│  │  │ (org-001)    │  │ (org-002)    │  │ (org-001)    │             │  │
│  │  │ VPN to gw1   │  │ VPN to gw2   │  │ VPN to gw1   │             │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘             │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘

Access from host OS browser (via DNS delegation to PowerDNS):
  https://domain.local                           → Frontend (via PowerDNS)
  https://ganymede.domain.local                  → Ganymede API (via PowerDNS)
  https://org-<org-uuid-a>.domain.local          → Gateway allocated to Org A (via PowerDNS)
  https://org-<org-uuid-b>.domain.local          → Gateway allocated to Org B (via PowerDNS)

  https://uc-<container-uuid>.org-<org-uuid>.domain.local    → User container (2-stage nginx routing)

Host OS configuration: Point *.domain.local DNS zone to dev container IP (one-time setup)

Note: domain.local can be a subdomain (e.g., demiurge.mycompany.local)

Domain structure:
  - Main domain: domain.local (configurable, can be subdomain)
  - Organization gateway: org-{uuid}.domain.local
  - User containers: uc-{uuid}.org-{uuid}.domain.local (routed via gateway)
```

### Key Components

#### 1. Main Dev Container

- Runs **Nginx (Stage 1)** - ALL SSL termination happens here
- Runs **Ganymede** - API server, gateway allocation logic
- Runs **PostgreSQL** - Ganymede database + PowerDNS database
- Runs **PowerDNS** - DNS server with REST API (installed via apt)
- **NEW:** Mounts Docker socket for gateway container management (Ganymede uses this)
- **NEW:** Mounts named volume `demiurge-workspace` (shared with gateways)

#### 2. Gateway Containers (NEW - Pool-Based Architecture)

- **Gateway Pool:** Pre-created pool of gateway containers (NOT bound to orgs)
- **Stateless:** No org-specific data when created, configured on allocation
- **On-Demand Allocation:** Allocated when organization has active projects
- **Auto-Return:** Returns to pool after 5min inactivity (auto-shutdown mechanism)
- **Shared workspace via named Docker volume**: `demiurge-workspace:/home/dev/workspace`
- **No SSL termination:** All SSL handled by stage 1 nginx (main dev container)
- No rebuild needed for code changes (hot reload supported)
- Each has unique ports:
  - HTTP: 7100, 7101, 7102, ... (plain HTTP, not HTTPS)
  - OpenVPN: 49100/udp, 49101/udp, 49102/udp, ...
- Runs OpenVPN + Nginx (Stage 2) for user container proxying
- **2-stage routing:** Stage 1 nginx (SSL term) → Stage 2 nginx (container routing)

#### 3. Gateway Allocation Logic (in Ganymede)

**All allocation/deallocation logic lives in Ganymede** (not a separate service):

- **`POST /gateway/start`** endpoint:

  - Finds available gateway from pool (via `gateway-pool.sh allocate`)
  - Updates PowerDNS: `org-{org-uuid}.domain.local` → host IP
  - Updates Nginx: creates `/etc/nginx/conf.d/org-{uuid}.conf`
  - Calls gateway: `POST /collab/start` with handshake token
  - Gateway loads org config and data from Ganymede

- **`POST /gateway/stop`** endpoint:

  - Called by gateway on auto-shutdown (5min inactivity)
  - Deallocates gateway back to pool (via `gateway-pool.sh deallocate`)
  - Removes PowerDNS records
  - Removes Nginx config

- **`POST /gateway/ready`** endpoint:
  - Called by gateway container when it has initialized and is **ready to BE ALLOCATED**
  - NOT called after org loading (that's a different signal)
  - Marks gateway as available in pool

#### 4. DNS Management (NEW - PowerDNS)

**PowerDNS installed directly in main dev container** (using existing PostgreSQL):

- **Manages ALL domains**: Frontend, Ganymede, all gateways, all user containers
- **Domain structure:**
  - Main domain: `domain.local` (dev) or `domain.com` (prod)
  - Can be subdomain: `demiurge.mycompany.com`
  - Gateway FQDN: `org-{org-uuid}.domain.local`
  - User containers: `uc-{container-uuid}.org-{org-uuid}.domain.local`
- **Host OS setup**: One-time DNS delegation configuration pointing to dev container
- **Dynamic updates**: REST API for adding/removing records
- **IP addresses**: Always use **host IP** (127.0.0.1 in dev), not container IPs
- **Production-identical**: Same DNS setup for dev and prod

**Why PowerDNS?**

- Enterprise-grade, battle-tested (20+ years)
- Full REST API for dynamic record management
- Uses existing PostgreSQL database
- Same setup works for dev and prod

See `doc/archive/2024-container-refactor/DNS_SERVER_COMPARISON.md` for detailed analysis.

## Implementation Plan

### Phase 0: Build Docker Images ✅ PREREQUISITE

**Goal:** Automate gateway Docker image building in installation scripts

**New Script:** `scripts/local-dev/build-images.sh`

```bash
#!/bin/bash
# Build required Docker images for local development
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
DOCKER_IMAGES_DIR="${REPO_ROOT}/docker-images/backend-images"

echo "🏗️  Building Docker images..."

# Build dev-pod (base image)
echo "📦 Building dev-pod..."
cd "${DOCKER_IMAGES_DIR}/dev-pod"
docker build -t dev-pod:latest .

# Build gateway (depends on dev-pod)
echo "📦 Building gateway..."
cd "${DOCKER_IMAGES_DIR}/gateway"
docker build -t gateway:latest .

echo "✅ Docker images built successfully!"
docker images | grep -E "dev-pod|gateway"
```

**Update:** `scripts/local-dev/setup-all.sh` to call `build-images.sh`

---

### Phase 1: PowerDNS Deployment ✅ PREREQUISITE

**Goal:** Install PowerDNS in main dev container (using existing PostgreSQL)

**New Script:** `scripts/local-dev/setup-powerdns.sh`

```bash
#!/bin/bash
# Install PowerDNS with existing PostgreSQL backend
set -e

echo "🌐 Setting up PowerDNS..."

# Install PowerDNS and PostgreSQL backend
sudo apt-get update
sudo apt-get install -y pdns-server pdns-backend-pgsql

# Get PostgreSQL connection info from environment or defaults
PG_HOST=${PG_HOST:-localhost}
PG_PORT=${PG_PORT:-5432}
PG_USER=${PG_USER:-postgres}
PG_PASSWORD=${PG_PASSWORD:-devpassword}
DOMAIN=${DOMAIN:-domain.local}

# Create PowerDNS database and schema
PGPASSWORD=${PG_PASSWORD} psql -U ${PG_USER} -h ${PG_HOST} -p ${PG_PORT} << EOF
-- Create pdns database
CREATE DATABASE pdns;

-- Connect to pdns database
\c pdns

-- Create PowerDNS tables (schema from PowerDNS docs)
CREATE TABLE domains (
  id                    SERIAL PRIMARY KEY,
  name                  VARCHAR(255) NOT NULL UNIQUE,
  master                VARCHAR(128) DEFAULT NULL,
  last_check            INT DEFAULT NULL,
  type                  VARCHAR(6) NOT NULL,
  notified_serial       INT DEFAULT NULL,
  account               VARCHAR(40) DEFAULT NULL
);

CREATE TABLE records (
  id                    BIGSERIAL PRIMARY KEY,
  domain_id             INT DEFAULT NULL,
  name                  VARCHAR(255) DEFAULT NULL,
  type                  VARCHAR(10) DEFAULT NULL,
  content               VARCHAR(65535) DEFAULT NULL,
  ttl                   INT DEFAULT NULL,
  prio                  INT DEFAULT NULL,
  disabled              BOOL DEFAULT FALSE,
  ordername             VARCHAR(255),
  auth                  BOOL DEFAULT TRUE,
  FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE CASCADE
);

CREATE INDEX name_index ON records(name);
CREATE INDEX nametype_index ON records(name,type);
CREATE INDEX domain_id_index ON records(domain_id);
CREATE INDEX ordername ON records(ordername);

-- More tables for DNSSEC (optional, can add later)
EOF

# Configure PowerDNS
sudo tee /etc/powerdns/pdns.conf > /dev/null <<EOF
# Database backend
launch=gpgsql
gpgsql-host=${PG_HOST}
gpgsql-port=${PG_PORT}
gpgsql-dbname=pdns
gpgsql-user=${PG_USER}
gpgsql-password=${PG_PASSWORD}

# API configuration
api=yes
api-key=local-dev-api-key
webserver=yes
webserver-address=0.0.0.0
webserver-port=8081
webserver-allow-from=0.0.0.0/0

# Listening
local-address=0.0.0.0
local-port=53

# Other
daemon=no
guardian=yes
EOF

# Start PowerDNS
sudo systemctl enable pdns
sudo systemctl start pdns

# Wait for PowerDNS to be ready
echo "⏳ Waiting for PowerDNS to start..."
sleep 5

# Create main zone
curl -X POST "http://localhost:8081/api/v1/servers/localhost/zones" \
  -H "X-API-Key: local-dev-api-key" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"${DOMAIN}.\",
    \"kind\": \"Native\",
    \"nameservers\": [\"ns1.${DOMAIN}.\"]
  }"

echo "✅ PowerDNS installed successfully!"
echo "   DNS API: http://localhost:8081"
echo "   API Key: local-dev-api-key"
echo "   Zone: ${DOMAIN}"
echo "   Using PostgreSQL: ${PG_HOST}:${PG_PORT}/pdns"
```

**DNS Client Library:** `packages/app-ganymede/src/services/dns-client.ts`

```typescript
export class PowerDNSClient {
  constructor(
    private apiUrl: string,
    private apiKey: string,
    private zone: string
  ) {}

  async addRecord(name: string, ip: string, ttl: number = 60): Promise<void> {
    await fetch(`${this.apiUrl}/api/v1/servers/localhost/zones/${this.zone}`, {
      method: 'PATCH',
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rrsets: [
          {
            name: `${name}.${this.zone}`,
            type: 'A',
            changetype: 'REPLACE',
            ttl,
            records: [{ content: ip, disabled: false }],
          },
        ],
      }),
    });
  }

  async deleteRecord(name: string): Promise<void> {
    await fetch(`${this.apiUrl}/api/v1/servers/localhost/zones/${this.zone}`, {
      method: 'PATCH',
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rrsets: [
          {
            name: `${name}.${this.zone}`,
            type: 'A',
            changetype: 'DELETE',
          },
        ],
      }),
    });
  }
}
```

---

### Phase 2: Docker Socket Access & Dev Container Setup

**Goal:** Enable main dev container to start gateway containers

**Changes:**

```bash
# On host: Create named volume for workspace sharing
docker volume create demiurge-workspace

# Update dev container creation (LOCAL_DEVELOPMENT.md)
docker run -d \
  --name demiurge-dev \
  -p 80:80 -p 443:443 \
  -p 53:53/udp -p 53:53/tcp \                      # NEW: DNS ports
  -p 7100-7199:7100-7199 \                         # NEW: Gateway HTTPS ports
  -p 49100-49199:49100-49199/udp \                 # NEW: OpenVPN port range
  --cap-add=NET_ADMIN \
  --device /dev/net/tun \
  -v /var/run/docker.sock:/var/run/docker.sock \  # NEW: Docker socket
  -v demiurge-workspace:/root/workspace \          # NEW: Named volume (shared with gateways)
  ubuntu:24.04 \
  /bin/bash

# Inside dev container: Install Docker CLI
apt-get update && apt-get install -y docker.io

# Test: docker ps should now work (communicates with host Docker daemon)
docker ps
```

**Key Points:**

- **Named volume** `demiurge-workspace` is shared between dev container and gateway containers (siblings)
- **Docker CLI** in dev container talks to host Docker daemon via socket
- Gateway containers will mount the same named volume
- Gateway HTTP ports exposed through host (NO SSL in gateways - all SSL in stage 1 nginx)

**Security Note:** Mounting Docker socket is safe in dev environments but grants full Docker privileges.

---

### Phase 3: Gateway Pool Manager

**Goal:** Create script to manage gateway pool (create, allocate, deallocate)

**New Script:** `scripts/local-dev/gateway-pool.sh`

```bash
#!/bin/bash
# Gateway pool management
# Usage: ./gateway-pool.sh create <count>        # Create N gateways in pool
#        ./gateway-pool.sh allocate <org-uuid>   # Allocate gateway to org
#        ./gateway-pool.sh deallocate <org-uuid> # Return gateway to pool
#        ./gateway-pool.sh list                   # List all gateways
#        ./gateway-pool.sh status                 # Show pool status

set -e

ACTION=$1
ARG=$2
ENV_NAME=${ENV_NAME:-"dev-001"}

WORKSPACE_VOLUME="demiurge-workspace"
ENV_DIR="/root/.local-dev/${ENV_NAME}"
DOMAIN=${DOMAIN:-"domain.local"}
POOL_DIR="${ENV_DIR}/gateway-pool"

mkdir -p "${POOL_DIR}"

case "$ACTION" in
  create)
    COUNT=$ARG
    if [ -z "$COUNT" ]; then
      echo "Usage: $0 create <count>"
      exit 1
    fi

    echo "📦 Creating $COUNT gateways in pool..."

    for i in $(seq 1 $COUNT); do
      # Calculate ports
      GATEWAY_COUNT=$(docker ps -a --filter "name=gw-pool-" --format "{{.Names}}" | wc -l)
      GW_HTTP_PORT=$((7100 + GATEWAY_COUNT))
      GW_VPN_PORT=$((49100 + GATEWAY_COUNT))

      GATEWAY_NAME="gw-pool-${GATEWAY_COUNT}"
      GW_DATA_DIR="${POOL_DIR}/${GATEWAY_NAME}"
      mkdir -p "${GW_DATA_DIR}/logs"

      # Start gateway container (ready state, not allocated)
      # NO SSL - all SSL termination in stage 1 nginx
      # NO org-specific data - data stored in Ganymede
      docker run -d \
        --name "${GATEWAY_NAME}" \
        --network bridge \
        -v ${WORKSPACE_VOLUME}:/home/dev/workspace \
        -v ${GW_DATA_DIR}/logs:/logs:rw \
        -p ${GW_HTTP_PORT}:${GW_HTTP_PORT} \
        -p ${GW_VPN_PORT}:${GW_VPN_PORT}/udp \
        --cap-add=NET_ADMIN \
        --device /dev/net/tun \
        -e GATEWAY_STATE="ready" \
        -e GATEWAY_HTTP_PORT="${GW_HTTP_PORT}" \
        -e GATEWAY_VPN_PORT="${GW_VPN_PORT}" \
        -e GANYMEDE_FQDN="ganymede.${DOMAIN}" \
        -e DOMAIN="${DOMAIN}" \
        -e WORKSPACE="/home/dev/workspace" \
        gateway:latest

      # Save gateway info
      echo "${GATEWAY_NAME}|ready|${GW_HTTP_PORT}|${GW_VPN_PORT}|" > "${POOL_DIR}/${GATEWAY_NAME}.state"

      echo "  ✅ Created ${GATEWAY_NAME} (HTTP: ${GW_HTTP_PORT}, VPN: ${GW_VPN_PORT})"
    done
    ;;

  allocate)
    ORG_UUID=$ARG
    if [ -z "$ORG_UUID" ]; then
      echo "Usage: $0 allocate <org-uuid>"
      exit 1
    fi

    # Find available gateway from pool
    AVAILABLE_GW=$(ls ${POOL_DIR}/*.state 2>/dev/null | while read statefile; do
      STATE=$(cat "$statefile" | cut -d'|' -f2)
      if [ "$STATE" = "ready" ]; then
        basename "$statefile" .state
        break
      fi
    done | head -1)

    if [ -z "$AVAILABLE_GW" ]; then
      echo "❌ No available gateways in pool! Create more with: $0 create <count>"
      exit 1
    fi

    # Get gateway info
    GATEWAY_INFO=$(cat "${POOL_DIR}/${AVAILABLE_GW}.state")
    GW_HTTP_PORT=$(echo "$GATEWAY_INFO" | cut -d'|' -f3)

    # Update gateway state
    sed -i "s/|ready|/|allocated|/" "${POOL_DIR}/${AVAILABLE_GW}.state"
    sed -i "s/|$/|${ORG_UUID}/" "${POOL_DIR}/${AVAILABLE_GW}.state"

    # Register org FQDN in PowerDNS (points to host IP, not container IP)
    HOST_IP="127.0.0.1"  # In dev; in prod would be actual host IP
    ORG_FQDN="org-${ORG_UUID}.${DOMAIN}"

    # Register org domain AND wildcard for user containers
    curl -X PATCH "http://localhost:8081/api/v1/servers/localhost/zones/${DOMAIN}." \
      -H "X-API-Key: local-dev-api-key" \
      -H "Content-Type: application/json" \
      -d "{
        \"rrsets\": [
          {
            \"name\": \"${ORG_FQDN}.\",
            \"type\": \"A\",
            \"changetype\": \"REPLACE\",
            \"ttl\": 60,
            \"records\": [{\"content\": \"${HOST_IP}\", \"disabled\": false}]
          },
          {
            \"name\": \"*.${ORG_FQDN}.\",
            \"type\": \"A\",
            \"changetype\": \"REPLACE\",
            \"ttl\": 60,
            \"records\": [{\"content\": \"${HOST_IP}\", \"disabled\": false}]
          }
        ]
      }"

    # Return gateway info (Ganymede will handle DNS and Nginx)
    echo "${AVAILABLE_GW}|${GW_HTTP_PORT}|${GW_VPN_PORT}"
    ;;

  deallocate)
    ORG_UUID=$ARG
    if [ -z "$ORG_UUID" ]; then
      echo "Usage: $0 deallocate <org-uuid>"
      exit 1
    fi

    # Find gateway allocated to this org
    ALLOCATED_GW=$(grep -l "|${ORG_UUID}$" ${POOL_DIR}/*.state 2>/dev/null | xargs -r basename .state)

    if [ -z "$ALLOCATED_GW" ]; then
      echo "❌ No gateway found for organization ${ORG_UUID}"
      exit 1
    fi

    # Return gateway to ready state
    sed -i "s/|allocated|/|ready|/" "${POOL_DIR}/${ALLOCATED_GW}.state"
    sed -i "s/|${ORG_UUID}$/|/" "${POOL_DIR}/${ALLOCATED_GW}.state"

    echo "✅ Deallocated ${ALLOCATED_GW} from organization ${ORG_UUID}"
    echo "   Gateway returned to ready pool"

    # NOTE: DNS and Nginx cleanup handled by Ganymede (/gateway/stop endpoint)
    ;;

  list)
    echo "Gateway Pool Status:"
    echo "===================="
    for statefile in ${POOL_DIR}/*.state; do
      [ -f "$statefile" ] || continue
      GATEWAY_INFO=$(cat "$statefile")
      GW_NAME=$(basename "$statefile" .state)
      GW_STATE=$(echo "$GATEWAY_INFO" | cut -d'|' -f2)
      GW_HTTP=$(echo "$GATEWAY_INFO" | cut -d'|' -f3)
      GW_VPN=$(echo "$GATEWAY_INFO" | cut -d'|' -f4)
      GW_ORG=$(echo "$GATEWAY_INFO" | cut -d'|' -f5)

      if [ "$GW_STATE" = "ready" ]; then
        echo "  ${GW_NAME}: READY (HTTP:${GW_HTTP}, VPN:${GW_VPN})"
      else
        echo "  ${GW_NAME}: ALLOCATED to ${GW_ORG} (HTTP:${GW_HTTP}, VPN:${GW_VPN})"
      fi
    done
    ;;

  status)
    TOTAL=$(ls ${POOL_DIR}/*.state 2>/dev/null | wc -l)
    READY=$(grep -l "|ready|" ${POOL_DIR}/*.state 2>/dev/null | wc -l)
    ALLOCATED=$(grep -l "|allocated|" ${POOL_DIR}/*.state 2>/dev/null | wc -l)

    echo "Gateway Pool Status:"
    echo "  Total: ${TOTAL}"
    echo "  Ready: ${READY}"
    echo "  Allocated: ${ALLOCATED}"
    ;;

  *)
    echo "Usage: $0 {create|allocate|deallocate|list|status} [arg]"
    exit 1
    ;;
esac
```

---

### Phase 4: Register Core Services in PowerDNS

**Goal:** Register Ganymede and Frontend in PowerDNS (not just /etc/hosts)

**Update:** `scripts/local-dev/create-env.sh` to add domain configuration and register services

**Add to create-env.sh header:**

```bash
#!/bin/bash
# Create a new local development environment
# Usage: ./create-env.sh <env-name> [domain] [workspace-path] [database-path]
# Example: ./create-env.sh dev-001
# Example: ./create-env.sh dev-001 domain.local
# Example: ./create-env.sh dev-001 demiurge.mycompany.local /root/workspace-feat /root/database-feat

set -e

ENV_NAME=$1
DOMAIN=${2:-"domain.local"}
WORKSPACE_PATH=${3:-"/root/workspace/monorepo"}
DATABASE_PATH=${4:-"/root/workspace/database"}
GATEWAY_POOL_SIZE=${GATEWAY_POOL_SIZE:-3}  # Default: 3 gateways in pool

echo "📦 Creating environment: ${ENV_NAME}"
echo "   Domain: ${DOMAIN}"
echo "   Workspace: ${WORKSPACE_PATH}"
echo "   Database repo: ${DATABASE_PATH}"
echo "   Gateway pool size: ${GATEWAY_POOL_SIZE}"
```

**Register services in PowerDNS:**

```bash
# After creating environment, register in PowerDNS
echo "🌐 Registering services in PowerDNS..."

# Get dev container IP (127.0.0.1 since all services are in same container)
DEV_CONTAINER_IP="127.0.0.1"

# Register frontend (root domain or www subdomain)
curl -X PATCH "http://localhost:8081/api/v1/servers/localhost/zones/${DOMAIN}." \
  -H "X-API-Key: local-dev-api-key" \
  -H "Content-Type: application/json" \
  -d "{
    \"rrsets\": [{
      \"name\": \"${DOMAIN}.\",
      \"type\": \"A\",
      \"changetype\": \"REPLACE\",
      \"ttl\": 60,
      \"records\": [{\"content\": \"${DEV_CONTAINER_IP}\", \"disabled\": false}]
    }]
  }"

# Register Ganymede
curl -X PATCH "http://localhost:8081/api/v1/servers/localhost/zones/${DOMAIN}." \
  -H "X-API-Key: local-dev-api-key" \
  -H "Content-Type: application/json" \
  -d "{
    \"rrsets\": [{
      \"name\": \"ganymede.${DOMAIN}.\",
      \"type\": \"A\",
      \"changetype\": \"REPLACE\",
      \"ttl\": 60,
      \"records\": [{\"content\": \"${DEV_CONTAINER_IP}\", \"disabled\": false}]
    }]
  }"

# Register wildcard for all subdomains (covers org-*, uc-*, etc.)
curl -X PATCH "http://localhost:8081/api/v1/servers/localhost/zones/${DOMAIN}." \
  -H "X-API-Key: local-dev-api-key" \
  -H "Content-Type: application/json" \
  -d "{
    \"rrsets\": [{
      \"name\": \"*.${DOMAIN}.\",
      \"type\": \"A\",
      \"changetype\": \"REPLACE\",
      \"ttl\": 60,
      \"records\": [{\"content\": \"${DEV_CONTAINER_IP}\", \"disabled\": false}]
    }]
  }"

echo "✅ Services registered in PowerDNS"
echo "   Domain: ${DOMAIN}"
echo "   Wildcard: *.${DOMAIN} → ${DEV_CONTAINER_IP}"

# Create gateway pool
echo "🔧 Creating gateway pool (${GATEWAY_POOL_SIZE} gateways)..."
cd "${WORKSPACE_PATH}/scripts/local-dev"
DOMAIN=${DOMAIN} ENV_NAME=${ENV_NAME} ./gateway-pool.sh create ${GATEWAY_POOL_SIZE}
```

**Update .env.ganymede to include DOMAIN:**

```bash
cat >> "${ENV_DIR}/.env.ganymede" <<EOF

# Domain configuration
DOMAIN=${DOMAIN}
ENVIRONMENT_NAME=${ENV_NAME}
EOF
```

---

### Phase 5: Gateway Dockerfile Improvements

**Goal:** Optimize for dev workflow (hot reload, better debugging)

**Changes to:** `docker-images/backend-images/gateway/Dockerfile`

```dockerfile
FROM dev-pod:latest

USER root

RUN apt update && apt install -y \
  openvpn \
  easy-rsa \
  nginx \
  inotify-tools \
  dnsmasq

# Add hot-reload entrypoint
COPY --chmod=755 ./app/entrypoint-dev.sh /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
```

**New:** `docker-images/backend-images/gateway/app/entrypoint-dev.sh`

```bash
#!/bin/bash
set -e

WORKSPACE=/home/dev/workspace
REPO_ROOT="${WORKSPACE}/monorepo"
RELOAD_TRIGGER="${REPO_ROOT}/.gateway-reload-trigger"

echo "🚀 Starting gateway container ${HOSTNAME}"
echo "   Workspace: ${WORKSPACE}"
echo "   Reload trigger: ${RELOAD_TRIGGER}"

# Wait for workspace to be mounted
while [ ! -d "${REPO_ROOT}" ]; do
  echo "⏳ Waiting for workspace mount..."
  sleep 2
done

cd "${REPO_ROOT}"

# Check if built
if [ ! -d "./dist/packages/app-gateway" ]; then
  echo "❌ app-gateway not built! Run: npx nx run app-gateway:build"
  exit 1
fi

# Create reload trigger file
touch "${RELOAD_TRIGGER}"

# Initialize OpenVPN, Nginx, etc.
if [ -f "${GATEWAY_SCRIPTS_DIR}/lib/setup-gateway.sh" ]; then
  "${GATEWAY_SCRIPTS_DIR}/lib/setup-gateway.sh"
fi

# Hot reload loop
while true; do
  echo "▶️  Starting app-gateway..."

  SERVER_BIND="[{\"host\":\"0.0.0.0\",\"port\":${GATEWAY_HTTP_PORT}}]" \
  node --enable-source-maps ./dist/packages/app-gateway/main.js 2>&1 | tee -a /logs/gateway.log &
  APP_PID=$!

  # Watch for explicit reload trigger (from envctl.sh restart)
  inotifywait -e modify "${RELOAD_TRIGGER}" 2>/dev/null || true

  echo "🔄 Restarting app-gateway (trigger file modified)..."
  kill -USR1 $APP_PID 2>/dev/null || true  # Graceful shutdown signal
  sleep 3
  kill $APP_PID 2>/dev/null || true
  wait $APP_PID 2>/dev/null || true
done
```

**Reload mechanism:** `envctl.sh restart` simply touches the trigger file:

```bash
# In envctl.sh restart command
touch /root/workspace/monorepo/.gateway-reload-trigger
```

---

### Phase 6: Nginx Configuration Updates

**Goal:** Route requests to gateway containers from main nginx

**Changes to:** `scripts/local-dev/create-env.sh` (Nginx config section)

```nginx
# Add to /etc/nginx/sites-available/${ENV_NAME}

# Main domain (frontend)
server {
    listen 443 ssl;
    server_name ${DOMAIN};

    ssl_certificate ${ENV_DIR}/ssl-cert.pem;
    ssl_certificate_key ${ENV_DIR}/ssl-key.pem;

    root ${WORKSPACE_PATH}/dist/packages/app-frontend;
    index index.html;

    location / {
        try_files $uri /index.html;
    }
}

# Ganymede API
server {
    listen 443 ssl;
    server_name ganymede.${DOMAIN};

    ssl_certificate ${ENV_DIR}/ssl-cert.pem;
    ssl_certificate_key ${ENV_DIR}/ssl-key.pem;

    location / {
        proxy_pass http://127.0.0.1:${GANYMEDE_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}

# Organization gateways (dynamic configs generated by gateway-pool.sh)
# Include all org-specific configs
include /etc/nginx/conf.d/org-*.conf;
```

**Organization-specific config generated by `gateway-pool.sh allocate`:**

`/etc/nginx/conf.d/org-<org-uuid>.conf`:

```nginx
upstream org-<org-uuid>-gw {
    server 127.0.0.1:7101;  # Gateway HTTP port (not HTTPS!)
}

server {
    listen 443 ssl;
    server_name org-<org-uuid>.domain.local *.org-<org-uuid>.domain.local;

    # SSL termination (stage 1 - ALL SSL here!)
    ssl_certificate /root/.local-dev/dev-001/ssl-cert.pem;
    ssl_certificate_key /root/.local-dev/dev-001/ssl-key.pem;

    location / {
        # Proxy to gateway HTTP (SSL already terminated)
        proxy_pass http://org-<org-uuid>-gw;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

**This handles (stage 1 SSL termination):**

- `https://org-<org-uuid>.domain.local` → Gateway HTTP (collab WebSocket)
- `https://uc-<container-uuid>.org-<org-uuid>.domain.local` → Gateway HTTP → Stage 2 nginx → User container

---

### Phase 7: Ganymede Gateway Allocation Logic

**Goal:** Ganymede handles gateway allocation/deallocation with DNS and Nginx updates

**Changes to:** `packages/app-ganymede/src/routes/gateway/index.ts`

**Update `POST /gateway/start` endpoint:**

```typescript
// When first project in organization starts
router.post(
  '/projects/:projectId/start',
  authenticateSession,
  asyncHandler(async (req, res) => {
    const project = await getProject(req.params.projectId);
    const org = await getOrganization(project.organization_id);

    // Check if org already has allocated gateway
    let gateway = await getOrgGateway(org.id);

    if (!gateway) {
      // Call /gateway/start endpoint (handles allocation, DNS, Nginx)
      gateway = await allocateGatewayFromPool(org.id);
    }

    // Mark project as active
    await markProjectActive(project.id);

    res.json({ project, gateway });
  })
);

// When last project in organization stops
router.post(
  '/projects/:projectId/stop',
  authenticateSession,
  asyncHandler(async (req, res) => {
    const project = await getProject(req.params.projectId);

    // Mark project as inactive
    await markProjectInactive(project.id);

    // Check if org has any other active projects
    const activeProjects = await getOrgActiveProjects(project.organization_id);

    if (activeProjects.length === 0) {
      // No more active projects
      // Gateway will auto-deallocate after 5min inactivity
      // (calls POST /gateway/stop which handles deallocation)
    }

    res.json({ project });
  })
);
```

**NOTE:** No separate service needed! Allocation logic integrated directly into `/gateway/start` and `/gateway/stop` endpoints.

---

### Phase 8: Production Deployment Adaptation

**Goal:** Minimal differences between dev and production

**Production vs Development:**

| Aspect               | Development               | Production                              |
| -------------------- | ------------------------- | --------------------------------------- |
| **DNS**              | PowerDNS (local)          | PowerDNS (same setup, different domain) |
| **SSL**              | mkcert (self-signed CA)   | Let's Encrypt (automated)               |
| **Code**             | Named volume (hot reload) | Named volume (hot reload)               |
| **Gateway location** | Docker containers (pool)  | Docker containers (pool)                |
| **Workspace access** | Named volume              | Named volume                            |

**Production Setup:**

```bash
# On production host (nearly identical to dev!)
export ENV_NAME="prod"
export DOMAIN="demiurge.co"
export GATEWAY_POOL_SIZE=10

# Same scripts!
./scripts/local-dev/setup-all.sh
./scripts/local-dev/create-env.sh ${ENV_NAME} ${DOMAIN}
./scripts/local-dev/envctl.sh start ${ENV_NAME}
```

**SSL for Production:**

Update main nginx (stage 1) to use Let's Encrypt:

```bash
# Use certbot for main domain and wildcard
certbot certonly --standalone \
  -d ${DOMAIN} \
  -d *.${DOMAIN} \
  --non-interactive \
  --agree-tos \
  --email admin@${DOMAIN}

# Update nginx config to point to Let's Encrypt certs
ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
```

**That's it!** Same architecture, same containers, same scripts. Only SSL cert source differs.

---

## Host OS Configuration (Simplified with DNS Delegation)

**One-time setup only!** No more /etc/hosts editing for each gateway/service.

### Option 1: System DNS Configuration (Recommended)

**Windows:**

```powershell
# As Administrator
# Add DNS server in Network Adapter settings
# Control Panel → Network → Change adapter settings → Properties → IPv4 → Use following DNS:
# Preferred DNS: <dev-container-ip>
# Alternate DNS: 8.8.8.8 (fallback)
```

**macOS:**

```bash
# Add DNS resolver for .local domain
sudo mkdir -p /etc/resolver
echo "nameserver <dev-container-ip>" | sudo tee /etc/resolver/local
sudo dscacheutil -flushcache
```

**Linux:**

```bash
# Add DNS server to NetworkManager or systemd-resolved
# /etc/systemd/resolved.conf
[Resolve]
DNS=<dev-container-ip>
Domains=~local

sudo systemctl restart systemd-resolved
```

### Option 2: Fallback - /etc/hosts (Simple but manual)

If DNS delegation is complex on your OS:

```
<dev-container-ip>  dev-001.local
<dev-container-ip>  ganymede.dev-001.local
# Add gateways as they're created
<dev-container-ip>  gateway-org-001.local
```

**But this defeats the purpose!** With PowerDNS, you should only need to configure DNS delegation once.

### mkcert CA Installation (Still required)

Install mkcert root CA on host OS (one-time):

1. Copy `rootCA.pem` from dev container: `$(mkcert -CAROOT)/rootCA.pem`
2. Install on host OS (see LOCAL_DEVELOPMENT.md for platform-specific instructions)
3. Restart browsers

---

## Benefits of This Approach

### 1. Production Parity ✅

- Gateways run in containers (just like production VPS)
- Same Docker image for dev and prod
- Same named volume mount strategy
- Same process isolation
- Same pool-based allocation

### 2. Rapid Iteration ✅

- No container rebuild on code change
- Hot reload works (inotify watches dist/)
- Rebuild only affects running container (others unaffected)

### 3. Multiple Organizations ✅

- Each gateway = one organization
- Isolated state, VPN, OAuth, permissions
- Realistic multi-tenant testing

### 4. DNS Management ✅

- Dynamic subdomain routing
- User containers get stable URLs: `{slug}.gateway-{org}.local`
- Same DNS approach for dev and prod (PowerDNS)

### 5. Minimal Host OS Requirements ✅

- All container management from **inside main dev container**
- Docker socket is only requirement
- Scripts work cross-platform (Windows/Mac/Linux)
- Host only needs: Docker, /etc/hosts entries, mkcert CA

### 6. State Management ✅

- **Ganymede API:** Gateway pushes/pulls org data via REST endpoints
- **Location:** `/root/.local-dev/{env}/org-data/{org-uuid}.json`
- **Push triggers:** Autosave (30s), shutdown, deallocation
- **Pull trigger:** After allocation handshake completes
- **No volume mounts needed:** Gateway stateless between allocations

### 7. Debugging Capabilities ✅

- Each gateway has separate logs
- Can attach to specific gateway: `docker exec -it gateway-org-001 /bin/bash`
- Can stop/restart individual gateways without affecting others
- Full OpenVPN, Nginx, app-gateway logs accessible

**Note:** Comprehensive monitoring/logging (Prometheus, Grafana, centralized event logs) will be implemented later in a global manner.

---

## Questions & Considerations

### Q1: Docker-in-Docker vs Docker Socket?

**Answer:** Use **Docker socket mount** (recommended)

- Simpler: containers are siblings, not nested
- Better performance (no virtualization overhead)
- Industry standard for CI/CD systems
- Security: acceptable for dev environments

### Q2: How to handle DNS on different host OSes?

**Answer:** **DNS delegation to PowerDNS** (recommended)

- PowerDNS runs in dev container, exposed on port 53
- Host OS configures DNS to point \*.local to dev container IP
- All services (Ganymede, Frontend, Gateways, User Containers) managed dynamically
- **One-time setup**, no more /etc/hosts editing!

**Platform-specific guides provided above.**

### Q3: Read-only vs read-write workspace mount?

**Answer:** Use **read-only** for gateways

- Prevents accidental file changes from container
- Source of truth is host filesystem
- Gateways write to separate `/data` volumes

### Q4: Network mode (bridge vs host)?

**Answer:** Use **bridge** (default)

- Proper isolation between gateways
- Port conflicts impossible (each gateway has unique ports)
- More production-like

### Q5: How many gateways can run simultaneously?

**Answer:** Practically unlimited (ports derived from count/ID)

- Ports calculated dynamically: `7000 + GATEWAY_COUNT`
- No artificial limit on port range
- Memory: ~500MB per gateway
- Practical limit: ~10-20 gateways on typical dev machine (memory constraint)

### Q6: Storage strategy?

**Answer:** Ganymede API (implemented!)

- Gateway pushes data to Ganymede: `POST /gateway/data/push`
- Gateway pulls data from Ganymede: `POST /gateway/data/pull`
- Storage location: `/root/.local-dev/{env}/org-data/{org-uuid}.json`
- Gateway stateless between allocations
- No volume mounts for data (only workspace for code)

### Q7: Monitoring and logging?

**Answer:** Deferred to later comprehensive implementation

- Will implement centralized event logging across frontend, Ganymede, and gateways
- Will add Prometheus/Grafana for metrics
- For now: Use docker logs and file-based logs

---

## Migration Path from Current Setup

### Step 1: Build Docker Images

- Add `build-images.sh` to `setup-all.sh`
- Test image builds
- Verify gateway image works standalone

### Step 2: Deploy PowerDNS

- Implement `setup-powerdns.sh`
- Test DNS API
- Register test records
- Verify DNS resolution from host OS

### Step 3: Test Single Gateway Container

- Add Docker socket to dev container
- Start one gateway container via `gateway-ctl.sh`
- Verify hot reload works
- Verify DNS registration works

### Step 4: Register Core Services in DNS

- Update `create-env.sh` to register Ganymede/Frontend in PowerDNS
- Test DNS resolution for all services
- Remove /etc/hosts dependency

### Step 5: Ganymede Integration

- Update `/gateway/start` endpoint (pool allocation, DNS, Nginx)
- Update `/gateway/stop` endpoint (pool deallocation, DNS cleanup, Nginx cleanup)
- Clarify `/gateway/ready` endpoint (gateway ready to be allocated)
- Add data push/pull endpoints

### Step 6: Documentation & Validation

- Update LOCAL_DEVELOPMENT.md
- Create host OS setup guides (DNS delegation)
- Test on Windows/Mac/Linux
- Validate production parity

---

## Recommended Next Steps

1. **Build Docker images:** Implement `build-images.sh` and integrate with `setup-all.sh`
2. **Deploy PowerDNS:** Implement `setup-powerdns.sh` with PostgreSQL backend
3. **Test gateway container:** Start single gateway, verify volume mount, hot reload, OpenVPN
4. **Register services in DNS:** Update `create-env.sh` to register all services in PowerDNS
5. **Automate gateway deployment:** Update setup scripts to auto-deploy 2-3 gateways per environment
6. **Host OS guides:** Document DNS delegation setup for Windows/Mac/Linux
7. **Production preparation:** Document Let's Encrypt integration and compiled image builds

---

## Decisions Made ✅

Based on user feedback, the following decisions have been finalized:

1. **Domain Configuration:** Fully configurable per environment

   - Default: `domain.local` (can be changed to `demiurge.mycompany.com`, etc.)
   - Configured in `create-env.sh` as second argument: `./create-env.sh dev-001 domain.local`
   - Structure: `org-{uuid}.domain.com`, `uc-{uuid}.org-{uuid}.domain.com`
   - Can be subdomain (e.g., `demiurge.mycompany.local`)

2. **DNS:** PowerDNS installed directly in dev container (using existing PostgreSQL)

   - Manages ALL domains: Frontend, Ganymede, Gateways, User Containers
   - Host OS only needs DNS delegation configuration (one-time)
   - Same setup for dev and prod
   - No docker-compose needed!

3. **Gateway Pool:** Pre-created pool with configurable size

   - Default: 3 gateways per environment (configurable via `GATEWAY_POOL_SIZE` env var)
   - Pool created automatically in `create-env.sh`
   - Allocated from pool when organization starts first project
   - **Auto-deallocate:** Gateway shuts down after 5 minutes of inactivity (existing!)
   - NOT bound to organizations, dynamically assigned

4. **Port Range:** Dynamic allocation based on gateway count (no fixed limit)

   - HTTP: 7100 + GATEWAY_COUNT (plain HTTP, SSL in stage 1)
   - OpenVPN: 49100 + GATEWAY_COUNT (UDP)

5. **Container Naming:** `gw-pool-{N}` for pool, `org-{uuid}` for DNS/Nginx

   - Pool members: `gw-pool-0`, `gw-pool-1`, `gw-pool-2`, ...
   - DNS/Nginx use org UUID: `org-{uuid}.domain.com`
   - User containers: `uc-{uuid}.org-{uuid}.domain.com`

6. **Data Storage:** Ganymede API with file storage at `/root/.local-dev/{env}/org-data/{org-uuid}.json`

   - Gateway pushes: autosave (30s), shutdown, deallocation
   - Gateway pulls: on allocation (after handshake)
   - Future: Can migrate to PostgreSQL if needed

7. **Auto-Shutdown:** Existing mechanism (5 minutes inactivity)

   - Already implemented in `packages/modules/gateway/src/lib/gateway-reducer.ts`
   - Resets timer on every event
   - Gracefully saves state and shuts down
   - **NEW:** Will also call `POST /gateway/data/push` before shutdown

8. **Monitoring/Logging:** Deferred to later implementation

   - Will implement centralized event logging across all components
   - Will add Prometheus/Grafana for comprehensive monitoring

9. **Production Setup:** Same as dev, only SSL differs

   - Same Docker images, scripts, and architecture
   - Only difference: Let's Encrypt instead of mkcert
   - Open source → no code leak concerns

---

## Questions Answered ✅

### Q: What is Docker Compose and do we need it?

**Answer:** Docker Compose is a tool for defining multi-container applications in YAML.  
**We DON'T need it!** We already have PostgreSQL, so we can install PowerDNS directly via `apt` instead of deploying two containers with docker-compose.

### Q: Can we use existing PostgreSQL?

**Answer:** YES! PowerDNS can use your existing PostgreSQL instance. It just creates its own `pdns` database with its schema. Much simpler than deploying a separate PostgreSQL container.

### Q: How to mount workspace between sibling containers?

**Answer:** Use **Docker named volumes**!

```bash
# On host: Create named volume
docker volume create demiurge-workspace

# Dev container mounts it
docker run -v demiurge-workspace:/root/workspace ...

# Gateway containers mount the SAME volume
docker run -v demiurge-workspace:/home/dev/workspace ...
```

Both containers share the same filesystem without knowing the host path!

### Q: How to setup Docker in dev container to manage sibling containers?

**Answer:**

1. Mount Docker socket: `-v /var/run/docker.sock:/var/run/docker.sock`
2. Install Docker CLI in dev container: `apt-get install docker.io`
3. Docker CLI talks to host daemon → creates sibling containers

### Q: Should DNS point to container IP or host IP?

**Answer:** **HOST IP** (127.0.0.1 in dev, actual IP in prod)!

- Gateway containers listen on host ports (mapped: `-p 7100:443`)
- DNS must point to host, not internal container network
- Accessed from host OS browser perspective

### Q: Do gateways need their own SSL termination?

**Answer:** NO! **All SSL termination in stage 1 nginx (main dev container)**

- Gateway containers expose plain HTTP (ports 7100, 7101, etc.)
- Stage 1 nginx terminates SSL and proxies to gateway HTTP
- Simpler: Only one set of SSL certs to manage
- Gateway doesn't need mkcert or Let's Encrypt

### Q: Can workspace mount be read-only?

**Answer:** Can be read-only, but read-write is simpler!

- Gateway uses Ganymede API for org data storage (no local writes needed)
- But needs write access for hot-reload trigger file
- Simpler to just mount read-write

### Q: Are gateways bound to organizations?

**Answer:** NO! **Pool-based architecture**:

- Pre-create pool of N ready gateways
- Allocate from pool when org starts first project
- Deallocate back to pool when org has no active projects
- Same gateway can serve different orgs over time
- Nginx dynamically maps `gw-{org-uuid}.domain.local` → allocated gateway

---

## Decisions Finalized ✅

### 1. Organization Data Storage - Ganymede API

**Decision:** Gateway pushes/pulls data to/from Ganymede REST API (no mounting!)

**Implementation:**

- Gateway pushes data snapshot to Ganymede:
  - Autosave (periodic)
  - On shutdown
  - On deallocation
- Gateway pulls data from Ganymede:
  - On allocation (startup)
- Ganymede stores data in centralized store (PostgreSQL or file storage)

**New Ganymede endpoints:**

```typescript
POST / gateway / data / push; // Gateway pushes org data snapshot
POST / gateway / data / pull; // Gateway pulls org data snapshot
```

**Benefits:**

- ✅ No complex volume mounting
- ✅ Gateway stateless between allocations
- ✅ Data survives gateway crashes
- ✅ Centralized backup
- ✅ No data leakage between orgs

### 2. Gateway Hot-Swap (Existing Implementation!)

**Decision:** Gateway can serve different organizations without restart!

**Existing handshake flow (already implemented):**

1. **User calls Ganymede:** `POST /gateway/start` with `organization_id`
2. **Ganymede allocates gateway:** Calls database procedure `proc_organizations_start_gateway()` that returns `gateway_hostname` and `tmp_handshake_token`
3. **Ganymede calls Gateway:** `POST https://{gateway_hostname}/collab/start` with `tmp_handshake_token`
4. **Gateway calls back:** `POST https://{ganymede}/gateway/config` with `tmp_handshake_token`
5. **Ganymede returns config:** `{organization_id, organization_name, gateway_id, gateway_token, projects[], members[]}`
6. **Gateway initializes:** Loads org config, initializes YJS rooms for projects
7. **Gateway pulls data:** `POST https://{ganymede}/gateway/data/pull` _(NEW endpoint)_
8. **Gateway ready:** Calls `POST https://{ganymede}/gateway/ready` to signal ready
9. **Gateway serves organization:** Processes events, auto-saves state periodically

**Code locations:**

- Ganymede: `packages/app-ganymede/src/routes/gateway/index.ts`
  - `POST /gateway/start` - Allocate and initiate handshake
  - `POST /gateway/config` - Return org config to gateway
  - `POST /gateway/ready` - Gateway signals ready
- Gateway: `packages/app-gateway/src/routes/collab.ts`
  - `POST /collab/start` - Handshake endpoint
- Gateway init: `packages/app-gateway/src/initialization/gateway-init.ts`
  - `initializeGateway()` - Initialize with org config
  - `signalGatewayReady()` - Signal ready to Ganymede

**What needs updating:**

- ✅ Handshake mechanism already works
- ⚠️ Add data push/pull endpoints to Ganymede
- ⚠️ Update gateway to call data pull after handshake
- ⚠️ Update gateway to push data before auto-shutdown
- ⚠️ Update Ganymede `/gateway/start` to handle pool allocation, DNS, Nginx
- ⚠️ Update Ganymede `/gateway/stop` to handle pool deallocation, DNS cleanup, Nginx cleanup
- ⚠️ Clarify `/gateway/ready` - called when gateway ready TO BE ALLOCATED, not after org load

---

### 2.1. Gateway Auto-Shutdown (Existing Implementation!)

**Decision:** Gateway automatically shuts down after 5 minutes of inactivity - this triggers deallocation!

**Existing auto-shutdown mechanism (already implemented):**

**Key constant:** `GATEWAY_INACIVITY_SHUTDOWN_DELAY = 300` seconds (5 minutes)

**How it works:**

1. **Activity tracking:** `TGatewayMeta` stored in shared state tracks:

   ```typescript
   {
     projectActivity: {
       last_activity: "2025-01-15T10:30:00Z",     // Last event timestamp
       gateway_shutdown: "2025-01-15T10:35:00Z",  // Shutdown deadline
       disable_gateway_shutdown: false             // Can be disabled
     }
   }
   ```

2. **Timer reset:** Every event that comes in calls `rearmGatewayTimer()`:

   - Updates `last_activity` to current time
   - Recalculates `gateway_shutdown` = current time + 300 seconds
   - Stores in shared state

3. **Periodic check:** `reducers:periodic` event (runs every few seconds):

   - Checks if `gateway_shutdown` timestamp has passed
   - If passed AND `disable_gateway_shutdown` is false:
     - Calls `gatewayStop()`
     - Triggers shutdown sequence

4. **Shutdown sequence:**
   - Stop auto-save timers
   - Save all project YJS state
   - Save gateway state (permissions, OAuth, etc.)
   - **NEW:** Push data to Ganymede via `POST /gateway/data/push`
   - Call Ganymede: `POST /gateway/stop` with `gateway_id`
   - Process exits

**Code locations:**

- Gateway meta: `packages/modules/gateway/src/lib/gateway-types.ts` (`TGatewayMeta`)
- Gateway reducer: `packages/modules/gateway/src/lib/gateway-reducer.ts`
  - `rearmGatewayTimer()` - Reset inactivity timer on every event
  - `_periodic()` - Check if shutdown deadline passed
- Gateway state: `packages/app-gateway/src/state/GatewayState.ts` (`startAutoSave()`, `shutdown()`)
- Project rooms: `packages/app-gateway/src/state/ProjectRoomsManager.ts` (`saveAll()`, `shutdown()`)

**Benefits:**

- ✅ Gateway automatically deallocates when org has no activity
- ✅ Saves resources (doesn't run idle gateways)
- ✅ Returns to pool for other orgs to use
- ✅ Data safely saved before shutdown

**What needs updating:**

- ⚠️ Update shutdown sequence to push data to Ganymede: `POST /gateway/data/push`
- ⚠️ Update shutdown to call Ganymede: `POST /gateway/stop` (already exists, will handle deallocation)
- ⚠️ Ganymede `/gateway/stop` endpoint handles pool deallocation, DNS cleanup, Nginx cleanup

**Deallocation flow (triggered by auto-shutdown):**

1. Gateway inactivity timer expires (5 minutes)
2. Gateway initiates shutdown sequence:
   - Stops auto-save timers
   - Saves all YJS state
   - **NEW:** Pushes data to Ganymede: `POST /gateway/data/push`
   - Calls Ganymede: `POST /gateway/stop` with `{gateway_id, organization_id}`
3. Ganymede handles cleanup:
   - Deallocates gateway from pool: `gateway-pool.sh deallocate {org-uuid}`
   - Removes DNS records from PowerDNS
   - Removes Nginx config
   - Returns gateway to ready state
4. Gateway process exits cleanly

### 3. User Container Domain Structure

**Decision:** Use subdomain structure `uc-{uuid}.org-{uuid}.domain.com`

**Rationale:**

- Main nginx (stage 1) can route `*.org-{uuid}.domain.com` → allocated gateway
- Gateway nginx (stage 2) handles `uc-{uuid}.org-{uuid}.domain.com` → user container IP:port
- Simple wildcard routing, no container UUID lookup needed!

**Example flow:**

```
Client → https://uc-abc123.org-xyz789.domain.com
  ↓ (DNS: points to host IP 127.0.0.1)
Stage 1 Nginx (main dev container)
  ↓ (routes *.org-xyz789.domain.com → gateway-2:7101)
Stage 2 Nginx (gateway-2 container)
  ↓ (routes uc-abc123.org-xyz789.domain.com → container VPN IP:port)
User Container (172.16.0.5:8888)
```

**Nginx config (stage 1):**

```nginx
server {
    listen 443 ssl;
    server_name *.org-xyz789.domain.com;
    # Routes ALL subdomains of this org to its allocated gateway
    proxy_pass https://127.0.0.1:7101;
}
```

### 4. Production Setup

**Decision:** Same as dev, only difference is SSL (Let's Encrypt vs mkcert)

**Implementation:**

- ✅ Same Docker images
- ✅ Same scripts (gateway-pool.sh works in prod!)
- ✅ Same named volumes (or compiled code in image, flexible)
- ✅ Only difference: certbot for Let's Encrypt instead of mkcert

**Why this works:**

- Open source project → no code leak concerns
- Early stage → don't over-engineer
- Named volumes OR compiled images → user's choice
- Current setup sufficient for first production deployments

**Benefits:**

- ✅ Development IS production (parity)
- ✅ Easy to deploy
- ✅ Rapid iteration possible even in prod

---

## Complete Gateway Lifecycle Flow

### Gateway Pool Creation (Setup Phase)

```bash
# During create-env.sh
./gateway-pool.sh create 3

# Creates 3 gateway containers:
# - gw-pool-0 (HTTP: 7100, VPN: 49100) - State: READY
# - gw-pool-1 (HTTP: 7101, VPN: 49101) - State: READY
# - gw-pool-2 (HTTP: 7102, VPN: 49102) - State: READY

# Each gateway:
# - Signals ready to Ganymede: POST /gateway/ready
# - Waits idle for allocation
# - No org-specific config yet
```

### Gateway Allocation (Organization Starts First Project)

```
1. User opens project in organization → Frontend calls Ganymede
2. Ganymede POST /gateway/start:
   a. Calls: gateway-pool.sh allocate {org-uuid}
   b. Gets: gw-pool-0|7100|49100
   c. Updates PowerDNS: org-{uuid}.domain.local → 127.0.0.1
   d. Updates PowerDNS: *.org-{uuid}.domain.local → 127.0.0.1
   e. Creates Nginx config: /etc/nginx/conf.d/org-{uuid}.conf
   f. Reloads Nginx
   g. Calls gateway: POST https://org-{uuid}.domain.local/collab/start
3. Gateway POST /collab/start:
   a. Calls Ganymede: POST /gateway/config (with handshake token)
   b. Receives org config (id, name, members, projects)
   c. Calls Ganymede: POST /gateway/data/pull
   d. Loads org data (YJS state, permissions, OAuth)
   e. Initializes YJS rooms for all projects
   f. Starts serving organization
4. Frontend connects via WebSocket to gateway
5. Collaboration active!
```

### Gateway Deallocation (Auto-Shutdown After 5min Inactivity)

```
1. No events for 5 minutes
2. Gateway auto-shutdown triggers:
   a. Stops auto-save timers
   b. Saves all YJS state
   c. Pushes to Ganymede: POST /gateway/data/push
   d. Calls Ganymede: POST /gateway/stop (with org_id)
   e. Process exits
3. Ganymede POST /gateway/stop:
   a. Calls: gateway-pool.sh deallocate {org-uuid}
   b. Removes PowerDNS: org-{uuid}.domain.local
   c. Removes PowerDNS: *.org-{uuid}.domain.local
   d. Deletes Nginx config: /etc/nginx/conf.d/org-{uuid}.conf
   e. Reloads Nginx
4. Gateway marked ready in pool, available for next org
```

### Gateway Reallocation (Same Gateway, Different Org)

```
1. gw-pool-0 was serving Org A, now deallocated (ready state)
2. Org B starts first project
3. Ganymede allocates gw-pool-0 to Org B:
   - Updates DNS: org-{uuid-b}.domain.local → 127.0.0.1
   - Updates Nginx: routes *.org-{uuid-b}.domain.local → 127.0.0.1:7100
   - Calls gw-pool-0: POST /collab/start
4. gw-pool-0 pulls Org B's data from Ganymede
5. gw-pool-0 now serves Org B (no restart needed!)
```

**Key insight:** Same gateway container can serve different orgs sequentially, data stored centrally in Ganymede!

---

## New Ganymede Data Endpoints

### POST /gateway/data/push

**Purpose:** Gateway pushes organization data snapshot to Ganymede for centralized storage.

**When called:**

- Periodic autosave (every 30s if dirty)
- On gateway shutdown (SIGTERM, SIGINT)
- On deallocation (org has no active projects)

**Request:**

```typescript
POST https://ganymede.domain.local/gateway/data/push
Authorization: Bearer {gateway_token}
Content-Type: application/json

{
  "organization_id": "uuid",
  "gateway_id": "uuid",
  "timestamp": "2025-01-15T10:30:00Z",
  "data": {
    "yjs_state": {
      "project-uuid-1": "base64-encoded-yjs-binary",
      "project-uuid-2": "base64-encoded-yjs-binary"
    },
    "gateway_state": {
      "permissions": {...},
      "oauth_clients": {...},
      "container_tokens": {...}
    }
  }
}
```

**Response:**

```typescript
200 OK
{
  "success": true,
  "stored_at": "2025-01-15T10:30:01Z",
  "size_bytes": 1024000
}
```

**Implementation:** `packages/app-ganymede/src/routes/gateway/data.ts`

---

### POST /gateway/data/pull

**Purpose:** Gateway pulls organization data from Ganymede after allocation.

**When called:**

- After handshake completes (`POST /collab/start`)
- Gateway needs to load last known state for org

**Request:**

```typescript
POST https://ganymede.domain.local/gateway/data/pull
Authorization: Bearer {gateway_token}
Content-Type: application/json

{
  "organization_id": "uuid",
  "gateway_id": "uuid"
}
```

**Response:**

```typescript
200 OK
{
  "success": true,
  "timestamp": "2025-01-15T10:25:00Z",
  "data": {
    "yjs_state": {
      "project-uuid-1": "base64-encoded-yjs-binary",
      "project-uuid-2": "base64-encoded-yjs-binary"
    },
    "gateway_state": {
      "permissions": {...},
      "oauth_clients": {...},
      "container_tokens": {...}
    }
  }
}
```

**If no data exists (new org):**

```typescript
200 OK
{
  "success": true,
  "timestamp": null,
  "data": null
}
```

**Implementation:** `packages/app-ganymede/src/routes/gateway/data.ts`

---

### Storage Implementation Options

**Option A: PostgreSQL JSONB column**

```sql
CREATE TABLE gateway_data (
  organization_id UUID PRIMARY KEY,
  gateway_id UUID,
  data JSONB,
  updated_at TIMESTAMP,
  size_bytes INTEGER
);
```

**Option B: File storage**

```
/root/.local-dev/dev-001/org-data/
  ├── org-uuid-1.json
  ├── org-uuid-2.json
  └── org-uuid-3.json
```

**Recommendation:** Start with file storage (simpler), migrate to PostgreSQL if needed.

---

## Summary of Changes Needed

### 1. Gateway (app-gateway)

**Add data push functionality:**

```typescript
// packages/app-gateway/src/services/data-sync.ts
export class GatewayDataSync {
  async pushDataToGanymede() {
    const data = {
      yjs_state: await serializeAllYjsRooms(),
      gateway_state: await serializeGatewayState(),
    };

    await fetch(`https://${GANYMEDE_FQDN}/gateway/data/push`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GATEWAY_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        organization_id: ORGANIZATION_ID,
        gateway_id: GATEWAY_ID,
        timestamp: new Date().toISOString(),
        data,
      }),
    });
  }

  async pullDataFromGanymede() {
    const response = await fetch(`https://${GANYMEDE_FQDN}/gateway/data/pull`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GATEWAY_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        organization_id: ORGANIZATION_ID,
        gateway_id: GATEWAY_ID,
      }),
    });

    const { data } = await response.json();
    if (data) {
      await restoreYjsRooms(data.yjs_state);
      await restoreGatewayState(data.gateway_state);
    }
  }
}
```

**Call in initialization:**

```typescript
// In packages/app-gateway/src/routes/collab.ts
router.post('/collab/start', async (req, res) => {
  // ... existing handshake ...
  await startProjectCollabCallback(config);

  // NEW: Pull data
  await gatewayDataSync.pullDataFromGanymede();

  return res.json({});
});
```

**Call on shutdown:**

```typescript
// In packages/app-gateway/src/main.ts
async function shutdown(signal: string) {
  log(6, 'GATEWAY', `Received ${signal}, shutting down gracefully...`);

  // NEW: Push data before shutdown
  await gatewayDataSync.pushDataToGanymede();

  // ... existing shutdown logic ...
}
```

### 2. Ganymede (app-ganymede)

**Add data storage endpoints:**

```typescript
// packages/app-ganymede/src/routes/gateway/data.ts
export const setupGatewayDataRoutes = (router: Router) => {
  router.post(
    '/gateway/data/push',
    authenticateGatewayToken,
    asyncHandler(async (req, res) => {
      const { organization_id, gateway_id, timestamp, data } = req.body;

      // Store to file: /root/.local-dev/{env}/org-data/{org-uuid}.json
      const envName = process.env.ENVIRONMENT_NAME || 'dev-001';
      const dataDir = `/root/.local-dev/${envName}/org-data`;
      await fs.promises.mkdir(dataDir, { recursive: true });
      await fs.promises.writeFile(
        `${dataDir}/${organization_id}.json`,
        JSON.stringify({ gateway_id, timestamp, data }, null, 2)
      );

      return res.json({
        success: true,
        stored_at: new Date().toISOString(),
        size_bytes: Buffer.byteLength(JSON.stringify(data)),
      });
    })
  );

  router.post(
    '/gateway/data/pull',
    authenticateGatewayToken,
    asyncHandler(async (req, res) => {
      const { organization_id } = req.body;

      const envName = process.env.ENVIRONMENT_NAME || 'dev-001';
      const dataFile = `/root/.local-dev/${envName}/org-data/${organization_id}.json`;

      if (await fs.promises.exists(dataFile)) {
        const stored = JSON.parse(
          await fs.promises.readFile(dataFile, 'utf-8')
        );
        return res.json({
          success: true,
          timestamp: stored.timestamp,
          data: stored.data,
        });
      } else {
        return res.json({
          success: true,
          timestamp: null,
          data: null,
        });
      }
    })
  );
};
```

### 3. Gateway Pool Script Updates

**Update `gateway-pool.sh`:**

- ✅ Use `org-{org-uuid}.domain.local` domain structure
- ✅ Return gateway info (name, HTTP port, VPN port) - Ganymede handles rest
- ✅ NO DNS updates (Ganymede handles)
- ✅ NO Nginx updates (Ganymede handles)
- ✅ NO SSL certs (stage 1 nginx handles)

---

## Conclusion

This architecture provides:

- ✅ Production parity (gateway containers, pool-based allocation)
- ✅ Rapid iteration (shared workspace via named volumes, hot reload)
- ✅ Multi-gateway support (pool of ready gateways, realistic multi-org testing)
- ✅ DNS management (PowerDNS with existing PostgreSQL, dynamic subdomain routing)
- ✅ Cross-platform (Docker socket + named volumes work everywhere)
- ✅ Simplified setup (no docker-compose, uses existing PostgreSQL)
- ✅ Centralized SSL termination (stage 1 nginx, wildcard cert for all subdomains)
- ✅ Host IP-based DNS (correct for host OS access)
- ✅ Centralized data storage (Ganymede push/pull API at `/root/.local-dev/{env}/org-data/`)
- ✅ Hot-swap gateways (serve different orgs without restart)
- ✅ 2-stage nginx routing (stage 1 SSL term + routing → stage 2 container proxying)

The implementation is **incremental** and can be **tested at each phase** without breaking existing workflows.

---

## Implementation Checklist

### Scripts to Create

1. ✅ **`scripts/local-dev/build-images.sh`** - Build dev-pod and gateway Docker images
2. ✅ **`scripts/local-dev/setup-powerdns.sh`** - Install PowerDNS with existing PostgreSQL
3. ✅ **`scripts/local-dev/gateway-pool.sh`** - Manage gateway pool (create/allocate/deallocate/list/status)
   - **NOTE:** Only manages pool state, NOT DNS/Nginx (Ganymede handles those)

### Scripts to Update

4. ⚠️ **`scripts/local-dev/setup-all.sh`** - Add calls to build-images.sh and setup-powerdns.sh
5. ⚠️ **`scripts/local-dev/create-env.sh`** - Add domain param, register in PowerDNS, create gateway pool
6. ⚠️ **`scripts/local-dev/envctl.sh`** - Add gateway reload via trigger file

### Code to Add

7. ⚠️ **`packages/app-ganymede/src/routes/gateway/data.ts`** - Data push/pull endpoints
8. ⚠️ **`packages/app-ganymede/src/services/dns-client.ts`** - PowerDNS client library
9. ⚠️ **`packages/app-gateway/src/services/data-sync.ts`** - Data push/pull client

### Code to Update

10. ⚠️ **`packages/app-gateway/src/routes/collab.ts`** - Add data pull after handshake
11. ⚠️ **`packages/app-gateway/src/main.ts`** - Add data push on shutdown
12. ⚠️ **`packages/app-ganymede/src/routes/gateway/index.ts`** - Update start/stop/ready endpoints:
    - `/gateway/start` - Allocate from pool, update DNS, update Nginx, handshake
    - `/gateway/stop` - Deallocate to pool, remove DNS, remove Nginx
    - `/gateway/ready` - Mark gateway ready TO BE ALLOCATED (clarify comments!)
13. ⚠️ **`packages/app-ganymede/src/main.ts`** - Register data routes

### Infrastructure Changes

14. ⚠️ **Dev container creation** - Add Docker socket mount, named volume, port ranges (DNS port 53!)
15. ⚠️ **Gateway Dockerfile** - Update entrypoint for explicit reload trigger (watch single file)
16. ⚠️ **Nginx configs** - Update for org-based domains with stage 1 SSL termination (NO SSL in gateways)

### Documentation to Update

17. ⚠️ **`doc/guides/LOCAL_DEVELOPMENT.md`** - Complete rewrite with new multi-gateway setup
18. ⚠️ **`doc/guides/PRODUCTION_DEPLOYMENT.md`** - Update (same as dev, just Let's Encrypt)

---

## Ready to Implement? 🚀

All design decisions are finalized. The architecture is ready for implementation. Start with:

1. **Phase 0:** Create `build-images.sh` script
2. **Phase 1:** Create `setup-powerdns.sh` script and test PowerDNS installation
3. **Phase 2:** Update dev container setup with Docker socket
4. **Phase 3:** Create `gateway-pool.sh` script and test gateway pool
5. **Phases 4-7:** Implement data sync endpoints and Ganymede integration
6. **Phase 8:** Document production setup

**Would you like me to start implementing these scripts and code?**

---

## Architecture Comparison: Before vs After

| Aspect                   | Current (Before)                     | New Architecture (After)                                                       |
| ------------------------ | ------------------------------------ | ------------------------------------------------------------------------------ |
| **Gateway deployment**   | Runs directly in dev container       | Runs in Docker containers (pool-based)                                         |
| **Number of gateways**   | 1 per environment                    | N per environment (configurable, default 3)                                    |
| **Gateway allocation**   | Fixed to environment                 | Dynamic pool allocation on-demand                                              |
| **Gateway deallocation** | Manual                               | Automatic after 5min inactivity ✅                                             |
| **Domain structure**     | `{env}.local`, `gateway.{env}.local` | `domain.local`, `org-{uuid}.domain.local`, `uc-{uuid}.org-{uuid}.domain.local` |
| **DNS management**       | Static /etc/hosts                    | PowerDNS with REST API (dynamic)                                               |
| **Host OS setup**        | Add /etc/hosts for each service      | One-time DNS delegation                                                        |
| **SSL certificates**     | mkcert per environment               | mkcert wildcard `*.domain.local` (stage 1 only)                                |
| **Data storage**         | Local disk (`/data/*.json`)          | Ganymede API at `/root/.local-dev/{env}/org-data/{org-uuid}.json`              |
| **Production parity**    | Low (different architecture)         | **High (same containers, same scripts!)**                                      |
| **Multi-org testing**    | Difficult (1 gateway)                | Easy (multiple gateway pool)                                                   |
| **Code iteration**       | Good (direct process)                | **Excellent (hot-reload in containers)**                                       |

---

## Quick Start Guide (After Implementation)

### For Developers (First Time Setup)

```bash
# 1. Start dev container with Docker socket
docker volume create demiurge-workspace
docker run -d --name demiurge-dev \
  -p 80:80 -p 443:443 -p 53:53/udp -p 53:53/tcp \
  -p 7100-7199:7100-7199 -p 49100-49199:49100-49199/udp \
  --cap-add=NET_ADMIN --device /dev/net/tun \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v demiurge-workspace:/root/workspace \
  ubuntu:24.04

# 2. Inside dev container: Clone and setup
docker exec -it demiurge-dev bash
cd /root/workspace && git clone <repo>
cd monorepo
./scripts/local-dev/setup-all.sh

# 3. Create environment (with custom domain)
./scripts/local-dev/create-env.sh dev-001 demiurge.local

# 4. Build frontend
./scripts/local-dev/build-frontend.sh dev-001

# 5. Start services
./scripts/local-dev/envctl.sh start dev-001
```

### On Host OS (One-Time)

```bash
# 1. Configure DNS delegation (Windows example)
# Point *.demiurge.local to dev container IP
# (See Phase 2 for platform-specific guides)

# 2. Install mkcert CA
# Copy rootCA.pem from dev container and install
```

### Using Multiple Organizations

```bash
# Inside dev container

# Check gateway pool
./scripts/local-dev/gateway-pool.sh status
# Output: Total: 3, Ready: 3, Allocated: 0

# In frontend: Create organization "Company A"
# Backend automatically allocates gateway from pool

# Check pool again
./scripts/local-dev/gateway-pool.sh list
# Output: gw-pool-0: ALLOCATED to org-uuid-a
#         gw-pool-1: READY
#         gw-pool-2: READY

# After 5 minutes of inactivity, gateway auto-deallocates
# Pool status: Total: 3, Ready: 3, Allocated: 0
```

---

## Final Summary

### ✅ Problems Solved

1. **Production parity** - Gateways run in containers exactly like production (same code, same approach)
2. **Multi-org testing** - Pre-created gateway pool supports multiple organizations simultaneously
3. **DNS management** - PowerDNS dynamically manages all domains (one-time host OS setup!)
4. **Host OS agnostic** - All management in dev container via Docker socket (Windows/Mac/Linux)
5. **Data persistence** - Centralized via Ganymede API at `/root/.local-dev/{env}/org-data/{org-uuid}.json`
6. **Auto-deallocation** - Existing 5min inactivity mechanism triggers deallocation automatically
7. **Simplified setup** - No docker-compose, PowerDNS uses existing PostgreSQL via apt
8. **Hot reload** - Explicit trigger file (modified by `envctl.sh restart`)
9. **Centralized SSL** - All SSL in stage 1 nginx (one wildcard cert, simpler!)
10. **Allocation logic in Ganymede** - No separate manager service, cleaner architecture

### 🚀 What's Next?

The plan is complete and ready for implementation. All questions answered, all decisions made.

**Recommended implementation order:**

1. Start with **Phase 0-1** (build images, PowerDNS) - Foundation
2. Test **Phase 2-3** (Docker socket, gateway pool) - Core functionality
3. Implement **Phase 4-6** (DNS, Nginx, Dockerfile) - Integration
4. Add **Phase 7** (Ganymede data endpoints, pool manager) - Full automation
5. Document **Phase 8** (production setup) - Production readiness

**Each phase is independently testable** and doesn't break existing workflows.

Ready to implement? 🎯
