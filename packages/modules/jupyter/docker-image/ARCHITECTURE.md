# JupyterLab Docker Image - Architecture

This document describes the internals of the JupyterLab user container: what processes run inside it, how authentication and identity work, and how the container integrates with the platform's routing layer.

## Overview

Each Jupyter container runs several cooperating processes:

| Process                      | Port                       | Role                                                                                                                                                                                    |
| ---------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Auth Guard Proxy** (Go)    | 8443 (HTTPS), 9999 (admin) | Entry point for all browser traffic. Authenticates users via OAuth with Ganymede, sets session cookies, injects `X-Auth-*` identity headers, and routes to registered backend services. |
| **Hub OAuth Proxy** (Python) | 15000 (localhost)          | Emulates the minimum JupyterHub API surface so `jupyterhub-singleuser` can perform OAuth and resolve per-user identity. Reads identity from `X-Auth-*` headers injected by Auth Guard.  |
| **jupyterhub-singleuser**    | 8888                       | JupyterLab server with `jupyter-collaboration` for real-time multi-user editing. Uses JupyterHub's OAuth machinery to identify each browser session.                                    |
| **Activity Server** (Python) | 8000                       | Receives activity pings from `jupyterhub-singleuser` and forwards them to the gateway as `user-containers:activity` events.                                                             |
| **OpenVPN**                  | -                          | Connects the container to the gateway's VPN network for private communication.                                                                                                          |

## Component Diagram

```
Browser
  │
  │ HTTPS (*.local domain)
  ▼
┌──────────────────┐
│  Nginx (host)    │  Resolves FQDN, TLS termination, proxies to gateway
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Nginx (gateway) │  Routes to allocated user container via VPN
└────────┬─────────┘
         │ VPN tunnel
         ▼
┌──────────────────────────────────────────────────────────┐
│  User Container                                          │
│                                                          │
│  ┌─────────────────────┐                                 │
│  │  Auth Guard (:8443) │◄── all browser requests enter   │
│  │                     │    here; OAuth + session cookie  │
│  └──┬──────────┬───────┘                                 │
│     │          │                                         │
│     │ X-Auth-* │ X-Auth-*                                │
│     │ headers  │ headers                                 │
│     ▼          ▼                                         │
│  ┌────────┐ ┌──────────────────┐                         │
│  │ jupyter│ │  Hub OAuth Proxy │ (:15000, localhost)      │
│  │ lab    │ │  registered as   │                         │
│  │ (:8888)│ │  __guard_hub     │                         │
│  └────────┘ └──────────────────┘                         │
│                                                          │
│  ┌──────────────────┐  ┌──────────┐                      │
│  │ Activity (:8000) │  │ OpenVPN  │                      │
│  └──────────────────┘  └──────────┘                      │
└──────────────────────────────────────────────────────────┘
```

## Authentication Flow

Authentication happens in two stages. Stage 1 establishes the user's session with Auth Guard. Stage 2 gives `jupyterhub-singleuser` a per-user identity so `jupyter-collaboration` shows real usernames on cursors and edits.

### Stage 1: Auth Guard OAuth (browser session)

1. Browser navigates to `https://jupyterlab.uc-{id}.org-{org}.{domain}/`
2. Auth Guard has no session cookie - redirects browser to Ganymede OAuth (`/oauth/authorize`)
3. User authenticates with Ganymede (or already has a Ganymede session)
4. Ganymede redirects back to Auth Guard's callback with an authorization code
5. Auth Guard exchanges the code for tokens, creates a session cookie, and sets `AUTH_GUARD_RUNNING=1`
6. All subsequent requests include the session cookie; Auth Guard injects `X-Auth-User-Id`, `X-Auth-User-Name`, `X-Auth-User-Email` headers before proxying to backend services

### Stage 2: Hub OAuth Proxy (JupyterLab identity)

7. Auth Guard proxies the browser to `jupyterhub-singleuser` on port 8888
8. `jupyterhub-singleuser` has no JupyterHub OAuth session - redirects to its configured authorization URL: `https://__guard_hub.uc-{id}.org-{org}.{domain}/hub/api/oauth2/authorize`
9. This request goes through Auth Guard (which injects `X-Auth-*` headers) and reaches Hub OAuth Proxy on localhost:15000
10. Hub OAuth Proxy reads the real user identity from `X-Auth-*` headers, generates an auth code, and redirects back to `jupyterhub-singleuser`'s `/oauth_callback`
11. `jupyterhub-singleuser` exchanges the auth code for an access token via `POST http://localhost:15000/hub/api/oauth2/token` (server-to-server, no Auth Guard in the path)
12. `jupyterhub-singleuser` calls `GET http://localhost:15000/hub/api/user` with the access token to get the JupyterHub user model
13. Hub OAuth Proxy returns a user model with `name` set to the real user's username
14. `jupyter-collaboration` now shows the real user identity on cursors and edits

## Hub OAuth Proxy

### Why it exists

