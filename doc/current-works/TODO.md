# Demiurge Platform - TODO

This document tracks all remaining tasks, improvements, and known issues.

---

## 🔴 HIGH PRIORITY (Blocking Production)

## 🟡 MEDIUM PRIORITY (Code Quality)

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
