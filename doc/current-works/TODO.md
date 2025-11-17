# Demiurge Platform - TODO

**Last Updated:** 2025-01-27

This document tracks all remaining tasks, improvements, and known issues.

---

## 🔴 HIGH PRIORITY (Blocking Production)

### GWGANYMEDEDATADELETE - Add Admin Auth for Data Deletion

**Context:** `DELETE /gateway/data/:organization_id` endpoint (`packages/app-ganymede/src/routes/gateway/data.ts:236`) has TODO for admin auth

**Problem:**
Endpoint currently returns `ForbiddenException` immediately. Needs proper admin authentication when implemented.

**Required:**

- Add admin authentication middleware
- Verify user has system admin privileges
- Implement the deletion logic after auth is added

**Related Files:**

- `packages/app-ganymede/src/routes/gateway/data.ts`
- `packages/app-ganymede/src/middleware/auth.ts`

---

### GWOAUTHCLEANUP - OAuth Cleanup Periodic Timer

**Context:** `OAuthManager.cleanupExpired()` exists but is never called automatically

**Current:**

- `cleanupExpired()` is only called on shutdown
- Expired codes/tokens accumulate in memory

**Required:**

- Add periodic timer (e.g., every hour) to call `cleanupExpired()`
- Can be added to `GatewayState` or `initializeGateway()`

**Related Files:**

- `packages/app-gateway/src/oauth/OAuthManager.ts`
- `packages/app-gateway/src/initialization/gateway-init.ts`

---

### GWCONTAINERINTEG - User-Containers Module Integration

**Context:** User-containers module needs to use gateway managers

**Problem:**
Container reducer (`modules/user-containers/src/lib/servers-reducer.ts`) needs access to:

- `permissionManager` - Check container permissions
- `oauthManager` - Create/delete OAuth clients for containers
- `containerTokenManager` - Generate tokens for containers

**Required:**

- Update reducer to get managers from `GatewayInstances` registry
- Implement `createOAuthClients()` to call `oauthManager.addClient()`
- Implement `deleteOAuthClients()` to call `oauthManager.deleteClient()`
- Add permission checks in `_new()` and `_delete()` methods
- Use `containerTokenManager` for hosting tokens

**Related Files:**

- `packages/modules/user-containers/src/lib/servers-reducer.ts`
- `packages/app-gateway/src/initialization/gateway-instances.ts`

---

### GWALLOCROLLBACK - Add Allocation Failure Rollback

**Context:** [packages/app-ganymede/src/routes/gateway/index.ts](packages/app-ganymede/src/routes/gateway/index.ts:110-112)

**Problem:**
If `/gateway/start` fails after partial allocation (e.g., Nginx reload fails), the gateway remains allocated but unusable, leading to pool exhaustion.

**Current Code:**

```typescript
} catch (error: any) {
  log(2, 'GATEWAY_ALLOC', `Failed to start gateway:`, error.message);
  // TODO: Cleanup on failure (deallocate, remove DNS, remove nginx config)
  return res.status(500).json({ error: 'Failed to start gateway' });
}
```

**Required:**

1. Track allocation steps in try block
2. On failure, rollback completed steps:
   - Call `proc_organizations_gateways_stop(gateway_id)`
   - Call `powerDNS.deregisterGateway(org_id)`
   - Call `nginxManager.removeGatewayConfig(org_id)`
   - Call `nginxManager.reloadNginx()`

---

## 🟡 MEDIUM PRIORITY (Code Quality)

### GWOPENAPI - Update OpenAPI Specs

**Context:** New endpoints and schemas need documentation

**Required:**

- Document OAuth endpoints (`/oauth/authorize`, `/oauth/token`, `/oauth/authenticate`)
- Add schemas for new routes
- Remove OAuth from Ganymede OpenAPI (moved to gateway)

**Related Files:**

