# User Container Bootstrap

This directory contains shared bootstrap functions used by all user container images.

## Files

**container-functions.sh** - Common bootstrap functions

**Functions:**
- `extract_settings` - Parse SETTINGS env var (base64 JSON)
- `start_vpn` - Connect to gateway OpenVPN
- `watchdog` - Send system stats to gateway
- `vpn_loop` - Maintain VPN connection and send periodic watchdog
- `map_http_service` - Register HTTP services with gateway

---

## Container Architecture

**Distinct FQDNs:** Each container gets `uc-{uuid}.org-{uuid}.domain.local`  
**No internal nginx:** Gateway routes FQDNs directly to VPN IP:port  
**Service registration:** Containers call `map_http_service` to advertise services

**Routing:** Browser → Stage 1 Nginx (SSL) → Gateway → Stage 2 Nginx (FQDN routing) → Container (VPN IP)

**Benefits:**
- No path prefixes needed
- Services use root path
- Stable, bookmarkable URLs

---

## Container Bootstrap Flow

All user containers follow this startup sequence:

1. Extract settings from SETTINGS env var (gateway_fqdn, token, user_container_id, project_id, oauth_clients)
2. Connect to gateway VPN via GET /collab/vpn-config
3. Start application services on designated ports
4. Map HTTP services to gateway via POST /collab/event
5. Send periodic watchdog events every 15s with system stats

---

## Adding a New User Container Image

1. Create module directory: `packages/modules/yourmodule/`
2. Add `docker-image/` subdirectory with Dockerfile and entrypoint
3. Install required packages: tini, jq, curl, openvpn, iputils-ping, pciutils
4. Copy container-functions.sh using relative path: `../../docker-images/user-images/container-functions.sh`
5. Create entrypoint: start VPN loop, start application, map HTTP services
6. Create `src/backend.ts` to register image via imageRegistry
7. Export moduleBackend from `src/index.ts`
8. Add module to gateway's module loading list

For terminal support: install ttyd, start on port 7681, map "terminal" service.

---

## Related Documentation

- [User Containers Module](../../packages/modules/user-containers/README.md) - Image registry and terminal access
- [Gateway Architecture](../../doc/architecture/GATEWAY_ARCHITECTURE.md) - VPN and routing
- [Protected Services](../../doc/architecture/PROTECTED_SERVICES.md) - Terminal service architecture


