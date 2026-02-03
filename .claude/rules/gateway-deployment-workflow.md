# Gateway Deployment and Testing Workflow

## Placeholders

- **`{env}`**: Environment name (e.g., `apollo`, `staging`, `prod`)
- **`{org_id}`**: Organization UUID (from database)

## Architecture Context

### Gateway Container Lifecycle

1. Container startup: Docker runs `/entrypoint.sh`
2. Tarball fetch: Downloads `gateway-{env}.tar.gz` from local file server
3. Extract to `/opt/gateway/`
4. VPN/Nginx setup
5. Node.js app starts via supervisor script
6. Gateway ready to receive handshake

### Critical Files

- **Tarball**: `/root/.local-dev-builds/gateway-{env}.tar.gz` (served at `http://172.17.0.2:8090/`)
- **Container path**: `/opt/gateway/` (app-gateway + scripts)
- **Logs**: `/tmp/gateway.log` (inside container)
- **Allocation DB**: `ganymede.organizations_gateways` table

## Complete Deployment Workflow

When modifying code in `packages/app-gateway/`:

```bash
# 0. Verify infrastructure is healthy FIRST
./scripts/local-dev/infra-diagnostic.sh

# 1. Build everything (apps + tarball)
./scripts/local-dev/envctl.sh build {env}

# 2. Restart environment (triggers refetch + restart)
./scripts/local-dev/envctl.sh restart {env}

# 3. Wait for gateway to start (30-60 seconds)
sleep 30

# 4. Verify gateway is running on ALL pool containers (allocation is random)
for c in $(docker ps --filter "name=gw-pool-{env}" --format "{{.Names}}"); do
  echo "=== $c ===" && docker exec $c ps aux | grep node
done

# 5. Trigger gateway initialization
curl -k -X POST https://org-{org_id}.{env}.local/collab/start \
  -H "Content-Type: application/json" \
  -H "Origin: https://{env}.local" \
  -d '{}'

# 6. Check initialization logs (on the ALLOCATED container — check all if unsure)
for c in $(docker ps --filter "name=gw-pool-{env}" --format "{{.Names}}"); do
  echo "=== $c ===" && docker exec $c grep "GATEWAY_INIT\|Auto-assigned" /tmp/gateway.log | tail -5
done

# 7. Test WebSocket connection from browser
```

**Important:** Gateway pool containers are allocated randomly. Always verify ALL containers in the pool, not just one specific container.

## Common Pitfalls and Solutions

### Old Code Running After Build

**Cause**: Nx cache or container cached tarball

```bash
npx nx build app-gateway --skip-nx-cache
./scripts/local-dev/envctl.sh build {env}
./scripts/local-dev/envctl.sh restart {env}
```

Verify: `docker exec gw-pool-{env}-4 cat /opt/gateway/BUILD_INFO.txt`

### Gateway Not Initialized After Restart

Gateway auto-fetches config at startup. Check logs:

```bash
docker exec gw-pool-{env}-4 grep "FETCH_CONFIG" /tmp/gateway.log | tail -5
```

### Multiple Node Processes / Port Conflicts (EADDRINUSE)

**Cause**: Restart or reload spawned a new process without killing the old one.

```bash
# Check for multiple processes on ALL pool containers
for c in $(docker ps --filter "name=gw-pool-{env}" --format "{{.Names}}"); do
  echo "=== $c ===" && docker exec $c ps aux | grep "[n]ode"
done

# Fix: kill all, wait, restart cleanly
for c in $(docker ps --filter "name=gw-pool-{env}" --format "{{.Names}}"); do
  docker exec $c pkill -9 -f "node.*main.js" 2>/dev/null
done
sleep 5
for c in $(docker ps --filter "name=gw-pool-{env}" --format "{{.Names}}"); do
  docker exec -d $c /opt/gateway/app/lib/start-app-gateway.sh
done
```

### 502 Bad Gateway on Handshake

1. Check if Node.js is running: `docker exec gw-pool-{env}-4 ps aux | grep node`
2. If not running: `docker exec gw-pool-{env}-4 /opt/gateway/app/lib/start-app-gateway.sh`
3. Container not restarted: `docker restart gw-pool-{env}-4` then `sleep 60`

### WebSocket Connection Fails (1006)

1. Check initialization: `docker exec gw-pool-{env}-4 grep "Gateway initialized" /tmp/gateway.log | tail -1`
2. Check permissions: `docker exec gw-pool-{env}-4 grep "Auto-assigned\|user_roles" /tmp/gateway.log | tail -10`
3. Common fixes: User needs `org:owner` or `org:admin` role, reload page for fresh JWT

### "ENOENT: /opt/gateway/app/main.sh"

```bash
docker exec gw-pool-{env}-4 /opt/gateway/app/lib/trigger-reload.sh
# Or restart container entirely
docker restart gw-pool-{env}-4
sleep 60
```

### 500 Error on `/gateway/start` or `/collab/start`

**Don't guess — use observability:**

```bash
./scripts/observability-query.sh logs-all
```

Also check gateway container logs directly:

```bash
for c in $(docker ps --filter "name=gw-pool-{env}" --format "{{.Names}}"); do
  echo "=== $c ===" && docker exec $c grep "ERROR\|error\|500" /tmp/gateway.log | tail -10
done
```

Common causes: stale node process, missing config fetch, database allocation mismatch.

## Quick Reference Commands

```bash
# Pre-flight check
./scripts/local-dev/infra-diagnostic.sh

# Build and Deploy
./scripts/local-dev/envctl.sh build {env}
./scripts/local-dev/envctl.sh restart {env}

# Gateway Status (ALL pool containers)
docker ps | grep gw-pool
for c in $(docker ps --filter "name=gw-pool-{env}" --format "{{.Names}}"); do
  echo "=== $c ===" && docker exec $c ps aux | grep "[n]ode"
done

# Build verification
for c in $(docker ps --filter "name=gw-pool-{env}" --format "{{.Names}}"); do
  echo "=== $c ===" && docker exec $c cat /opt/gateway/BUILD_INFO.txt 2>/dev/null || echo "no BUILD_INFO"
done

# Logs
docker exec gw-pool-{env}-4 tail -f /tmp/gateway.log
docker exec gw-pool-{env}-4 grep ERROR /tmp/gateway.log
docker exec gw-pool-{env}-4 grep GATEWAY_INIT /tmp/gateway.log

# Observability (preferred for debugging)
./scripts/observability-query.sh logs-all
```

## Important Notes

- **Gateway startup**: Allow 30-60 seconds after restart before handshake
- **Frontend-only changes**: Just reload Nginx (`sudo service nginx reload`)
- **Ganymede-only changes**: Restart Ganymede only
- **Database schema**: No restart needed
- Only clear allocation when gateway is stuck after multiple restart attempts
- **Always use the full workflow** (build -> restart -> wait)
- **Check logs first** when debugging (don't guess)
