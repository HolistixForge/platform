# User Container Images

This directory contains the **Holistix Bootstrap Tools** - shared files and the bootstrap image used by all user container images.

## Architecture

User containers wrap third-party images (Jupyter, n8n, pgAdmin, etc.) with Holistix-specific functionality:

- **VPN connection** to gateway for secure communication
- **Authentication** via JWT tokens
- **Service registration** with gateway
- **Health monitoring** via watchdog events

Since third-party images use different base distros (Ubuntu, Alpine, Debian, etc.), we can't use a single base image. Instead, we use a **multi-stage build pattern**:

```
┌─────────────────────────────────┐
│  holistixforge/bootstrap-tools  │  ← Contains shared files only
└─────────────────────────────────┘
                │
                │ COPY --from
                ▼
┌─────────────────────────────────┐
│    Third-party base image       │  ← Any distro (Ubuntu, Alpine, etc.)
│    + Holistix tools copied in   │
│    + Distro-specific packages   │
└─────────────────────────────────┘
```

## Files

| File                     | Description                                   |
| ------------------------ | --------------------------------------------- |
| `Dockerfile`             | Builds `holistixforge/bootstrap-tools` image  |
| `container-functions.sh` | Shared bootstrap functions for all containers |

## Bootstrap Tools Image

The `holistixforge/bootstrap-tools` image is a minimal image (based on `scratch`) that only contains shared files. It's used as a source for `COPY --from` in user container Dockerfiles.

### Building the Bootstrap Tools Image

```bash
# From repo root
docker build -t holistixforge/bootstrap-tools:latest packages/modules/user-containers/docker-images/base/

# Push to registry (if needed)
docker push holistixforge/bootstrap-tools:latest
```

## container-functions.sh

Shared shell functions sourced by all user container entrypoints.

### Functions

| Function           | Description                                                      |
| ------------------ | ---------------------------------------------------------------- |
| `extract_settings` | Parse `SETTINGS` env var (base64 JSON) into individual variables |
| `start_vpn`        | Connect to gateway OpenVPN using `/collab/vpn-config` endpoint   |
| `vpn_loop`         | Maintain VPN connection and send periodic watchdog events        |
| `watchdog`         | Send system stats (CPU, memory, disk, network) to gateway        |
| `map_http_service` | Register an HTTP service with the gateway                        |
| `get_system_info`  | Collect system metrics for watchdog                              |

### Environment Variables (after extract_settings)

| Variable            | Description                                        |
| ------------------- | -------------------------------------------------- |
| `GATEWAY_FQDN`      | Gateway hostname (e.g., `org-{uuid}.domain.local`) |
| `TOKEN`             | JWT token for gateway authentication               |
| `PROJECT_ID`        | Project UUID                                       |
| `USER_CONTAINER_ID` | Container UUID                                     |
| `HOST_USER_ID`      | User UUID                                          |
| `FRONTEND_FQDN`     | Frontend hostname                                  |
| `GANYMEDE_FQDN`     | Ganymede API hostname                              |

---

## Creating a New User Container Image

### Step 1: Create Module Directory Structure

```
packages/modules/your-module/
├── src/
│   ├── index.ts          # Module exports
│   └── backend.ts        # Image registration
└── docker-images/
    └── your-image/
        ├── Dockerfile
        └── container-entrypoint.sh
```

### Step 2: Write the Dockerfile

```dockerfile
# Stage 1: Get shared Holistix tools
FROM holistixforge/bootstrap-tools:latest AS tools

# Stage 2: Build from third-party base
FROM third-party/image:tag

USER root

# Install required packages (distro-specific)
# For Ubuntu/Debian:
RUN apt-get update && apt-get install -y --no-install-recommends \
    tini jq curl openvpn iputils-ping pciutils \
  && rm -rf /var/lib/apt/lists/*

# For Alpine:
# RUN apk add --no-cache tini jq curl openvpn iputils pciutils

# Copy Holistix bootstrap tools
COPY --from=tools /holistix/container-functions.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/container-functions.sh

# Copy your entrypoint
COPY container-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/container-entrypoint.sh

ENTRYPOINT ["tini", "-g", "--", "container-entrypoint.sh"]
```

