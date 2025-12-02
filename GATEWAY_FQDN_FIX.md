# Gateway FQDN Fix - Environment Name Isolation

## Problem Statement

1. **Gateway FQDN was wrong**: Set to `gw-pool-dev-001-0.domain.local` (includes environment name) instead of the organization's public URL `org-{uuid}.domain.local`

2. **Environment name leakage**: The environment name "dev-001" was appearing in internal configurations where it shouldn't

## How Gateway FQDN is Used

### 1. VPN Configuration (`packages/app-gateway/src/routes/collab.ts`)

```ovpn
client
dev tun
proto udp
remote GATEWAY_FQDN 49100    ← User containers use this to connect
...
```

### 2. HTTP Services (`packages/modules/user-containers/src/lib/servers-reducer.ts`)

```typescript
httpServices.push({
  host: this.depsExports.gateway.gatewayFQDN,  ← Service URLs use this
  name: event.name,
  port: event.port,
  secure: true,
});
```

## The Solution

### Gateway FQDN = Organization's Public URL

The gateway FQDN should **always** be the organization's public URL, which is determined **at allocation time**, not at container startup:

```typescript
// ✅ CORRECT: Constructed when gateway is allocated to organization
const gatewayFQDN = `org-${organizationId}.${domain}`;

// ❌ WRONG: Pre-set at container startup
const gatewayFQDN = `gw-pool-dev-001-0.domain.local`;
```

### Why This Works

1. **Ganymede allocates gateway to organization** (UUID: abc-123)
2. **DNS is registered**: `org-abc-123.domain.local` → `127.0.0.1`
3. **Nginx config is created**: Routes `org-abc-123.domain.local` → `127.0.0.1:7100`
4. **Gateway handshake** happens via `https://org-abc-123.domain.local/collab/start`
5. **Gateway initializes** for organization
6. **Modules are loaded** with `gatewayFQDN = "org-abc-123.domain.local"`
7. **VPN config uses** this FQDN: `remote org-abc-123.domain.local 49100`
8. **Services use** this FQDN: `https://org-abc-123.domain.local/uc-xyz/service`

## Changes Made

### 1. Removed GATEWAY_FQDN from Container Environment

**File:** `scripts/local-dev/gateway-pool.sh`

```bash
# BEFORE: Set GATEWAY_FQDN with environment name
GATEWAY_FQDN="gw-pool-${ENV_NAME}-${GATEWAY_COUNT}.${DOMAIN}"
-e GATEWAY_FQDN="${GATEWAY_FQDN}"

# AFTER: Removed - will be constructed at allocation time
# (no GATEWAY_FQDN environment variable)
```

### 2. Construct Gateway FQDN at Allocation Time

**File:** `packages/app-gateway/src/config/modules.ts`

```typescript
// BEFORE: Used pre-set environment variable
const gatewayFQDN = process.env.GATEWAY_FQDN || CONFIG.GATEWAY_ID;

// AFTER: Construct from organization ID and domain
const domain = process.env.DOMAIN || 'domain.local';
const gatewayFQDN = `org-${organizationId}.${domain}`;
```

## Environment Name Isolation - Complete Verification

### ✅ Environment Name ONLY Appears In:

1. **Container names**: `gw-pool-tartenpion-0`, `gw-pool-tartenpion-1`
2. **Storage paths**: `/root/.local-dev/tartenpion/`
3. **Database name**: `ganymede_tartenpion`
4. **Management commands**: `./envctl.sh start tartenpion`

### ✅ Environment Name NEVER Appears In:

1. **DNS records**: `my-company.com`, `ganymede.my-company.com`, `*.my-company.com`
2. **Service FQDNs**: `ganymede.my-company.com` (NOT `ganymede.tartenpion.my-company.com`)
3. **Gateway public URLs**: `org-{uuid}.my-company.com` (NOT `gw-pool-tartenpion-0.my-company.com`)
4. **User-facing URLs**: All URLs use only the domain, never the environment name
5. **VPN config**: `remote org-{uuid}.my-company.com 49100`
6. **Service URLs**: `https://org-{uuid}.my-company.com/...`

