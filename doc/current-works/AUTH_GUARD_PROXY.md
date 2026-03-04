# Auth Guard Proxy - User Container Service Protection

**Last Updated:** March 2, 2026
**Status:** Implemented
**Supersedes:** ~~doc/architecture/USER_CONTAINER_SERVICE_PROTECTION.md~~, ~~doc/architecture/PROTECTED_SERVICES.md~~ (both removed)

---

## Table of Contents

- [1. Executive Summary](#1-executive-summary)
- [2. Problem Statement](#2-problem-statement)
- [3. Solution: Auth Guard Proxy](#3-solution-auth-guard-proxy)
- [4. OAuth Authentication Flow](#4-oauth-authentication-flow)
- [5. Permission Model](#5-permission-model)
- [6. Service Routing](#6-service-routing)
- [7. OAuth Client Model](#7-oauth-client-model) (abstraction, registration API, threat model, custom domain relay)
- [8. Per-Service Integration](#8-per-service-integration)
- [9. WebSocket Support](#9-websocket-support)
- [10. Binary Distribution](#10-binary-distribution)
- [11. Infrastructure Changes](#11-infrastructure-changes)
- [12. Code to Remove](#12-code-to-remove)
- [13. Test Strategy](#13-test-strategy)
- [14. Implementation Phases](#14-implementation-phases)
- [15. Load Distribution Analysis](#15-load-distribution-analysis)
- [16. Open Questions](#16-open-questions)

---

## 1. Executive Summary

Every user container (Ubuntu terminal, Jupyter, VS Code, pgAdmin, n8n) exposes HTTP services directly accessible via unique FQDNs. Today, nginx routes traffic straight to these services with **zero authentication or authorization**. Anyone with the URL gets full access.

The solution is a **compiled Go binary** (the Auth Guard Proxy) that runs inside every user container as the sole network entry point. It authenticates users via OAuth with Ganymede, checks permissions with the gateway, and reverse-proxies authenticated requests to backend services. This approach:

- Protects ALL services universally (no per-service auth code)
- Distributes auth load to containers (gateway not in the hot path)
- Works with any domain (platform FQDNs via OAuth, custom domains via token relay)
- Handles WebSocket connections (ttyd, collab)
- Simplifies existing OAuth-capable services (Jupyter, pgAdmin, n8n)
- Extends Ganymede OAuth with abstract dynamic client registration (Ganymede has zero container awareness)
- Adds ~10MB to container images, ~5MB RAM at runtime

---

## 2. Problem Statement

### 2.1 Current State: No Authentication on Direct Container Access

```
Browser
  ↓
nginx stage 1 (SSL termination, routes by org FQDN)
  ↓
nginx stage 2 (inside gateway container, routes by service FQDN)
  ↓
┌─────────────────────────────────────┐
│ User Container                      │
│                                     │
│   ttyd :7681       ← NO AUTH        │
│   code-server :8080 ← NO AUTH       │
│   jupyter :8888    ← NO AUTH        │
└─────────────────────────────────────┘
```

nginx stage 2 creates per-service server blocks:

```nginx
server {
    listen ${GATEWAY_HTTP_PORT};
    server_name vscode.uc-abc123.org-uuid.domain.local;
    location / {
        proxy_pass http://172.16.1.2:8080;  # DIRECT TO CONTAINER, NO AUTH
    }
}
```

### 2.2 What Needs Protection

| Use Case     | Service                         | Auth Capability             | Current Protection    |
| ------------ | ------------------------------- | --------------------------- | --------------------- |
| Web terminal | ttyd                            | None                        | None                  |
| Code editor  | code-server                     | Password only (disabled)    | None                  |
| Notebooks    | Jupyter (jupyterhub-singleuser) | HubOAuth (partially broken) | None                  |
| DB admin     | pgAdmin                         | OAuth2                      | None on direct access |
| Automation   | n8n                             | OAuth2                      | None on direct access |
| API calls    | Frontend → container            | None                        | None (Pattern B)      |
| WebSocket    | ttyd, collab                    | None                        | None                  |

### 2.3 Why Previous Approaches Fall Short

**Protected Services (`/svc/{serviceId}`):** Returns metadata JSON only. Does not proxy traffic. The frontend bypasses it entirely by opening direct URLs via `serviceUrl()`. Never consumed by any frontend code.

**Gateway OAuth provider:** Only works for services that natively support OAuth (Jupyter, pgAdmin, n8n). Services like ttyd and code-server have zero OAuth capability. Additionally, the gateway has no session cookies — it cannot authenticate browser users for an OAuth authorize flow. The gateway OAuth implementation uses opaque hex tokens (not JWT) and has no OIDC support.

**Hybrid approaches (gateway proxy, nginx auth_request):** Centralize load on the gateway. Every request for every container flows through a single Node.js process, creating a bottleneck.

### 2.4 Decision Rationale: Why Auth Guard Proxy

Five protection mechanisms were evaluated during research. The Auth Guard Proxy was chosen because it is the only approach that satisfies all requirements simultaneously.

| Mechanism                                                                               |      Universal (ttyd, VS Code)       | Works for API calls |        Custom domain support        |          Decentralized load          |   Per-service code needed   |
| --------------------------------------------------------------------------------------- | :----------------------------------: | :-----------------: | :---------------------------------: | :----------------------------------: | :-------------------------: |
| **Gateway Proxy** (route all traffic through gateway)                                   |                 Yes                  |         Yes         | No (cookie-bound to gateway domain) |       No (gateway bottleneck)        |             No              |
| **Service-Initiated OAuth** (service redirects to gateway OAuth)                        | No (ttyd/code-server can't do OAuth) |         Yes         |                 Yes                 |                 Yes                  |     Yes (each service)      |
| **Per-Module OAuth Bridge** (Python/Node auth proxy per module)                         |           Yes (with proxy)           |         Yes         |                 Yes                 |                 Yes                  | Yes (duplicated per module) |
| **Protected Service + Token Exchange** (frontend gets OAuth token, passes to container) |  No (browser UI still unprotected)   |         Yes         |                 Yes                 |                 Yes                  |             Yes             |
| **nginx auth_request** (subrequest to gateway before proxy)                             |                 Yes                  |         Yes         |         No (needs cookies)          | No (gateway validates every request) |             No              |
| **Auth Guard Proxy** (compiled binary in container)                                     |               **Yes**                |       **Yes**       |               **Yes**               |               **Yes**                |           **No**            |

**Why not Gateway Proxy?** Every HTTP request — including WebSocket frames, static assets, and API calls — would flow through a single Node.js process. With 10 containers each serving a VS Code IDE, the gateway becomes a throughput bottleneck. Also, cookie-based auth is bound to the gateway domain, breaking custom domain aliasing.

**Why not Service-Initiated OAuth?** ttyd and code-server have zero OAuth capability. This only works for Jupyter, pgAdmin, and n8n — three out of six+ service types.

**Why not Per-Module OAuth Bridge?** Each module (terminal, VS Code, Jupyter, pgAdmin, n8n) needs its own auth proxy implementation (Python, Node, or shell). This duplicates OAuth logic across five codebases in different languages, with each needing maintenance. The auth guard achieves the same with one binary.

**Why not Protected Service + Token Exchange?** Solves API calls but not browser UI access. User navigating to `https://terminal.uc-xxx...` still hits the service directly with no auth check. A separate mechanism is still needed for browser flows.

**Why not nginx auth_request?** Every single request triggers a subrequest to the gateway for validation. With a VS Code IDE making dozens of requests per second, this creates the same gateway bottleneck as Gateway Proxy. Also requires cookie-based auth.

**Why Auth Guard Proxy wins:**

- **One binary, all services:** A single Go static binary (~10MB) protects ttyd, code-server, Jupyter, and any future service without per-service code.
- **Decentralized:** Auth validation runs inside each container. The gateway is only contacted for OAuth token exchange (once per session) and permission checks (once per session creation/renewal).
- **Domain-independent:** OAuth always flows through the platform domain; custom domain aliases use a signed token relay for cross-domain session establishment (see Section 7.8).
- **Zero service modification:** Services run with auth disabled. The guard handles everything externally.
- **Minimal overhead:** <1ms per request (local reverse proxy). ~5MB RAM. <50ms startup.

---

## 3. Solution: Auth Guard Proxy

### 3.1 Architecture Overview

```
Browser
  ↓
nginx stage 1 (SSL termination, host dev container)
  ↓
nginx stage 2 (gateway container, routes by FQDN)
  ↓  ALL service FQDNs → container VPN IP:GUARD_PORT (single port)
  ↓
┌──────────────────────────────────────────────────────────────────┐
│  User Container                                                   │
│                                                                   │
│  Auth Guard Proxy (Go static binary, port 8443)                   │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ 1. Inspect Host header → identify target service              │ │
│  │ 2. Check session cookie                                       │ │
│  │    ├─ Platform domain: cookie on .uc-{id}.org-{org}.domain   │ │
│  │    ├─ Custom domain: cookie on .myapp.example.com             │ │
│  │    ├─ No cookie (platform) → OAuth redirect to Ganymede       │ │
│  │    ├─ No cookie (custom)  → token relay via platform domain   │ │
│  │    └─ Valid cookie → check permission (cached)                │ │
│  │ 3. Verify permission with gateway (on new session/expiry)     │ │
│  │ 4. Set X-Auth-User-* headers                                 │ │
│  │ 5. Reverse proxy (HTTP + WebSocket) to backend service        │ │
│  └────────────┬──────────────┬──────────────┬───────────────────┘ │
│               ↓              ↓              ↓                     │
│          ttyd:7681    code-server:8080   jupyter:8888              │
│                                                                   │
│  Admin API (localhost:9999, loopback only)                         │
│  ├─ POST /services/register   (service registration)              │
│  ├─ GET  /services            (list registered services)          │
│  └─ GET  /health              (health check)                      │
└──────────────────────────────────────────────────────────────────┘
```

### 3.2 Design Principles

1. **Universal protection** — one binary protects all services, no per-service auth code
2. **Decentralized** — auth validation at the container, gateway only involved for OAuth token exchange and permission checks (infrequent)
3. **Single entry point** — one port per container, host-based routing to backend services
4. **Domain-independent** — OAuth flows through platform domain; custom domain aliases work via token relay (Section 7.8)
5. **Zero service modification** — services run with auth disabled, guard handles everything
6. **Dynamic service registration** — services register at runtime via local admin API

### 3.3 Technology Choice: Go Static Binary

| Requirement          | Go Solution                                              |
| -------------------- | -------------------------------------------------------- |
| No Node.js in images | `CGO_ENABLED=0` static binary, zero dependencies         |
| Binary size          | ~10-15MB stripped                                        |
| HTTP reverse proxy   | `net/http/httputil.ReverseProxy` (stdlib)                |
| WebSocket proxy      | Standard library upgrade handling or `gorilla/websocket` |
| Cross-compilation    | `GOOS=linux GOARCH=amd64` / `GOARCH=arm64`               |
| Startup time         | <50ms                                                    |
| Memory footprint     | ~5-10MB RSS                                              |
| Session management   | In-memory map (no external dependencies)                 |

---

## 4. OAuth Authentication Flow

### 4.1 Platform Auth Architecture Context

```
                    ┌──────────────────┐
                    │    Ganymede       │
                    │  (Central Auth)   │
                    │                   │
                    │  Session cookies  │ ← Browser has sessid cookie here
                    │  OAuth provider   │
                    │  JWT issuer       │
                    └──────┬───────────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
    ┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
    │  Frontend   │ │   Gateway   │ │ Auth Guard  │
    │             │ │             │ │ (container) │
    │  Stores JWT │ │ Validates   │ │ OAuth flow  │
    │  in local-  │ │ JWT from    │ │ → Ganymede  │
    │  Storage    │ │ Auth header │ │             │
    └─────────────┘ └─────────────┘ └─────────────┘
```

The platform uses Ganymede as the OAuth 2.0 Authorization Server. Ganymede:

- Manages user sessions via `sessid` cookies (PostgreSQL-backed, `express-session`)
- Issues JWT access/refresh tokens via OAuth 2.0 authorization code flow
- The gateway does NOT use cookies — it validates JWTs from Authorization headers

### 4.2 Browser Flow (First Visit — User Already Logged In)

```
1. Browser navigates to:
   https://vscode.uc-{cid}.org-{oid}.domain.local/

2. → nginx stage 1 (SSL) → nginx stage 2 → Auth Guard :8443

3. Guard: inspect Host header → route to code-server
   Guard: check session cookie → no cookie found

4. Guard: 302 redirect to Ganymede OAuth:
   https://ganymede.domain.local/oauth/authorize
     ?client_id={container_oauth_client_id}
     &redirect_uri=https://uc-{cid}.org-{oid}.domain.local/__auth/callback
     &response_type=code
     &state={original_url + CSRF token}

5. Ganymede: check sessid session cookie → user IS authenticated
   Ganymede: generate authorization code
   Ganymede: 302 redirect to:
   https://uc-{cid}.org-{oid}.domain.local/__auth/callback?code={code}&state={state}

6. Guard: /__auth/callback handler
   Guard: exchange code for JWT → POST https://ganymede.domain.local/oauth/token
     { grant_type: "authorization_code", code, redirect_uri, client_id, client_secret }
   Ganymede: returns { access_token: JWT, refresh_token, expires_in }

7. Guard: extract user_id from JWT payload
   Guard: *** PERMISSION CHECK ***
   Guard: POST https://org-{oid}.domain.local/containers/{cid}/verify-access
     Authorization: Bearer {jwt}
   Gateway: validate JWT, check permissionManager.hasPermission(user_id, ...)
   Gateway: returns { allowed: true, user: { id, username, display_name } }

8. Guard: create session
   Guard: Set-Cookie: __auth_session={session_id}
     Domain=.uc-{cid}.org-{oid}.domain.local   ← shared across all service subdomains
     Path=/; HttpOnly; Secure; SameSite=Lax
   Guard: 302 redirect to original URL (from state parameter)
   → https://vscode.uc-{cid}.org-{oid}.domain.local/

9. Browser: follows redirect, sends cookie
   Guard: cookie valid → proxy request to code-server :8080
   Guard: adds headers: X-Auth-User-Id, X-Auth-User-Name
```

### 4.3 Login Redirect (Unauthenticated User)

When the user has no Ganymede session (not logged in at all):

```
Steps 1-3: same as above

4. Guard: 302 redirect to Ganymede OAuth authorize

5. Ganymede: check sessid cookie → NO session
   Ganymede: 302 redirect to login page:
   https://domain.local/account/login
     ?redirect=https://ganymede.domain.local/oauth/authorize?...
     &client_id={container_client_id}
     &redirect_uri=https://uc-{cid}.org-{oid}.domain.local/__auth/callback

6. Browser: shows login page
   User: enters email + password, submits

7. Ganymede: POST /login → validates credentials
   Ganymede: creates session, sets sessid cookie
   Ganymede: 302 redirect back to /oauth/authorize (from redirect param)

8-9: same as steps 5-9 in 4.2 (user now has session → authorize succeeds)
```

Total redirects for unauthenticated user: Guard → Ganymede → Login → Ganymede → Guard callback → Original URL (5 redirects, one-time only).

### 4.4 Permission Denied

```
Steps 1-6: same as 4.2

7. Guard: POST /containers/{cid}/verify-access
   Gateway: user does NOT have container access permission
   Gateway: returns { allowed: false }

8. Guard: return 403 Forbidden page
   Page content: "You do not have access to this container.
                  Contact your organization administrator."
```

### 4.5 Session Management

| Property      | Value                                                                                 |
| ------------- | ------------------------------------------------------------------------------------- |
| Storage       | In-memory map (`session_id → session data`)                                           |
| TTL           | Configurable, default 1 hour                                                          |
| Cookie name   | `__auth_session`                                                                      |
| Cookie domain | Platform: `.uc-{containerId}.org-{orgId}.{domain}` / Custom: the custom domain itself |
| Cookie flags  | `HttpOnly`, `Secure`, `SameSite=Lax`                                                  |
| Persistence   | None — container restart = re-auth                                                    |

A single guard may have **multiple active sessions per user** — one for the platform domain, one for each custom domain alias. All sessions share the same in-memory session store and the same user identity. See Section 7.8 for how custom domain sessions are established via token relay.

Session data stored per session:

```go
type Session struct {
    UserID       string
    Username     string
    DisplayName  string
    AccessToken  string    // Ganymede JWT (for refresh/re-check)
    RefreshToken string
    Permissions  []string  // Cached permissions
    OriginDomain string    // Domain this session belongs to (platform FQDN or custom domain)
    CreatedAt    time.Time
    ExpiresAt    time.Time
}
```

### 4.6 Session Renewal and Permission Re-check

When a session expires:

1. Guard detects expired session on next request
2. Guard attempts silent re-auth:
   a. If refresh token available → `POST /oauth/token` with `grant_type=refresh_token`
   b. If refresh fails → full OAuth redirect (user still has Ganymede sessid → instant re-auth)
3. **Permissions are re-checked on every renewal** — this handles permission revocation
4. If permissions revoked → 403 (not re-authed)

Permission revocation latency = session TTL (default 1 hour). Acceptable tradeoff for decentralized auth.

### 4.7 API Access (Non-Browser)

For programmatic access (frontend JavaScript calling container APIs):

```
Frontend → container API:
  Authorization: Bearer {ganymede_jwt}

Guard: no session cookie, but Authorization header present
Guard: validate JWT signature (using Ganymede public key, fetched at startup)
Guard: check permission with gateway
Guard: proxy request to backend service
Guard: does NOT create session (stateless for API calls)
```

The guard validates the JWT locally (using Ganymede's public key) for API calls. This avoids round-trips to Ganymede for every API request. Permission checks are cached per-user with a short TTL.

---

## 5. Permission Model

### 5.1 Permission Check Flow

```
Auth Guard                          Gateway
    │                                   │
    │  POST /containers/{cid}/verify-access
    │  Authorization: Bearer {jwt}      │
    │──────────────────────────────────→│
    │                                   │
    │                        Validate JWT
    │                        Extract user_id
    │                        Check: permissionManager.hasPermission(
    │                          user_id,
    │                          'container:{cid}:access',
    │                          project_id
    │                        )
    │                                   │
    │  { allowed: bool, user: {...} }   │
    │←──────────────────────────────────│
```

### 5.2 Gateway Endpoint

New gateway endpoint (replaces Protected Services):

```
POST /containers/:containerId/verify-access

Auth: JWT (authenticateJwt middleware)
Response:
  200 { allowed: true, user: { id, username, display_name } }
  200 { allowed: false }
  401 (invalid JWT)
  404 (container not found)
```

This endpoint is simpler than Protected Services — it only answers "can this user access this container?". No metadata, no routing info. The guard already knows how to route.

### 5.3 Permission Caching

The guard caches permission check results per-user:

| Cache key    | `user_id:container_id` |
| ------------ | ---------------------- |
| TTL          | Same as session TTL    |
| Invalidation | On session renewal     |
| Storage      | In-memory              |

On session creation: permission checked, result cached.
On session renewal: permission re-checked, cache refreshed.
Between renewals: cached result used (no gateway round-trip).

---

## 6. Service Routing

### 6.1 Host-Based Routing

The guard maintains a routing table mapping Host headers to backend ports:

```
┌───────────────────────────────────────────────┬────────────────────┐
│ Host                                          │ Backend            │
├───────────────────────────────────────────────┼────────────────────┤
│ terminal.uc-xxx.org-yyy.domain.local          │ localhost:7681     │
│ vscode.uc-xxx.org-yyy.domain.local            │ localhost:8080     │
│ jupyterlab.uc-xxx.org-yyy.domain.local        │ localhost:8888     │
│ uc-xxx.org-yyy.domain.local                   │ (auth + relay)     │
│ myapp.example.com                             │ localhost:8080     │  ← custom alias
└───────────────────────────────────────────────┴────────────────────┘
```

The base container FQDN (`uc-xxx.org-yyy.domain.local`) is reserved for the auth callback, cross-domain login, and guard admin pages (session info, health check). Custom domain aliases map directly to a backend service (configured when the alias is created). The guard recognizes custom domains from its `custom_domains` config and handles auth via the token relay flow (Section 7.8).

### 6.2 Service Registration (Admin API)

Services register with the guard via a localhost-only admin API:

```
POST http://localhost:9999/services/register
Content-Type: application/json

{
  "name": "terminal",
  "port": 7681,
  "health_path": "/"       // optional: health check endpoint
}

Response: 200 { "registered": true, "fqdn": "terminal.uc-xxx.org-yyy.domain.local" }
```

```
GET http://localhost:9999/services

Response: 200 {
  "services": [
    { "name": "terminal", "port": 7681, "registered_at": "..." },
    { "name": "vscode", "port": 8080, "registered_at": "..." }
  ]
}
```

The admin API binds to `127.0.0.1:9999` only — not accessible from outside the container.

### 6.3 Dynamic Service Addition

Services can be added to a running container at any time:

1. New service starts (e.g., user installs and starts a local web server)
2. Service calls `map_http_service myapp 3000` (shell function)
3. `map_http_service` registers with local guard admin API
4. `map_http_service` sends collab event to gateway (for frontend listing)
5. Gateway generates FQDN, updates nginx stage 2 routing
6. New service is accessible and protected immediately

### 6.4 Updated `map_http_service`

```bash
# container-functions.sh
map_http_service() {
    local service_name=$1
    local port=$2

    # 1. Register with local auth guard
    curl -s http://localhost:9999/services/register \
      -H "Content-Type: application/json" \
      -d "{\"name\":\"${service_name}\",\"port\":${port}}"

    # 2. Notify gateway (reports GUARD port, not service port)
    # Gateway creates FQDN → nginx stage 2 routes to container:GUARD_PORT
    local payload="{\"user_container_id\":\"${USER_CONTAINER_ID}\",\"name\":\"${service_name}\",\"port\":${AUTH_GUARD_PORT}}"
    curl -s -X POST "https://${GATEWAY_FQDN}/collab/event" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${TOKEN}" \
      -d "{\"type\":\"user-container:map-http-service\",\"payload\":${payload}}"
}
```

### 6.5 Port Unification

All service FQDNs route to the **same container port** (the guard). This simplifies nginx stage 2:

Before (per-service ports):

```
terminal.uc-xxx... → 172.16.1.2:7681
vscode.uc-xxx...   → 172.16.1.2:8080
jupyter.uc-xxx...  → 172.16.1.2:8888
```

After (single guard port):

```
terminal.uc-xxx... → 172.16.1.2:8443
vscode.uc-xxx...   → 172.16.1.2:8443
jupyter.uc-xxx...  → 172.16.1.2:8443
uc-xxx...          → 172.16.1.2:8443   ← base FQDN for auth callback
```

---

## 7. OAuth Client Model

### 7.1 Design Principle: Ganymede Stays Abstract

Ganymede is the platform's central identity and OAuth server. Its responsibilities are all abstract domain concepts: users, organizations, projects, sessions, OAuth clients, JWT signing. It has **zero awareness** of containers, services, Docker, or any infrastructure concept.

The OAuth client registration API follows this principle. Ganymede stores generic OAuth clients (`client_id`, `client_secret`, `redirect_uris`, `grants`). The fact that a client happens to be used by a container auth guard is the gateway's concern, not Ganymede's.

This is the same pattern used by `POST /gateway/tokens/scoped`: _"Ganymede is agnostic to token content — it only validates ownership and signs."_

### 7.2 One Client Per Container

Each container gets ONE OAuth client for the auth guard. Services within the container do NOT get their own clients. The guard is the sole OAuth client.

```
Container lifecycle:
  created  → gateway registers one OAuth client in Ganymede
  running  → auth guard uses client_id/secret for OAuth flows
  deleted  → gateway deletes the OAuth client from Ganymede
```

### 7.3 Ganymede Client Registration API

Ganymede currently only recognizes the global frontend client (`app-main-client-id` hardcoded in `getClient()`). Extension needed:

**New database table:** `oauth_clients`

```sql
CREATE TABLE oauth_clients (
    client_id           VARCHAR(128) PRIMARY KEY,
    client_secret_hash  VARCHAR(256) NOT NULL,       -- bcrypt hash
    redirect_uris       TEXT[]       NOT NULL,        -- exact match list
    grants              TEXT[]       NOT NULL DEFAULT ARRAY['authorization_code'],
    access_token_lifetime  INTEGER   DEFAULT 300,     -- seconds
    refresh_token_lifetime INTEGER   DEFAULT 3600,    -- seconds
    label               VARCHAR(256),                 -- human-readable, optional
    created_by          VARCHAR(128),                 -- who registered it (e.g. "gateway:{id}")
    created_at          TIMESTAMPTZ  DEFAULT NOW(),
    expires_at          TIMESTAMPTZ                   -- NULL = no expiry
);
```

Note: **no `container_id` column**. Ganymede does not know what a container is.

**New internal API endpoints:**

```
POST /internal/oauth/clients
Authorization: X-Gateway-Token (authenticateGatewayToken)

Request:
{
  "redirect_uris": ["https://uc-xxx.org-yyy.domain.local/__auth/callback"],
  "grants": ["authorization_code", "refresh_token"],
  "access_token_lifetime": 300,
  "label": "ephemeral-guard"     // optional, for admin visibility
}

Response: 201
{
  "client_id": "f47ac10b-58cc-...",      ← server-generated UUID
  "client_secret": "a1b2c3d4e5...",      ← returned ONCE, plaintext
  "redirect_uris": ["https://..."],
  "grants": ["authorization_code", "refresh_token"]
}
```

```
DELETE /internal/oauth/clients/:client_id
Authorization: X-Gateway-Token (authenticateGatewayToken)

Response: 200 { "deleted": true }
```

**Key design decisions:**

- **Server-generated credentials:** Ganymede generates both `client_id` (UUID v4) and `client_secret` (crypto random 32 bytes, hex). The caller never provides them. This prevents ID prediction attacks.
- **Secret returned once:** The plaintext secret is returned only in the 201 response. Ganymede stores the bcrypt hash. If the secret is lost, the client must be deleted and re-created.
- **Exact redirect URI matching:** No wildcard patterns. Each redirect URI is stored as-is and matched exactly during authorization. The `@node-oauth/oauth2-server` library already does exact matching. The gateway registers the exact base FQDN callback URL for each container.
- **`getClient()` extension:** Ganymede's OAuth model looks up the database first, falls back to the hardcoded global client.

### 7.4 Security: Threat Model for Client Registration

The client registration endpoint is a **high-value target**. A rogue OAuth client with a controlled `redirect_uri` can intercept authorization codes and exchange them for user JWTs.

#### Threat 1: Unauthorized Client Registration

**Attack:** Attacker without gateway credentials calls `POST /internal/oauth/clients`, registers a client with their own `redirect_uri`, then tricks a user into starting an OAuth flow to steal the auth code.

**Mitigation:**

- **Gateway token authentication** (`authenticateGatewayToken`): Only gateway processes possess this token. It is generated at gateway startup and passed via `POST /gateway/config` from Ganymede itself. Not accessible to containers, users, or the frontend.
- Same protection as existing internal routes (`POST /internal/projects/:id/members`).

#### Threat 2: Redirect URI to External Domain

**Attack:** A compromised or misconfigured gateway registers a client with `redirect_uri: https://evil.com/steal`. Users are redirected there after Ganymede auth, leaking their authorization code.

**Mitigation:**

- **Server-side redirect URI domain validation** at registration time:
  ```
  Ganymede validates: every URI in redirect_uris MUST be a subdomain of DOMAIN config
  e.g., DOMAIN = "apollo.local"
  Allowed:   https://uc-xxx.org-yyy.apollo.local/__auth/callback    ✓
  Allowed:   https://apollo.local/callback                         ✓
  Rejected:  https://evil.com/callback                              ✗
  Rejected:  https://apollo.local.evil.com/callback                 ✗
  ```
- Validation uses `url.hostname.endsWith('.' + DOMAIN) || url.hostname === DOMAIN`
- This is defense-in-depth: even if the gateway is compromised, auth codes can only be redirected to platform-controlled domains.

#### Threat 3: Client Secret Leakage from Database

**Attack:** Database compromise (SQL injection, backup exposure) reveals all client secrets.

**Impact:** Attacker can exchange intercepted auth codes for JWTs — but they also need to intercept the auth code first (requires redirect URI control, covered by Threat 2).

**Mitigation:**

- **bcrypt hash** of `client_secret` stored in database, never plaintext.
- Secret returned only once at creation time.
- If DB is compromised, secrets cannot be recovered from hashes.
- Combined with Threat 2 mitigation, the attack requires both DB compromise AND DNS/network control — defense in depth.

#### Threat 4: Mass Client Registration (DoS)

**Attack:** Attacker with gateway token floods the endpoint to create millions of clients.

**Mitigation:**

- **Rate limiter** on the endpoint (same `apiLimiter` as other internal routes).
- **Per-organization limit**: If needed, enforce max clients per gateway token / per organization (e.g., 1000). Not critical for launch.

#### Threat 5: Orphaned Clients

**Attack vector:** Not an attack per se, but a hygiene risk. Containers die without cleanup → orphaned clients accumulate. Old credentials persist unnecessarily.

**Mitigation:**

- **Gateway deallocation cleanup**: When `POST /gateway/stop` is called, the gateway deletes all OAuth clients it registered for that organization's containers.
- **TTL column** (`expires_at`): Clients can be created with an expiration. `getClient()` rejects expired clients. A background reaper or lazy deletion removes them.
- **created_by field**: Tracks which gateway registered the client, enabling bulk cleanup.

#### Threat 6: Container Escalation

**Attack:** A user inside a container tries to register new OAuth clients (e.g., via `curl https://ganymede.domain.local/internal/oauth/clients`).

**Mitigation:**

- Containers **do not have the gateway token**. They only receive their own `client_id` and `client_secret` via SETTINGS.
- The `/internal/*` routes require `authenticateGatewayToken`, which validates a specific token format that only gateways possess.
- Even if a container somehow reaches Ganymede, the request is rejected at authentication.

#### Threat 7: Client ID Prediction

**Attack:** Attacker predicts the next `client_id` and pre-registers it before the legitimate container.

**Mitigation:**

- **Server-generated UUIDs** (crypto random). Cannot be predicted.
- `INSERT ... ON CONFLICT (client_id)` returns error on collision (does not overwrite).

#### Summary: Protection Layers

```
Layer 1: Network       Only gateways can reach /internal/* (future: network policy)
Layer 2: Auth          authenticateGatewayToken (gateway-only credential)
Layer 3: Redirect URI  Server-side domain validation (must be platform subdomain)
Layer 4: Credentials   Server-generated, bcrypt-hashed, returned once
Layer 5: Rate limit    Standard API rate limiter
Layer 6: Lifecycle     TTL + cleanup on gateway deallocation
Layer 7: Audit         Log all create/delete operations with created_by
```

### 7.6 Cookie Domain Strategy

#### Platform Domain Access

Session cookie set with domain `.uc-{cid}.org-{oid}.{domain}`:

```
Set-Cookie: __auth_session=xxx;
  Domain=.uc-abc123.org-uuid.domain.local;
  Path=/; HttpOnly; Secure; SameSite=Lax
```

This cookie is sent for ALL service subdomains:

- `uc-abc123.org-uuid.domain.local` (base, auth callback)
- `terminal.uc-abc123.org-uuid.domain.local`
- `vscode.uc-abc123.org-uuid.domain.local`
- Any future `*.uc-abc123.org-uuid.domain.local`

One OAuth flow → one cookie → all services in the container are authenticated.

#### Custom Domain Access

Custom domains get a **separate session cookie** on their own domain:

```
Set-Cookie: __auth_session=yyy;
  Domain=myapp.example.com;
  Path=/; HttpOnly; Secure; SameSite=Lax
```

This cookie is established via the **token relay** mechanism (see Section 7.8). The platform domain session and custom domain session are independent cookies but backed by the same user identity. If the platform session expires, the custom domain session remains valid until its own TTL expires.

### 7.7 Redirect URI Strategy

The OAuth callback always uses the **base container FQDN** on the **platform domain**:

```
redirect_uri = https://uc-{cid}.org-{oid}.{domain}/__auth/callback
```

**This is the only registered redirect URI.** Custom domains never appear in redirect URIs. This is a deliberate security decision — it keeps the Threat 2 mitigation intact (all redirect URIs are platform subdomains).

Flow when accessing a service subdomain (platform domain):

1. Browser at `vscode.uc-xxx.org-yyy.domain.local`
2. Guard redirects to Ganymede OAuth (redirect_uri = base FQDN callback)
3. After OAuth, Ganymede redirects to `uc-xxx.org-yyy.domain.local/__auth/callback`
4. Guard sets cookie on `.uc-xxx.org-yyy.domain.local` domain
5. Guard redirects to original URL (`vscode.uc-xxx.org-yyy.domain.local/`)
6. Cookie is sent because `vscode.uc-xxx...` is a subdomain of `.uc-xxx...`

Flow when accessing via custom domain: **See Section 7.8 (Token Relay).**

The base FQDN must be registered in nginx stage 2 (in addition to service FQDNs) and route to the guard port.

Ganymede uses **exact redirect URI matching** (as per `@node-oauth/oauth2-server`). The registered redirect URI is the base FQDN callback only:

- Registered: `https://uc-{cid}.org-{oid}.{domain}/__auth/callback`
- The guard always redirects to this exact URL regardless of which service subdomain or custom domain the user started from. The `state` parameter carries the original URL for the final redirect after auth.

### 7.8 Custom Domain Authentication (Token Relay)

#### The Problem

A user container may be aliased on a custom domain (e.g., `myapp.example.com` → `uc-xxx.org-yyy.apollo.local`). When a browser visits `https://myapp.example.com`:

1. **Redirect URI mismatch:** The registered redirect_uri is `https://uc-xxx.org-yyy.apollo.local/__auth/callback`. Ganymede exact matching rejects `https://myapp.example.com/__auth/callback`.
2. **Cookie domain mismatch:** A cookie set on `.uc-xxx.org-yyy.apollo.local` is never sent for `myapp.example.com` requests.

If the guard redirects to Ganymede OAuth with the platform redirect_uri, the callback hits the platform domain — the custom domain browser tab never gets a session.

#### The Solution: Token Relay

OAuth **always** happens on the platform domain. Custom domains receive sessions via a short-lived, HMAC-signed **relay token**. No changes to Ganymede, no changes to the OAuth client model, no changes to the security threat model.

#### Flow: Custom Domain → Token Relay → Session

```
Browser                   Guard (same binary, same port)       Ganymede
  │                        │                                     │
  │── GET / ─────────────→ │                                     │
  │  Host: myapp.example.com                                     │
  │  (no cookie)           │                                     │
  │                        │ detect: custom domain, no session   │
  │                        │                                     │
  │←── 302 ────────────── │                                     │
  │  Location: https://uc-xxx.org-yyy.domain.local/              │
  │    __auth/cross-domain-login                                 │
  │    ?origin=https://myapp.example.com                         │
  │    &return_to=https://myapp.example.com/                     │
  │                        │                                     │
  │── GET /__auth/cross-domain-login ──→ │                       │
  │  Host: uc-xxx.org-yyy.domain.local   │                       │
  │  Cookie: __auth_session (platform)   │                       │
  │                        │                                     │
  │        ┌───────────────┤                                     │
  │        │ Has platform session?                               │
  │        │  YES → skip OAuth, proceed to relay                 │
  │        │  NO  → full OAuth flow with Ganymede (normal)       │
  │        │        (after OAuth, user gets platform session,    │
  │        │         then continues below)                       │
  │        └───────────────┤                                     │
  │                        │                                     │
  │                        │ Generate relay token:               │
  │                        │   payload = {                       │
  │                        │     user_id, username,              │
  │                        │     origin: "myapp.example.com",    │
  │                        │     exp: now + 30s                  │
  │                        │   }                                 │
  │                        │   token = HMAC-SHA256(secret, payload)
  │                        │                                     │
  │←── 302 ────────────── │                                     │
  │  Location: https://myapp.example.com/                        │
  │    __auth/relay                                              │
  │    ?token=base64(payload.signature)                          │
  │    &return_to=https://myapp.example.com/                     │
  │                        │                                     │
  │── GET /__auth/relay ──→│                                     │
  │  Host: myapp.example.com                                     │
  │                        │                                     │
  │                        │ Validate relay token:               │
  │                        │   verify HMAC signature             │
  │                        │   verify exp > now                  │
  │                        │   verify origin matches Host        │
  │                        │   (optional: verify single-use)     │
  │                        │                                     │
  │                        │ Create session for custom domain    │
  │                        │ Set-Cookie on myapp.example.com     │
  │                        │                                     │
  │←── 302 + Set-Cookie ──│                                     │
  │  Location: https://myapp.example.com/ (return_to)            │
  │  Set-Cookie: __auth_session=yyy;                             │
  │    Domain=myapp.example.com;                                 │
  │    Path=/; HttpOnly; Secure; SameSite=Lax                    │
  │                        │                                     │
  │── GET / ─────────────→ │                                     │
  │  Host: myapp.example.com                                     │
  │  Cookie: __auth_session=yyy                                  │
  │                        │ Valid session → proxy to service    │
  │←── 200 (page content)  │                                     │
```

**Total redirects for unauthenticated custom domain access:** 4 (custom → platform → Ganymede → platform callback → custom relay). If the user already has a platform session: 2 (custom → platform → custom relay).

#### Guard Configuration for Custom Domains

The guard needs to know its custom domain aliases. These are provided in the auth guard config:

```json
{
  "auth_guard": {
    "client_id": "...",
    "client_secret": "...",
    "oauth_issuer": "https://ganymede.apollo.local",
    "gateway_url": "https://org-yyy.apollo.local",
    "base_fqdn": "uc-xxx.org-yyy.apollo.local",
    "custom_domains": ["myapp.example.com", "api.myproject.io"]
  }
}
```

The `custom_domains` array is populated by the gateway when aliases are configured. The guard uses this to:

- Recognize incoming requests on custom domains (vs platform subdomains)
- Set the correct cookie domain per request
- Validate relay token `origin` matches a known custom domain

#### Relay Token Security

| Property     | Value                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------ |
| Algorithm    | HMAC-SHA256                                                                                            |
| Signing key  | Derived from `client_secret`: `HMAC-SHA256(client_secret, "relay-token-key")`                          |
| TTL          | 30 seconds (clock skew tolerance: +5s)                                                                 |
| Payload      | `{ user_id, username, display_name, permissions, origin, nonce, exp }`                                 |
| Single-use   | Optional: guard stores used nonces in memory (TTL = token TTL). Prevents replay within the 30s window. |
| Origin-bound | Token contains `origin` field. Guard rejects tokens where `origin ≠ Host`.                             |
| Scope        | One relay token per custom domain. Cannot be reused on a different custom domain.                      |

**Why this is secure:**

- The relay token is signed with the `client_secret`, which only the guard binary possesses. A token cannot be forged.
- The token is short-lived (30 seconds). It must be consumed immediately.
- The token is origin-bound. A token issued for `myapp.example.com` is rejected on `evil.com`.
- The relay happens in the browser via 302 redirects (no user interaction). The token is in a URL query parameter, which is acceptable because: (a) it expires in 30 seconds, (b) HTTPS encrypts the URL in transit, (c) it's single-use.

#### Why Not Register Custom Domains as redirect_uris?

Rejected alternatives:

1. **Add custom domain to `redirect_uris` array:** Breaks Threat 2 mitigation. Ganymede validates redirect URIs against platform domain. Relaxing this for custom domains means a compromised gateway could register `https://evil.com/callback`. Defense-in-depth lost.

2. **Ganymede custom domain allowlist:** Adds domain concepts to Ganymede (violates abstraction principle). Also requires updating the allowlist whenever aliases change.

3. **Wildcard redirect URIs:** The `@node-oauth/oauth2-server` library does exact matching only. Wildcards require custom code and are a well-known OAuth security risk (see OAuth 2.0 Security Best Current Practice, Section 4.1).

The token relay keeps all OAuth on the platform domain and all custom domain concerns in the guard binary.

---

## 8. Per-Service Integration

### 8.1 Services Without Auth (ttyd, code-server)

These services have no authentication capability. The guard handles everything.

**ttyd (web terminal):**

- Runs on port 7681 with no auth
- Guard authenticates, proxies HTTP and WebSocket
- No changes to ttyd configuration

**code-server (VS Code):**

- Runs with `--auth none --bind-addr 0.0.0.0:8080`
- Guard authenticates, proxies HTTP and WebSocket
- No changes to code-server configuration

### 8.2 Services With OAuth (Jupyter, pgAdmin, n8n)

For services that support OAuth natively, two strategies are available:

**Strategy A: Disable service OAuth, guard handles all auth**

- Service runs in "no auth" or "trusted proxy" mode
- Guard authenticates user, injects identity via headers
- Service reads `X-Auth-User-Id`, `X-Auth-User-Name` headers

**Strategy B: Guard acts as OAuth provider to the service**

- Guard exposes `/__oauth/authorize` and `/__oauth/token` endpoints
- Service is configured to use the guard as its OAuth provider
- When service initiates OAuth, guard already has a session → instant auth code
- Guard issues tokens matching what the service expects

Strategy A is simpler. Strategy B is needed when a service requires OAuth for its internal authorization model (e.g., Jupyter's HubOAuth expects specific user model fields).

### 8.3 Guard as OAuth Provider to Services

For services requiring Strategy B, the guard exposes per-service OAuth endpoints:

```
GET  /__oauth/{service}/authorize   → instant auth code (guard has session)
POST /__oauth/{service}/token       → token exchange
GET  /__oauth/{service}/user        → user info (service-specific format)
```

The `/__oauth/{service}/user` endpoint returns user data in the format the service expects. This is configured per service type.

### 8.4 User Identity Propagation

The guard adds headers to all proxied requests:

```
X-Auth-User-Id: {uuid}
X-Auth-User-Name: {username}
X-Auth-Display-Name: {display_name}
X-Auth-Verified: true
```

Services that support trusted proxy / header-based auth can use these directly.

### 8.5 Jupyter-Specific Considerations

Jupyter uses `jupyterhub-singleuser` which has a built-in `HubOAuth` authentication layer. This layer:

1. Redirects unauthenticated users to an OAuth authorize URL
2. Exchanges auth codes for tokens
3. Validates tokens against a Hub API (`/hub/api/user`)
4. Expects a specific user model: `{ name, kind, admin, groups, roles, scopes }`

**Current state:** The Jupyter OAuth integration has multiple issues:

- `ACCOUNT_FQDN` is undefined in container environment
- `dynredir` redirect URI handler does not exist
- OAuth clients are registered in gateway memory, not Ganymede
- Hub API (`/jupyterlab/user`) endpoint does not exist

**Solution options:**

**Option 1: Replace `jupyterhub-singleuser` with plain `jupyter-lab`**

- Run `jupyter lab` directly (not as JupyterHub singleuser server)
- Disable token/password auth: `--ServerApp.token='' --ServerApp.password=''`
- Guard handles all authentication
- Simplest approach, removes JupyterHub dependency
- Tradeoff: loses JupyterHub-specific features (activity tracking via Hub protocol)

**Option 2: Guard emulates JupyterHub API**

- Guard exposes Hub-compatible endpoints on the Jupyter service FQDN:
  - `GET /__oauth/jupyterlab/authorize` → OAuth authorize
  - `POST /__oauth/jupyterlab/token` → token exchange
  - `GET /__oauth/jupyterlab/user` → returns `{ name, kind: "user", admin: false, ... }`
- Jupyter configured to use guard as Hub
- Preserves full JupyterHub singleuser functionality
- More complex but fully compatible

**Recommendation:** Start with Option 1 (plain `jupyter-lab`). Implement Option 2 later if JupyterHub-specific features are needed. The auth guard architecture supports both.

### 8.6 pgAdmin / n8n Considerations

Both support standard OAuth2. Two approaches:

**Approach A (simple):** Disable their OAuth, run in trusted proxy mode. pgAdmin supports `AUTHENTICATION_SOURCES: ["webserver"]` with `WEBSERVER_REMOTE_USER` header. n8n supports header-based auth.

**Approach B (OAuth):** Configure them to use guard's `/__oauth/{service}/authorize` and `/__oauth/{service}/token`. Guard returns tokens in the format they expect.

Start with Approach A. Move to Approach B only if needed.

---

## 9. WebSocket Support

Many container services rely on WebSocket connections (ttyd terminal, code-server editor, Jupyter kernel communication).

### 9.1 WebSocket Authentication

WebSocket connections start with an HTTP upgrade request. The guard authenticates at the upgrade step:

```
Browser: GET /ws (or similar)
  Upgrade: websocket
  Connection: Upgrade
  Cookie: __auth_session=xxx

Guard:
  1. Check session cookie → valid
  2. Forward upgrade request to backend service
  3. Transparent bidirectional frame proxying

If no valid session:
  Guard: 401 Unauthorized (cannot redirect during WS upgrade)
  Frontend: must authenticate via HTTP first, then retry WS
```

### 9.2 WebSocket Proxy

After the upgrade:

- Guard transparently proxies frames in both directions
- No per-frame inspection or auth (authenticated at upgrade time)
- Connection lifetime is unlimited (ttyd sessions can last hours)
- Go's `httputil.ReverseProxy` handles upgrade; if more control is needed, `gorilla/websocket` can be used

### 9.3 API WebSocket (Bearer Token)

For programmatic WebSocket connections (frontend to container):

```
Browser: GET /ws?token={jwt}
  Upgrade: websocket

Guard:
  1. No session cookie, check ?token query param
  2. Validate JWT signature
  3. Check permission
  4. Forward upgrade
```

---

## 10. Binary Distribution

### 10.1 Build and Cross-Compilation

```makefile
# packages/modules/user-containers/auth-guard/Makefile
BINARY=auth-guard
GOFLAGS=-trimpath -ldflags="-s -w"

build-linux-amd64:
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build $(GOFLAGS) -o $(BINARY)-linux-amd64

build-linux-arm64:
	CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build $(GOFLAGS) -o $(BINARY)-linux-arm64

build-all: build-linux-amd64 build-linux-arm64
```

### 10.2 Distribution via bootstrap-tools Image

The auth guard binary is shipped via the existing `bootstrap-tools` scratch image:

```dockerfile
# packages/modules/user-containers/docker-images/base/Dockerfile
FROM scratch

COPY container-functions.sh /holistix/container-functions.sh
COPY auth-guard-linux-amd64 /holistix/auth-guard
```

All container images already copy from this image:

```dockerfile
FROM holistixforge/bootstrap-tools:latest AS tools
COPY --from=tools /holistix/ /usr/local/bin/
```

The guard binary is available in all containers at `/usr/local/bin/auth-guard`.

### 10.3 Container Entrypoint Changes

Updated entrypoint pattern:

```bash
#!/bin/bash
source /usr/local/bin/container-functions.sh

# Start VPN in background
start_vpn &

# Start auth guard proxy
auth-guard \
  --listen-port ${AUTH_GUARD_PORT:-8443} \
  --admin-port 9999 \
  --ganymede-url "https://${GANYMEDE_FQDN}" \
  --gateway-url "https://${GATEWAY_FQDN}" \
  --client-id "${AUTH_GUARD_CLIENT_ID}" \
  --client-secret "${AUTH_GUARD_CLIENT_SECRET}" \
  --container-id "${USER_CONTAINER_ID}" \
  --cookie-domain ".uc-${USER_CONTAINER_ID}.org-${ORGANIZATION_ID}.${DOMAIN}" \
  --session-ttl 3600 &

# Wait for guard to be ready
wait_for_port 8443

# Start services
start-ttyd.sh &
map_http_service terminal 7681

# ... other services

wait
```

### 10.4 SETTINGS Extension

The container SETTINGS JSON gains auth guard fields:

```json
{
  "user_id": "uuid",
  "project_id": "uuid",
  "frontend_fqdn": "domain.local",
  "ganymede_fqdn": "ganymede.domain.local",
  "gateway_fqdn": "org-xxx.domain.local",
  "auth_guard": {
    "client_id": "uuid",
    "client_secret": "uuid",
    "container_id": "uc-xxx",
    "organization_id": "org-yyy"
  }
}
```

The `container-functions.sh` extracts these:

```bash
AUTH_GUARD_CLIENT_ID=$(echo "$JSON_SETTINGS" | jq -r '.auth_guard.client_id')
AUTH_GUARD_CLIENT_SECRET=$(echo "$JSON_SETTINGS" | jq -r '.auth_guard.client_secret')
ORGANIZATION_ID=$(echo "$JSON_SETTINGS" | jq -r '.auth_guard.organization_id')
```

---

## 11. Infrastructure Changes

### 11.1 Nginx Stage 2 Changes

**Current:** Per-service server blocks with different backend ports.

**New:** All service FQDNs for a container route to the same guard port. Additionally, the base container FQDN is registered for the auth callback.

```bash
# update-nginx-locations.sh
# Input: fqdn container_ip guard_port
# All FQDNs for a container use the same IP:port

server {
    listen ${GATEWAY_HTTP_PORT};
    server_name ${fqdn};

    location / {
        proxy_pass http://${container_ip}:${guard_port};
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

### 11.2 Nginx Stage 1 Changes

The regex `server_name` in nginx stage 1 (Ganymede's `nginx-manager.ts`) already matches nested subdomains:

```nginx
server_name ~^(.+\.)?org-{uuid}\.domain\.local$;
```

This matches `vscode.uc-xxx.org-yyy.domain.local` and `uc-xxx.org-yyy.domain.local`. No changes needed.

### 11.3 Ganymede OAuth Extension

Changes to Ganymede (all abstract, no container concepts):

1. **New DB table:** `oauth_clients` (see [Section 7.3](#73-ganymede-client-registration-api) for schema)
2. **New internal API:** `POST /internal/oauth/clients` and `DELETE /internal/oauth/clients/:client_id` (gateway-token protected)
3. **OAuth model extension:** `getClient()` does DB lookup first, falls back to hardcoded global client. `app-main-client-id` becomes a seed row in the `oauth_clients` table.
4. **Redirect URI domain validation:** Server-side check that all redirect URIs are subdomains of the platform `DOMAIN` config (see [Section 7.4, Threat 2](#threat-2-redirect-uri-to-external-domain))
5. **Client secret hashing:** Store bcrypt hash, return plaintext once at creation
6. **Public key endpoint:** Already exists (`GET /oauth/public-key`), guard uses it at startup

### 11.4 Gateway Changes

1. **New endpoint:** `POST /containers/:containerId/verify-access`
   - Validates JWT, checks container access permission
   - Returns allowed/denied + user info
2. **OAuth client registration:** Changes from per-service (gateway memory) to per-container (Ganymede database)
3. **Container SETTINGS generation:** Include `auth_guard` config block

### 11.5 Container Config Generation

`servers-reducer.ts` changes in `_new()`:

```typescript
// Register ONE OAuth client per container (in Ganymede, via abstract API)
// Gateway calls Ganymede's internal API — Ganymede generates credentials.
// Ganymede does not know this is for a container.
const { client_id, client_secret } = await ganymedeApi.post(
  '/internal/oauth/clients',
  {
    redirect_uris: [
      `https://uc-${containerId}.org-${orgId}.${domain}/__auth/callback`,
    ],
    grants: ['authorization_code', 'refresh_token'],
    access_token_lifetime: 300,
    label: `guard-${containerId}`, // optional, for admin visibility only
  }
);

// Include auth guard config in SETTINGS
const config = {
  ...existingConfig,
  auth_guard: {
    client_id,
    client_secret,
    container_id: containerId,
    organization_id: orgId,
  },
};
```

On container deletion (`_remove()`):

```typescript
// Cleanup: delete OAuth client from Ganymede
await ganymedeApi.delete(
  `/internal/oauth/clients/${config.auth_guard.client_id}`
);
```

---

## 12. Code to Remove

> **Status: Complete.** All legacy code listed below has been removed as of March 2026.

### 12.1 Protected Services — Complete Removal

The Protected Services feature is replaced entirely by the auth guard. All code is deleted without tombstone comments.

**Files to delete entirely:**
| File | Content |
|------|---------|
| `packages/modules/gateway/src/lib/protected-service-registry.ts` | `ProtectedServiceRegistry` class and types |
| `packages/app-gateway/src/routes/protected-services.ts` | `/svc/:serviceId` route handler |
| `doc/architecture/PROTECTED_SERVICES.md` | Protected Services documentation |
| `doc/architecture/USER_CONTAINER_SERVICE_PROTECTION.md` | Research document (superseded by this doc) |

**Source files to modify (remove Protected Service references):**
| File | What to Remove |
|------|----------------|
| `packages/modules/gateway/src/index.ts` | Import, export, and type field for `ProtectedServiceRegistry` |
| `packages/app-gateway/src/main.ts` | Import and route setup for `setupProtectedServicesRoutes` |
| `packages/app-gateway/src/initialization/gateway-init.ts` | `ProtectedServiceRegistry` import, instantiation, and passing to modules |
| `packages/app-gateway/src/config/modules.ts` | `ProtectedServiceRegistry` parameter and usage |
| `packages/app-gateway/src/module/module.ts` | `ProtectedServiceRegistry` in config type and exports |
| `packages/modules/user-containers/src/index.ts` | Entire protected service registration block (lines ~102-161) |
| `packages/modules/user-containers/src/lib/servers-reducer.spec.ts` | `protectedServiceRegistry` mocks |
| `packages/modules/jupyter/src/lib/stories/jupyter-module.stories.tsx` | `protectedServiceRegistry` mock |

**Documentation to update (remove Protected Service references):**
| File | What to Remove |
|------|----------------|
| `doc/architecture/GATEWAY_ARCHITECTURE.md` | `ProtectedServiceRegistry` subsection |
| `doc/architecture/PERMISSION_SYSTEM.md` | "In Protected Services" code example |
| `doc/architecture/OVERVIEW.md` | "5. Protected Services" subsection |
| `doc/reference/API.md` | `/svc/{serviceId}` endpoint entry |
| `doc/guides/LOCAL_DEVELOPMENT.md` | `/svc/*` route listing |
| `doc/archive/PERMISSIONS_RBAC_PLANNING.md` | Protected service code example |
| `doc/archive/2024-container-refactor/CONTAINER_FEATURE_DESIRED_IMPLEMENTATION.md` | "Protected Services for Container-Terminals" subsection |
| `packages/modules/gateway/README.md` | Protected service references |
| `packages/modules/user-containers/README.md` | "Protected Service" subsection |

### 12.2 Gateway OAuth Simplification

With the auth guard handling container auth via Ganymede, the gateway's OAuth endpoints become less critical. Evaluate for removal:

| Endpoint                   | Current Use                    | After Auth Guard                 |
| -------------------------- | ------------------------------ | -------------------------------- |
| `GET /oauth/authorize`     | Container OAuth flows          | Not needed (guard uses Ganymede) |
| `POST /oauth/token`        | Container token exchange       | Not needed                       |
| `POST /oauth/authenticate` | Container token validation     | Not needed                       |
| `OAuthManager` class       | In-memory client/token storage | Not needed                       |

These can be removed after all containers migrate to the auth guard. Keep during transition.

### 12.3 Per-Service OAuth Client Registration

Current `createOAuthClients()` in `servers-reducer.ts` creates per-service OAuth clients in gateway memory. This is replaced by per-container client registration in Ganymede.

Remove:

- `createOAuthClients()` method (replace with single Ganymede client registration)
- `deleteOAuthClients()` method (replace with single Ganymede client deletion)
- Per-service `oauthClients` arrays in module image definitions (Jupyter, pgAdmin, n8n)

---

## 13. Test Strategy

Tests are written BEFORE implementation (TDD).

### 13.1 Auth Guard Unit Tests (Go)

```
auth-guard/
  proxy/
    router_test.go          # Host-based routing
    proxy_test.go           # HTTP and WebSocket reverse proxy
  auth/
    oauth_test.go           # OAuth flow (mock Ganymede)
    session_test.go         # Session CRUD, expiry, cookie handling
    middleware_test.go       # Auth check middleware
    permission_test.go      # Permission caching and validation
    jwt_test.go             # JWT signature validation
  admin/
    api_test.go             # Service registration admin API
  integration_test.go       # Full flow with mock backends
```

**Router tests:**

```
TestRouterHostRouting
  - routes request to correct backend based on Host header
  - returns 502 when backend service not registered
  - returns 503 when backend service is down
  - handles base FQDN (auth callback) separately from service FQDNs

TestRouterServiceRegistration
  - registers service via admin API
  - rejects duplicate service names
  - lists registered services
  - handles dynamic service addition (new service after startup)
```

**OAuth tests:**

```
TestOAuthRedirect
  - redirects unauthenticated request to Ganymede OAuth
  - includes correct client_id, redirect_uri, state, response_type
  - preserves original URL in state parameter
  - includes CSRF token in state

TestOAuthCallback
  - exchanges authorization code for JWT token
  - handles invalid code (Ganymede returns error)
  - handles network error to Ganymede
  - extracts user info from JWT payload

TestOAuthPermissionCheck
  - calls gateway verify-access after token exchange
  - handles permission granted → creates session
  - handles permission denied → returns 403
  - handles gateway unreachable → returns 502

TestCustomDomainRedirect
  - redirects unauthenticated custom domain request to platform cross-domain-login
  - includes origin and return_to parameters
  - does NOT redirect to Ganymede directly (always via platform domain)
```

**Token relay tests:**

```
TestTokenRelayGeneration
  - generates HMAC-SHA256 signed relay token
  - token contains user_id, origin, exp, nonce
  - token TTL is 30 seconds
  - derives signing key from client_secret

TestTokenRelayValidation
  - accepts valid relay token and creates session
  - rejects expired token (> 30s + 5s skew)
  - rejects token with wrong origin (token for domainA, request on domainB)
  - rejects token with invalid HMAC signature
  - rejects replayed token (same nonce used twice)

TestCrossDomainLogin
  - with platform session: generates relay token, redirects to custom domain
  - without platform session: triggers OAuth flow, then relay
  - rejects unknown custom domain (not in config)

TestCustomDomainSession
  - sets cookie on custom domain after relay
  - cookie domain matches custom domain (not platform domain)
  - session is independent from platform domain session
  - session renewal works (re-triggers relay from platform)
```

**Session tests:**

```
TestSessionCreation
  - creates session with correct user data
  - sets cookie with correct domain, flags
  - cookie domain covers service subdomains

TestSessionValidation
  - accepts valid session cookie
  - rejects expired session
  - rejects tampered session ID
  - rejects session for wrong container

TestSessionRenewal
  - refreshes token on session expiry
  - re-checks permissions on renewal
  - handles permission revocation on renewal (→ 403)
  - handles refresh token failure (→ full re-auth)
```

**Permission tests:**

```
TestPermissionCaching
  - caches permission result for session duration
  - refreshes cache on session renewal
  - uses cached result for subsequent requests (no gateway call)

TestPermissionDenied
  - returns 403 page when user lacks container access
  - does not create session on permission denied
```

**JWT validation tests:**

```
TestJwtValidation
  - validates JWT signature against Ganymede public key
  - rejects expired JWT
  - rejects JWT with wrong issuer
  - extracts user_id and username from payload
```

**WebSocket tests:**

```
TestWebSocketUpgrade
  - authenticates WebSocket upgrade via session cookie
  - authenticates WebSocket upgrade via Bearer token in query param
  - rejects unauthenticated WebSocket upgrade
  - proxies frames bidirectionally after upgrade
```

**API access tests:**

```
TestBearerTokenAuth
  - accepts Bearer token in Authorization header
  - validates JWT signature
  - checks permission for API calls
  - does not create session for API calls (stateless)
```

### 13.2 Integration Tests

Tests with real HTTP servers (Go `httptest`):

```
TestFullBrowserFlow
  - mock Ganymede OAuth + mock gateway + mock backend service
  - simulate: first visit → OAuth redirect → callback → permission check → proxy

TestFullApiFlow
  - mock gateway + mock backend service
  - simulate: API call with Bearer token → JWT validation → permission check → proxy

TestMultiServiceContainer
  - register multiple services
  - authenticate once, access all services with same cookie

TestServiceAddedAtRuntime
  - start guard with one service
  - add second service via admin API
  - access second service (same session cookie works)
```

### 13.3 E2E Tests

Full stack tests using Playwright and real infrastructure:

```
TestE2E_UnauthenticatedAccess
  - navigate to container service URL without login
  - verify redirect to login page
  - login with test user credentials
  - verify redirect back to container service
  - verify service is accessible

TestE2E_PermissionDenied
  - create container in org A
  - login as user without org A access
  - navigate to container URL
  - verify 403 page shown

TestE2E_SessionExpiry
  - login and access container service
  - wait for session to expire (or use short TTL)
  - make new request
  - verify silent re-auth (no login prompt)

TestE2E_PermissionRevocation
  - login and access container service
  - revoke user's container access permission
  - wait for session to expire
  - verify 403 on next request

TestE2E_WebSocketThroughGuard
  - login and access ttyd terminal
  - verify WebSocket connection established
  - type command in terminal, verify output

TestE2E_MultipleServicesOneCookie
  - container with terminal + vscode services
  - login via terminal URL
  - navigate to vscode URL (different subdomain)
  - verify no re-auth required (shared cookie)

TestE2E_DynamicServiceAddition
  - create container, access terminal
  - add new service to running container
  - access new service URL
  - verify protected and accessible
```

---

## 14. Implementation Phases

> **Implementation Status (March 2026):**
>
> - Phase 1 (Ganymede OAuth Client API): Complete
> - Phase 2 (Go Auth Guard Binary): Complete
> - Phase 3 (Gateway Integration): Complete
> - Phase 4 (Container Integration): Complete
> - Phase 5 (Service Adapters): Complete
> - Phase 6 (Legacy Removal): Complete
> - Phase 7 (E2E Tests + CI): Complete

### Phase 1: Auth Guard Core (Go Binary)

**Goal:** Working auth guard with OAuth flow, permission checks, HTTP proxy.

**Deliverables:**

- Go project structure with tests
- OAuth client (authorize redirect, callback, token exchange)
- Session management (in-memory, cookie-based)
- Host-based HTTP reverse proxy
- Admin API (service registration)
- Permission check via gateway endpoint
- JWT validation for API access
- Unit and integration tests passing

**No container integration yet** — tested standalone with mock services.

### Phase 2: Ganymede OAuth Extension

**Goal:** Ganymede supports dynamic OAuth client registration (fully abstract, no container concepts).

**Deliverables:**

- New `oauth_clients` database table with bcrypt secret hashing
- `POST /internal/oauth/clients` endpoint (server-generated credentials, gateway-token auth)
- `DELETE /internal/oauth/clients/:client_id` endpoint (gateway-token auth)
- Redirect URI domain validation (must be platform subdomain)
- OAuth model `getClient()` extended to DB lookup (global client becomes seed row)
- `app-main-client-id` migrated from hardcoded constant to DB seed row
- Audit logging on all client create/delete operations
- Tests for endpoints, model, domain validation, and threat mitigations

### Phase 3: Gateway Integration

**Goal:** Gateway creates auth guard clients and has verify-access endpoint.

**Deliverables:**

- `POST /containers/:containerId/verify-access` endpoint
- Container SETTINGS generation includes `auth_guard` config
- OAuth client registration changed: per-container in Ganymede (not per-service in gateway)
- nginx stage 2 routing uses single guard port
- Protected Services code removed

### Phase 4: Container Integration

**Goal:** Auth guard running in all container images.

**Deliverables:**

- Auth guard binary in `bootstrap-tools` image
- Updated `container-functions.sh` (extract auth guard config, updated `map_http_service`)
- Updated container entrypoints (start guard before services)
- Ubuntu terminal container working with guard
- VS Code container working with guard

### Phase 5: Service-Specific Adapters

**Goal:** Jupyter, pgAdmin, n8n working through guard.

**Deliverables:**

- Jupyter: switch to plain `jupyter-lab` (or guard Hub API emulation)
- pgAdmin: trusted proxy mode or guard OAuth provider
- n8n: trusted proxy mode or guard OAuth provider
- Per-service OAuth clients removed from image definitions
- Gateway OAuth endpoints removed (if no longer needed)

### Phase 6: E2E Tests and Cleanup

**Goal:** Full stack validated, legacy code removed.

**Deliverables:**

- E2E tests passing (Playwright)
- All documentation updated
- Gateway OAuth endpoints evaluated for removal
- Per-service `oauthClients` arrays removed from module definitions
- Old research documents deleted

---

## 15. Load Distribution Analysis

```
                       Current Architecture          With Auth Guard
                       ────────────────────          ───────────────
Request auth:          None (unprotected)      →     Each container (guard)
OAuth flows:           N/A                     →     Ganymede (infrequent, first visit only)
Permission checks:     N/A                     →     Gateway (infrequent, on session create/renew)
Hot path traffic:      nginx → container       →     nginx → guard → service (guard is local, <1ms overhead)
Bottleneck:            N/A (no auth)           →     None (distributed across containers)
Gateway load:          Unchanged               →     +1 lightweight endpoint (verify-access)
Ganymede load:         Unchanged               →     +OAuth flows (first visit per container per session)
```

The guard adds <1ms latency per request (local reverse proxy). OAuth flows add ~200-500ms on first visit only. Permission checks add one gateway round-trip on session creation/renewal only.

---

## 16. Open Questions

1. **Session TTL value:** Default 1 hour. Should it be configurable per-organization? Per-container?

2. **Ganymede session lifetime:** If Ganymede's `sessid` cookie expires (30 days default), silent re-auth works. If user explicitly logs out of Ganymede, what happens to container sessions? (They continue until their own TTL expires.)

3. **Multi-architecture builds:** Currently targeting linux/amd64. Should arm64 be supported from the start?

4. **Guard admin API authentication:** Currently unauthenticated (localhost-only). Should there be a shared secret?

5. **CORS handling:** For API calls from frontend to container services, the guard must add CORS headers. Should allowed origins be derived from the platform domain automatically?

6. **Jupyter approach:** Option 1 (plain jupyter-lab) vs Option 2 (guard emulates Hub API). Start with Option 1, or is Hub API emulation needed from day one?

7. **Container-to-container access:** If container A needs to call container B's API, how does it authenticate? (Currently out of scope — containers communicate via gateway collab events.)

8. **Custom domain alias lifecycle:** When a custom domain alias is added/removed, how does the guard learn about it? Options: (a) gateway pushes updated config to guard's admin API, (b) guard polls gateway periodically, (c) guard reloads config from SETTINGS file. Option (a) is likely best — immediate, no polling overhead.

9. **Custom domain DNS validation:** Should the platform verify that a custom domain's DNS (CNAME) actually points to the container before accepting the alias? This prevents users from claiming domains they don't control. The gateway could verify DNS resolution before registering the alias.

10. **Custom domain SSL certificates:** Custom domains need valid TLS certificates. Options: (a) Let's Encrypt via ACME challenge, (b) user-provided certificates, (c) Cloudflare/proxy-based. This is an infrastructure concern outside the auth guard scope but affects the end-to-end flow.

---

## Appendix A: Request Flow Diagrams

### Browser Request (Authenticated Session)

```
Browser                  nginx s1    nginx s2    Auth Guard    Service
  │                        │           │            │            │
  │──GET /file.txt────────→│           │            │            │
  │  Host: vscode.uc-x...  │           │            │            │
  │  Cookie: __auth_session │           │            │            │
  │                        │──proxy──→│            │            │
  │                        │           │──proxy──→ │            │
  │                        │           │            │            │
  │                        │           │            │─check cookie│
  │                        │           │            │─valid!      │
  │                        │           │            │            │
  │                        │           │            │─add headers─│
  │                        │           │            │──proxy────→│
  │                        │           │            │            │
  │                        │           │            │←─response──│
  │←───────────────────────│───────────│────────────│            │
```

### OAuth Flow (First Visit)

```
Browser              Guard          Ganymede        Login Page      Gateway
  │                    │               │               │              │
  │──GET /──────────→ │               │               │              │
  │  (no cookie)       │               │               │              │
  │                    │               │               │              │
  │←─302 /oauth/authz─│               │               │              │
  │                    │               │               │              │
  │──GET /oauth/authz─────────────→  │               │              │
  │  (sessid cookie)   │               │               │              │
  │                    │          check session        │              │
  │                    │          user authenticated   │              │
  │←─302 callback?code=───────────── │               │              │
  │                    │               │               │              │
  │──GET /callback────→│               │               │              │
  │                    │──POST /token─→│               │              │
  │                    │←─{jwt,refresh}│               │              │
  │                    │               │               │              │
  │                    │──POST /verify-access──────────────────────→ │
  │                    │←─{allowed:true,user}──────────────────────  │
  │                    │               │               │              │
  │←─302 + Set-Cookie──│               │               │              │
  │                    │               │               │              │
  │──GET / (cookie)──→ │               │               │              │
  │                    │──proxy to service             │              │
  │←─response──────── │               │               │              │
```

### Custom Domain Token Relay Flow

```
Browser                   Guard (platform domain)      Guard (same binary)
  │                              │                           │
  │── GET / ────────────────────────────────────────────────→│
  │  Host: myapp.example.com     │                           │
  │  (no cookie for this domain) │                           │
  │                              │                           │
  │←─ 302 ──────────────────────────────────────────────────│
  │  → uc-xxx.../                │                           │
  │    __auth/cross-domain-login │                           │
  │    ?origin=myapp...          │                           │
  │                              │                           │
  │── GET /__auth/cross-domain-login →│                      │
  │  Host: uc-xxx...             │                           │
  │  Cookie: __auth_session      │                           │
  │  (platform session exists)   │                           │
  │                              │                           │
  │                         validate session                 │
  │                         generate relay token             │
  │                         (HMAC-signed, 30s TTL)           │
  │                              │                           │
  │←─ 302 ──────────────────────│                           │
  │  → myapp.example.com/       │                           │
  │    __auth/relay?token=xxx   │                           │
  │                              │                           │
  │── GET /__auth/relay ────────────────────────────────────→│
  │  Host: myapp.example.com     │                           │
  │                              │                           │
  │                              │        validate HMAC      │
  │                              │        check expiry       │
  │                              │        verify origin      │
  │                              │        create session     │
  │                              │                           │
  │←─ 302 + Set-Cookie ────────────────────────────────────│
  │  Cookie: __auth_session=yyy  │                           │
  │  Domain=myapp.example.com    │                           │
  │  → myapp.example.com/ (return_to)                        │
  │                              │                           │
  │── GET / (with cookie) ──────────────────────────────────→│
  │                              │        valid session      │
  │←─ 200 (proxied response)  ──────────────────────────────│
```

Note: "Guard (platform domain)" and "Guard (same binary)" are the **same process** — the guard binary listens on one port and handles all domains (platform FQDNs + custom domains). Shown separately for clarity.

---

## Appendix B: File Changes Summary

### New Files

| File                                                         | Description                                        |
| ------------------------------------------------------------ | -------------------------------------------------- |
| `packages/modules/user-containers/auth-guard/`               | Go module (entire directory)                       |
| `packages/modules/user-containers/auth-guard/main.go`        | Entry point                                        |
| `packages/modules/user-containers/auth-guard/proxy/`         | Reverse proxy and router                           |
| `packages/modules/user-containers/auth-guard/auth/`          | OAuth, session, JWT, permissions                   |
| `packages/modules/user-containers/auth-guard/admin/`         | Service registration API                           |
| `packages/modules/user-containers/auth-guard/Makefile`       | Build targets                                      |
| `packages/app-gateway/src/routes/container-access.ts`        | `POST /containers/:id/verify-access`               |
| `packages/app-ganymede/src/routes/internal/oauth-clients.ts` | Abstract OAuth client CRUD (no container concepts) |
| `packages/app-ganymede/database/schema/XX-oauth-clients.sql` | `oauth_clients` table + seed row for global client |

### Modified Files

| File                                                                            | Change                                                                            |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `packages/modules/user-containers/docker-images/base/Dockerfile`                | Add guard binary                                                                  |
| `packages/modules/user-containers/docker-images/base/container-functions.sh`    | Extract auth guard config, update `map_http_service`                              |
| `packages/modules/user-containers/docker-images/ubuntu/container-entrypoint.sh` | Start guard before services                                                       |
| `packages/modules/vscode/docker-images/vscode-server/container-entrypoint.sh`   | Start guard before services                                                       |
| `packages/modules/jupyter/docker-image/container-entrypoint.sh`                 | Start guard, switch to plain jupyter-lab                                          |
| `packages/modules/jupyter/docker-image/start-singleuser.sh`                     | Remove OAuth config (guard handles)                                               |
| `packages/modules/n8n/docker-image/container-entrypoint.sh`                     | Start guard before services                                                       |
| `packages/modules/pgadmin4/docker-image/container-entrypoint.sh`                | Start guard before services                                                       |
| `packages/modules/user-containers/src/lib/servers-reducer.ts`                   | Per-container OAuth client (Ganymede), auth guard config in SETTINGS              |
| `packages/app-ganymede/src/models/oauth.ts`                                     | `getClient()` DB lookup, bcrypt secret comparison, remove hardcoded global client |
| `docker-images/backend-images/gateway/app/bin/update-nginx-locations.sh`        | All FQDNs → guard port                                                            |

### Deleted Files

See [Section 12](#12-code-to-remove) for complete deletion inventory (4 files deleted entirely, 8 source files modified, 9 docs updated).

---

## Appendix C: Related Documentation

- [Gateway Architecture](../architecture/GATEWAY_ARCHITECTURE.md) — nginx stages, request routing
- [Permission System](../architecture/PERMISSION_SYSTEM.md) — RBAC, permission checking
- [Multi-Project Architecture](./MULTI_PROJECT_ARCHITECTURE.md) — gateway lifecycle, project management
- [User Containers Implementation Status](../guides/USER_CONTAINERS_IMPLEMENTATION_STATUS.md) — feature progress tracking