- `packages/app-gateway/src/oas30.json`
- `packages/app-ganymede/src/oas30.json`

---

### GWHARDCODEDPATHS - Remove Hardcoded Paths

**Context:**

- [packages/app-ganymede/src/routes/gateway/data.ts](packages/app-ganymede/src/routes/gateway/data.ts:27-29)
- [packages/app-ganymede/src/services/nginx-manager.ts](packages/app-ganymede/src/services/nginx-manager.ts:17-23)

**Problem:**
Hardcoded `/root/.local-dev/...` paths in many places.

**Current:**

```typescript
function getDataDir(): string {
  const envName = process.env.ENVIRONMENT_NAME || 'dev-001';
  return `/root/.local-dev/${envName}/org-data`; // Hardcoded!
}
```

**Required:**

1. Add environment variable: `LOCAL_DEV_DIR=/root/.local-dev`
2. Use a function `getEnvsDir()` to build paths

**Files to update:**

- `packages/app-ganymede/src/config.ts`
- `packages/app-ganymede/src/routes/gateway/data.ts`
- `packages/app-ganymede/src/services/nginx-manager.ts`
- `scripts/local-dev/create-env.sh` (export LOCAL_DEV_DIR)
- ...

---

### GWNGINXERROR - Add Nginx Reload Error Recovery

**Context:** [packages/app-ganymede/src/services/nginx-manager.ts](packages/app-ganymede/src/services/nginx-manager.ts)

**Problem:**
If `nginx -t` fails, we throw but don't clean up the bad config file.

**Required:**

1. On `nginx -t` failure, delete the newly created config
2. Restore previous known-good state
3. Return descriptive error

---

### GWGANYMEDEOAUTH - Clean Ganymede OAuth Model

**Context:** [packages/app-ganymede/src/models/oauth.ts](packages/app-ganymede/src/models/oauth.ts)

**Problem:**
OAuth logic moved to gateway, but Ganymede still has some OAuth code.

**Required:**

- Keep only global OAuth client in Ganymede
- Remove database OAuth logic (moved to gateway)
- Clean up unused OAuth routes/models

---

### GWMODULEEXCEPTIONS - Fix Module Exception Imports

**Context:** [packages/modules/gateway/src/index.ts](packages/modules/gateway/src/index.ts)

**Problem:**
Some modules may still import deleted exception types (`ForwardException`, `RunException`).

**Required:**

- Check for deleted exception imports
- Update to use standard `Error` class
- Verify no broken imports

---

### GWPOOLAUTOSCALE - Add Gateway Pool Auto-Scaling

**Context:** [scripts/local-dev/gateway-pool.sh](scripts/local-dev/gateway-pool.sh)

**Enhancement:**
Monitor pool utilization and auto-create gateways when low:

- If `ready_count < 2` → create 3 more gateways
- Configurable thresholds
- Logged to Ganymede

---

### GWMONITORING - Add Monitoring Hooks

**Context:** Gateway lifecycle events

**Enhancement:**

- Log allocation/deallocation events to centralized logger
- Track gateway utilization metrics
- Monitor allocation success/failure rates
- Alert on pool exhaustion

**Deferred:** Waiting for comprehensive monitoring implementation (separate task)

---

## 📋 MAINTENANCE TASKS

### Cleanup Old Implementations

- [ ] Remove old gateway startup scripts (if any remain)
- [ ] Verify no references to deleted `data-sync.ts`
- [ ] Clean up any unused files from old architecture

---

## 🎯 NEXT STEPS

**Priority Order:**

1. **GWROUTESPERMCHECK** - Security critical, needs to be done before production
2. **GWOAUTHCLEANUP** - Prevents memory leaks
3. **GWCONTAINERINTEG** - Required for container lifecycle
4. **GWALLOCROLLBACK** - Prevents pool exhaustion
5. **GWOPENAPI** - Documentation
6. **Code Quality Tasks** - Can be done incrementally