### Step 3: Write the Entrypoint

```bash
#!/bin/sh

# Source Holistix bootstrap functions
. /usr/local/bin/container-functions.sh

# Start VPN + watchdog loop in background
sh -c '. /usr/local/bin/container-functions.sh && vpn_loop' &

# Start your application
your-application --port 8080 &

# Map your service to gateway
sh -c '. /usr/local/bin/container-functions.sh && map_http_service your-service 8080' &

# Keep container running
tail -f /dev/null
```

### Step 4: Register the Image

In `src/backend.ts`:

```typescript
import { TModule } from '@holistix-forge/module';
import { TUserContainersBackendExports } from '@holistix-forge/user-containers';

export const moduleBackend: TModule<
  { 'user-containers': TUserContainersBackendExports },
  Record<string, never>
> = {
  name: 'your-module',
  version: '0.0.1',
  dependencies: ['user-containers'],
  load: ({ depsExports }) => {
    depsExports['user-containers'].imageRegistry.register({
      imageId: 'your-module:your-image',
      imageName: 'Your Image Name',
      imageDescription: 'Description of your image',
      imageUri: 'holistixforge/your-image',
      imageTag: 'latest',
      category: 'utility', // or 'development', 'database', etc.
      oauth_clients: [], // OAuth services needed, if any
    });
  },
};
```

### Step 5: Build and Push

```bash
# Build bootstrap-tools first (if not already built)
docker build -t holistixforge/bootstrap-tools:latest packages/modules/user-containers/docker-images/base/

# Build your image
docker build -t holistixforge/your-image:latest packages/modules/your-module/docker-images/your-image/

# Push to registry
docker push holistixforge/your-image:latest
```

---

## Required Packages by Distro

### Ubuntu/Debian (apt)

```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends \
    tini jq curl openvpn iputils-ping pciutils \
  && rm -rf /var/lib/apt/lists/*
```

### Alpine (apk)

```dockerfile
RUN apk add --no-cache tini jq curl openvpn iputils pciutils
```

### RHEL/CentOS (dnf/yum)

```dockerfile
RUN dnf install -y tini jq curl openvpn iputils pciutils && dnf clean all
```

### Optional: Web Terminal (ttyd)

If your container needs a web terminal:

```dockerfile
# Ubuntu/Debian
RUN apt-get install -y ttyd

# Alpine
RUN apk add --no-cache ttyd
```

Then in entrypoint:

```bash
ttyd -p 7681 /bin/bash &
map_http_service terminal 7681 &
```

---

## Container Lifecycle

1. **Startup**: Container starts, `SETTINGS` env var contains base64-encoded JSON config
2. **Extract Settings**: `extract_settings` parses config into environment variables
3. **VPN Connect**: `start_vpn` fetches VPN config from gateway and connects
4. **Service Start**: Application starts on designated port
5. **Service Registration**: `map_http_service` tells gateway about the service
6. **Watchdog Loop**: Every 15s, sends system stats to gateway
7. **Routing**: Gateway routes `uc-{uuid}.org-{uuid}.domain.local` to container via VPN

---

## Troubleshooting

### VPN Connection Issues

```bash
# Check if VPN is connected
docker exec <container> pgrep openvpn

# Check VPN logs
docker exec <container> cat /tmp/vpn-*/client.ovpn

# Test gateway connectivity
docker exec <container> ping 172.16.0.1
```

### Service Not Accessible

```bash
# Check if service is registered
docker exec <container> cat /tmp/gateway

# Check gateway logs for map-http-service events
docker exec gw-pool-<env>-4 grep "map-http-service" /tmp/gateway.log
```

---

## Related Documentation

- [User Containers Module](../../packages/modules/user-containers/README.md)
- [Gateway Architecture](../../doc/architecture/GATEWAY_ARCHITECTURE.md)
- [Auth Guard Proxy](../../doc/current-works/AUTH_GUARD_PROXY.md)
