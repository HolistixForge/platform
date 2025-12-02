# Docker Images

This directory contains all Docker image definitions for the Demiurge platform.

## Directory Structure

```
docker-images/
├── backend-images/      # Platform infrastructure images
│   └── gateway/         # Gateway container (app-gateway + OpenVPN + Nginx)
└── user-images/         # User-deployed container images
    ├── demiurge-functions.sh  # Shared bootstrap functions
    ├── ubuntu/          # Minimal Ubuntu terminal container
    ├── jupyterlab/      # JupyterLab notebook environments
    ├── pgadmin4/        # pgAdmin database management
    └── n8n/             # n8n workflow automation
```

---

## Backend Images

### Gateway Container

**Location:** `backend-images/gateway/`  
**Purpose:** Gateway pool containers that provide collaboration, OAuth, VPN, and routing

**Components:**
- **app-gateway** (Node.js) - Collaboration engine, OAuth provider, event processor
- **Nginx (Stage 2)** - Routes user container FQDNs to VPN IPs
- **OpenVPN Server** - VPN network for user containers (172.16.0.0/16)

**See:** `backend-images/gateway/README.md` for complete documentation

---

## User Container Images

All user container images follow the same bootstrap pattern:

### Common Bootstrap (`demiurge-functions.sh`)

**Responsibilities:**
- Extract settings from `SETTINGS` environment variable (base64-encoded JSON)
- Connect to gateway via OpenVPN
- Send periodic watchdog events (system stats)
- Map HTTP services to gateway

**Architecture:**
- **Distinct FQDNs**: Each container gets `uc-{uuid}.org-{uuid}.domain.local`
- **No internal nginx**: Gateway routes FQDNs directly to VPN IP:port
- **Service registration**: Containers call `map_http_service` to advertise services

### Ubuntu Terminal

**Image:** `demiurge/ubuntu-terminal:24.04`  
**Location:** `user-images/ubuntu/`  
**Services:** Web terminal only (ttyd on port 7681)

**Use case:**
- Minimal terminal-only container for quick shell access
- Useful for debugging, scripting, system administration

**Registered as:** Built-in image `ubuntu:terminal` in `user-containers` module

### JupyterLab

**Images:**
- `public.ecr.aws/f3g9x7j4/demiurge-jmn:lab-4.2.0` - Minimal notebook
- `public.ecr.aws/f3g9x7j4/demiurge-jpn:lab-4.2.0` - PyTorch notebook

**Location:** `user-images/jupyterlab/`  
**Services:** JupyterLab on port 8888

**Registered as:** `jupyter:minimal` and `jupyter:pytorch` in `jupyter` module

### pgAdmin4

**Image:** `dpage/pgadmin4:8.12.0` (extended)  
**Location:** `user-images/pgadmin4/`  
**Services:** pgAdmin on port 5050

### n8n

**Image:** `docker.n8n.io/n8nio/n8n:1.97.1` (extended)  
**Location:** `user-images/n8n/`  
**Services:** n8n on port 5678

---

## Container Bootstrap Flow

All user containers follow this startup sequence:

1. **Extract settings** from `SETTINGS` env var:
   - `gateway_fqdn`, `token`, `user_container_id`, `project_id`, etc.

2. **Connect to gateway VPN**:
   - Call `GET https://{gateway_fqdn}/collab/vpn-config` with JWT
   - Receive OpenVPN certificates and config
   - Connect to gateway at VPN IP `172.16.0.1`

3. **Start application services**:
   - Each image starts its own services (JupyterLab, pgAdmin, ttyd, etc.)

4. **Map HTTP services to gateway**:
   - Call `POST http://172.16.0.1/collab/event` with event `user-container:map-http-service`
   - Gateway registers service and updates nginx routing

5. **Periodic watchdog**:
   - Send `user-container:watchdog` events every 15s with system stats
   - Gateway uses this to detect container health

---

## Distinct FQDN Routing

Each container gets a distinct FQDN that routes directly to its VPN IP. The browser accesses containers at stable URLs that never change regardless of gateway allocation.

**Routing flow:** Browser → Stage 1 Nginx (SSL) → Gateway Container → Stage 2 Nginx (FQDN routing) → User Container (VPN IP)

**Architecture benefits:**
- No path prefixes needed
- Services use root path
- No internal nginx in containers
- Stable, bookmarkable URLs

---

## Adding a New User Container Image

Container images must:
1. Install required packages: tini, jq, curl, openvpn, iputils-ping, pciutils
2. Copy demiurge-functions.sh from shared location
3. Create entrypoint that: starts VPN loop, starts application, maps HTTP services
4. Register image definition in a module via imageRegistry

For terminal support, install ttyd, start it on a port, and map a "terminal" service.

See existing images (ubuntu, jupyterlab, pgadmin4, n8n) for reference implementations.

---

## Related Documentation

- [Gateway Architecture](../doc/architecture/GATEWAY_ARCHITECTURE.md) - Gateway and VPN setup
- [Protected Services](../doc/architecture/PROTECTED_SERVICES.md) - Protected service system
- [Local Development](../doc/guides/LOCAL_DEVELOPMENT.md) - Testing container images locally