### Example: Environment "tartenpion" with domain "my-company.com"

```bash
# ✅ INTERNAL (environment name visible)
Container name: gw-pool-tartenpion-0
Database: ganymede_tartenpion
Storage: /root/.local-dev/tartenpion/
Command: ./envctl.sh start tartenpion

# ✅ USER-FACING (environment name invisible)
Frontend:  https://my-company.com
Ganymede:  https://ganymede.my-company.com
Gateway:   https://org-abc-123.my-company.com
VPN:       remote org-abc-123.my-company.com 49100
Service:   https://org-abc-123.my-company.com/uc-xyz/jupyter
```

## Technical Details

### Gateway Allocation Flow

```
1. Ganymede allocates gateway from pool
   ├─ Gets: container_name, http_port, vpn_port
   ├─ Organization UUID: abc-123
   └─ Domain: my-company.com

2. Ganymede sets up infrastructure
   ├─ DNS: org-abc-123.my-company.com → 127.0.0.1
   ├─ Nginx: org-abc-123.my-company.com → 127.0.0.1:7100
   └─ Reloads Nginx

3. Ganymede calls gateway handshake
   └─ POST https://org-abc-123.my-company.com/collab/start

4. Gateway fetches config from Ganymede
   ├─ Gets: organization_id, gateway_id, organization_token
   └─ Calls: https://ganymede.my-company.com/gateway/config

5. Gateway initializes for organization
   ├─ Constructs: gatewayFQDN = "org-abc-123.my-company.com"
   ├─ Loads modules with this FQDN
   └─ Pulls organization data from Ganymede

6. VPN and services use the correct FQDN
   ├─ VPN config: remote org-abc-123.my-company.com 49100
   └─ Service URLs: https://org-abc-123.my-company.com/...
```

### Why Container Name Includes Environment Name

The container name `gw-pool-tartenpion-0` includes the environment name to:

- Prevent conflicts when multiple environments exist
- Make it clear which environment a container belongs to
- Allow `docker ps` to show environment context

But this is **purely internal** - users never see or use these container names.

### Why Gateway Doesn't Need Pre-Allocation FQDN

Unlike traditional services that need a fixed hostname, gateways:

- Are dynamically allocated to organizations
- Use the organization's public URL (`org-{uuid}.domain.local`)
- Don't need their own unique FQDN before allocation
- Are accessed via Nginx reverse proxy (not directly)

## Migration Steps

```bash
# 1. Stop and delete old environment
./scripts/local-dev/envctl.sh stop dev-001
./scripts/local-dev/delete-env.sh dev-001

# 2. Rebuild with fixes
cd /root/workspace/monorepo
npx nx run app-gateway:build
npx nx run app-ganymede-cmds:build

# 3. Recreate environment
./scripts/local-dev/create-env.sh dev-001 domain.local
./scripts/local-dev/build-frontend.sh dev-001
./scripts/local-dev/envctl.sh start dev-001
```

## Verification

```bash
# 1. Check gateway container environment (should NOT have GATEWAY_FQDN)
docker exec gw-pool-dev-001-0 env | grep GATEWAY_FQDN
# Expected: no output

# 2. Check domain is set correctly
docker exec gw-pool-dev-001-0 env | grep "^DOMAIN="
# Expected: DOMAIN=domain.local

# 3. Test allocation and check logs
# After creating an organization and project, check gateway logs:
docker logs gw-pool-dev-001-0 2>&1 | grep "gatewayFQDN"
# Should show: org-{uuid}.domain.local (NOT gw-pool-dev-001-0.domain.local)
```

---

**Date Applied:** December 2, 2025
**Status:** ✅ Complete - Environment names are now properly isolated