`jupyter-collaboration` (real-time collaborative editing) requires JupyterHub's identity system to know who each connected user is. Without a real JupyterHub deployment, the Hub OAuth Proxy emulates the minimum API surface needed.

### Endpoints

| Method | Path                             | Purpose                                                                    |
| ------ | -------------------------------- | -------------------------------------------------------------------------- |
| `GET`  | `/health`                        | Health check                                                               |
| `GET`  | `/hub/api`                       | Version check (returns `X-JupyterHub-Version: 4.0.0`)                      |
| `GET`  | `/hub/api/oauth2/authorize`      | Browser-facing: reads `X-Auth-*` headers, issues auth code, redirects back |
| `POST` | `/hub/api/oauth2/token`          | Server-to-server: exchanges auth code for access token                     |
| `GET`  | `/hub/api/user`                  | Returns JupyterHub user model from access token                            |
| `GET`  | `/hub/api/authorizations/token`  | Token validation (alias for `/hub/api/user`)                               |
| `POST` | `/hub/api/users/{name}/activity` | Activity ping (no-op, returns 200)                                         |

### In-memory state

The proxy stores auth codes and access tokens in memory (no persistence needed since containers are ephemeral):

- **Auth codes**: TTL of 5 minutes, cleaned up every 60 seconds
- **Access tokens**: TTL of 24 hours, cleaned up every 60 seconds
- **Hub API token**: Shared secret generated at container startup, used by `jupyterhub-singleuser` for server-to-server calls

### Identity resolution

The authorize endpoint reads identity from headers injected by Auth Guard:

- `X-Auth-User-Name` / `X-Auth-Username` - used as the JupyterHub `name` field
- `X-Auth-User-Id` - platform user ID
- `X-Auth-User-Email` - user email

If no headers are present, the user is identified as `anonymous`.

## Container Startup Sequence

The entrypoint is `container-entrypoint.sh`, invoked via `tini -g --`:

```
1. source container-functions.sh     # Load shared utilities
2. start_auth_guard                  # Start Auth Guard on :8443/:9999
                                     #   - Builds domain from GATEWAY_FQDN
                                     #   - Configures OAuth with Ganymede
                                     #   - Waits up to 15s for health check
                                     #   - Sets AUTH_GUARD_RUNNING=1
3. vpn_loop (background)             # OpenVPN + watchdog monitoring
4. map_http_service jupyterlab 8888  # Register JupyterLab with Auth Guard
   (background)                      #   and report port 8443 to gateway
5. Generate HUB_API_TOKEN            # Random shared secret (secrets.token_hex)
6. Start hub-oauth-proxy             # Python HTTP server on localhost:15000
   (background)                      #   --api-token for server-to-server auth
7. Health check hub proxy            # Poll /health up to 20 times (5s max)
8. Register __guard_hub service      # POST to Auth Guard admin API (:9999)
                                     #   so browser requests to __guard_hub
                                     #   FQDN reach the hub proxy
9. Build FQDNs                       # JUPYTER_FQDN, HUB_FQDN from env vars
10. Start activity-server.py         # Activity relay on :8000
    (background)
11. exec start.sh jupyterhub-        # Hands off to jupyter/docker-stacks
    singleuser                       #   start.sh (root -> jovyan switch)
                                     #   with all JUPYTERHUB_* env vars
```

## Environment Variables

These are set by `container-entrypoint.sh` before launching `jupyterhub-singleuser`:

| Variable                         | Value                                          | Purpose                                                      |
| -------------------------------- | ---------------------------------------------- | ------------------------------------------------------------ |
| `JUPYTERHUB_API_TOKEN`           | Random hex (generated at startup)              | Shared secret for server-to-server auth with Hub OAuth Proxy |
| `JUPYTERHUB_SERVICE_PREFIX`      | `/`                                            | URL prefix for the JupyterLab server                         |
| `JUPYTERHUB_SERVICE_URL`         | `http://0.0.0.0:8888/`                         | Where `jupyterhub-singleuser` listens                        |
| `JUPYTERHUB_USER`                | `jupyter-user`                                 | Static JupyterHub user name (for scope matching)             |
| `JUPYTERHUB_BASE_URL`            | `/`                                            | Base URL for JupyterHub paths                                |
| `JUPYTERHUB_CLIENT_ID`           | `jupyterlab-local`                             | OAuth client identifier                                      |
| `JUPYTERHUB_OAUTH_ACCESS_SCOPES` | `["access:servers!server=jupyter-user/", ...]` | OAuth scopes for access control                              |
| `JUPYTERHUB_OAUTH_SCOPES`        | Same as above                                  | OAuth scopes (some versions read this)                       |
| `JUPYTERHUB_OAUTH_CALLBACK_URL`  | `https://{JUPYTER_FQDN}/oauth_callback`        | Where Jupyter sends the browser after OAuth                  |

### Auth Guard settings (from SETTINGS env var)

The `SETTINGS` base64-encoded JSON provides Auth Guard with:

| Field                                    | Purpose                           |
| ---------------------------------------- | --------------------------------- |
| `oauth_clients.jupyterlab.client_id`     | Ganymede OAuth client ID          |
| `oauth_clients.jupyterlab.client_secret` | Ganymede OAuth client secret      |
| `container_id`                           | User container ID (used in FQDN)  |
| `organization_id`                        | Organization ID (used in FQDN)    |
| `gateway_fqdn`                           | Gateway domain for building FQDNs |
| `token`                                  | Platform JWT token                |

## Docker Images

Two image variants are provided, sharing the same entrypoint and authentication layer:

### Dockerfile-minimal

- **Base**: `quay.io/jupyter/minimal-notebook:lab-4.2.0`
- **Use case**: General-purpose notebooks (Python, basic data science)
- **Size**: Smallest image

### Dockerfile-pytorch

- **Base**: `quay.io/jupyter/scipy-notebook:lab-4.2.0`
- **Use case**: Machine learning with PyTorch + CUDA
- **Extra packages**: `torch`, `torchvision`, `torchaudio` (CUDA 12.4)

### Common layers installed on both

| Layer                           | Source                                | Contents                                                                                                         |
| ------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `holistixforge/bootstrap-tools` | `user-containers/docker-images/base/` | `container-functions.sh`, `extract_settings`, `start_auth_guard`, `map_http_service`, `vpn_loop`, `watchdog`     |
| `holistixforge/ttyd-tools`      | `user-containers/docker-images/ttyd/` | `ttyd` binary, `tmux`, web terminal support                                                                      |
| `jupyter-collaboration`         | pip install                           | Real-time collaborative editing extension                                                                        |
| Container-specific scripts      | `jupyter/docker-image/`               | `container-entrypoint.sh`, `hub-oauth-proxy.py`, `activity-server.py`, `start-singleuser.sh`, `page_config.json` |
| System packages                 | apt                                   | `jq`, `curl`, `openvpn`, `iputils-ping`, `pciutils`                                                              |

### Build commands

```bash
# Minimal
docker build -t holistixforge/jupyter-minimal:latest \
  -f packages/modules/jupyter/docker-image/Dockerfile-minimal \
  packages/modules/jupyter/docker-image/

# PyTorch
docker build -t holistixforge/jupyter-pytorch:latest \
  -f packages/modules/jupyter/docker-image/Dockerfile-pytorch \
  packages/modules/jupyter/docker-image/
```

## Service FQDN Routing

Each service inside the container gets a unique FQDN:

```
{service}.uc-{container_id}.org-{organization_id}.{domain}
```

Examples:

- `jupyterlab.uc-abc123.org-def456.apollo.local` - JupyterLab
- `__guard_hub.uc-abc123.org-def456.apollo.local` - Hub OAuth Proxy
- `ttyd.uc-abc123.org-def456.apollo.local` - Web terminal

### How routing works

1. Services register with Auth Guard's admin API (`POST localhost:9999/services/register`) providing their name and port
2. Auth Guard builds a routing table: service name to localhost port
3. `map_http_service` reports port 8443 (Auth Guard) to the gateway, not the actual service port
4. Host Nginx receives the FQDN request, proxies to the gateway
5. Gateway Nginx proxies to the container's Auth Guard on port 8443
6. Auth Guard extracts the service name from the FQDN subdomain and proxies to the registered localhost port

## Known Limitations

- **`--skip-permission-check` workaround**: Auth Guard currently uses this flag because gateway permission verification fails with Ganymede OAuth tokens. The gateway JWT format (nested `{user: {id, username}}`) doesn't match what the permission check expects from OAuth-issued tokens. This means Auth Guard authenticates users but doesn't verify per-resource permissions with the gateway.

- **Gateway JWT format mismatch**: Ganymede OAuth tokens use a different JWT structure than gateway-issued tokens. This needs investigation to unify the token formats or teach the gateway to accept both.

- **No token persistence**: Hub OAuth Proxy stores tokens in memory. If the container restarts, all JupyterHub sessions are invalidated and users must re-authenticate. This is acceptable for ephemeral containers.

- **Static JUPYTERHUB_USER**: All users share the same JupyterHub user name (`jupyter-user`) for scope matching. Individual identity comes from the `name` field in the user model returned by Hub OAuth Proxy, not from `JUPYTERHUB_USER`.

## Cross-References

- [Auth Guard Proxy Design](../../../../doc/current-works/AUTH_GUARD_PROXY.md) - Full Auth Guard architecture, OAuth flow, permission model, and service routing
- [User Containers Implementation Status](../../../../doc/guides/USER_CONTAINERS_IMPLEMENTATION_STATUS.md) - Container lifecycle, runner system, and implementation roadmap
- [Auth Guard Source](../../../modules/user-containers/auth-guard/) - Go source code for the Auth Guard binary
- [Bootstrap Tools](../../../modules/user-containers/docker-images/base/container-functions.sh) - Shared shell functions (`start_auth_guard`, `map_http_service`, `vpn_loop`)
