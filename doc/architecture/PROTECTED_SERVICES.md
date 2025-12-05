# Protected Services Architecture

## Overview

The **Protected Services** system provides a generic, module-driven way to protect HTTP/WebSocket endpoints with JWT authentication and permission checks, without making app-gateway aware of specific module concepts like "user-containers".

This architecture enables modules to:
- Register protected endpoints with custom permission logic
- Resolve backend targets dynamically from module state
- Delegate authentication and authorization to gateway core

---

## Core Concepts

### ProtectedServiceRegistry

**Location:** `packages/modules/gateway/src/lib/protected-service-registry.ts`  
**Exposed via:** `TGatewayExports.protectedServiceRegistry`

The registry allows modules to register handlers for protected services during module initialization.

**Handler Interface:**

Each handler provides a unique service ID, a permission check callback, and a resolution callback. The request context includes service ID, path segments, query parameters, HTTP method, JWT, and optional user ID. The resolution returns module-defined metadata as a JSON object.

---

## Gateway HTTP Endpoint

### `/svc/{serviceId}`

**Method:** `ALL` (GET, POST, WebSocket upgrade, etc.)  
**Authentication:** `TJwtUser` (or other JWT types as defined by module)  
**Location:** `packages/app-gateway/src/routes/protected-services.ts`

**Flow:**

Authentication via JWT middleware, build request context, lookup service handler, run permission check (403 if denied), run resolution (404 if null), return service metadata as JSON.

---

## Module Integration Pattern

Modules register services during their load phase by calling `protectedServiceRegistry.registerService()` with an ID, permission check callback, and resolution callback. The permission check validates user access using PermissionManager, and the resolution callback accesses module-specific shared state to return service metadata.

For example, user-containers registers a terminal service that checks per-container terminal permission and resolves to terminal service metadata including FQDN and port.

---

## Frontend Integration

For services that provide their own web UI (like ttyd), the frontend uses the serviceUrl helper to construct the container's distinct FQDN and opens it directly. The service runs at the root path of the container's FQDN.

For custom UIs, the frontend can call /svc/{serviceId} to get resolution metadata, then use that information to construct appropriate connections.

---

## Architecture Benefits

### Module Agnostic

- App-gateway **does not know** what a "user-container" or "terminal" is
- Only knows: service IDs and registry interface
- Modules own all domain logic

### Security

- Centralized JWT validation in gateway middleware
- Module-defined permission checks
- Audit logging at gateway level

### Extensibility

Any module can register protected services for:
- Admin endpoints
- Debug consoles
- Monitoring dashboards
- Custom APIs

---

## Implementation Details

### Nginx Routing

**Stage 1 Nginx** (in main dev container):
- Routes `https://org-{uuid}.domain.local/*` → Gateway HTTP port

**Gateway Nginx** (inside gateway container):
- Server block for gateway FQDN: Routes all paths to app-gateway :8888
- Server block for VPN IP (172.16.0.1): Routes all paths to app-gateway :8888 (used by containers)
- Dynamic server blocks for each user container FQDN: Route to container VPN IP:port

Path routing (/collab, /svc, /oauth, /permissions) is handled by Express inside app-gateway.

### Container Architecture

User containers do not need internal nginx. Gateway Nginx routes each container's distinct FQDN directly to its VPN IP and service port. Containers simply start their services on the appropriate ports and call map_http_service to advertise them to the gateway.

---

## Example: User Container Terminals

User containers can expose web-based terminals by running ttyd and mapping a terminal service. The user-containers module registers a protected terminal service that checks user permission and resolves to the terminal service metadata. The frontend constructs the terminal URL using the container's distinct FQDN and opens it directly - ttyd serves its own complete web UI with xterm.js.

---

## Related Documentation

- [Gateway Architecture](./GATEWAY_ARCHITECTURE.md) - Overall gateway design
- [Permission System](./PERMISSION_SYSTEM.md) - Permission format and checking
- [API Reference](../reference/API.md) - `/svc/{serviceId}` endpoint details
- [User Containers](../../packages/modules/user-containers/README.md) - Terminal implementation


