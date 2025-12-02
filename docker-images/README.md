# Docker Images

This directory contains Docker image definitions for the Demiurge platform.

## Directory Structure

```
docker-images/
├── backend-images/      # Platform infrastructure images
│   └── gateway/         # Gateway container (app-gateway + OpenVPN + Nginx)
└── user-images/         # Shared user container bootstrap
    └── demiurge-functions.sh  # Common bootstrap functions
```

---

## Backend Images

### Gateway Container

**Location:** `backend-images/gateway/`  
**Purpose:** Gateway pool containers providing collaboration, OAuth, VPN, and routing

**Components:**
- app-gateway (Node.js) - Collaboration engine, OAuth provider, event processor
- Nginx (Stage 2) - Routes user container FQDNs to VPN IPs
- OpenVPN Server - VPN network for user containers (172.16.0.0/16)

**See:** `backend-images/gateway/README.md`

---

## User Container Images

User container images are located in their respective module directories. Each module owns its Docker image and registers it via the imageRegistry.

**See:** `user-images/README.md` for complete documentation on:
- Shared bootstrap functions
- Container architecture and bootstrap flow
- Distinct FQDN routing
- Adding new container images


---

## Related Documentation

- [User Container Bootstrap](user-images/README.md) - Complete user container guide
- [Gateway Architecture](../doc/architecture/GATEWAY_ARCHITECTURE.md) - Gateway and VPN
- [User Containers Module](../packages/modules/user-containers/README.md) - Image registry
- [Local Development](../doc/guides/LOCAL_DEVELOPMENT.md) - Testing images

