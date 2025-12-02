# User Containers Module

Manages Docker container lifecycle for user-deployed applications, including image registry, container runners, stable DNS URLs, and protected terminal access.

## Features

- **Container Management**: Create, delete, and manage Docker containers
- **Image Registry**: Centralized registry for container image definitions (built-in and module-defined)
- **Container Runners**: Pluggable runner system supporting local and cloud deployments
- **Stable URLs**: DNS-based stable URLs with distinct FQDNs per container (`uc-{uuid}.org-{uuid}.domain.local`)
- **OAuth Integration**: Automatic OAuth client registration for containers
- **Permission System**: Fine-grained permissions for container operations
- **Terminal Access**: Web-based terminal access for all containers via ttyd integration

## API

Exports `imageRegistry` for managing container images, `registerContainerRunner` for adding custom runners, and `getRunner` for accessing runners. Registers permissions for create, delete, host, and terminal operations. Manages shared data for containers and images.

### Built-in Container Images

The module provides a built-in Ubuntu terminal image:

- **`ubuntu:terminal`** - Minimal Ubuntu 24.04 container with only ttyd web terminal
  - Image URI: `demiurge/ubuntu-terminal:24.04`
  - Category: utility
  - Services: `terminal` on port 7681
  - No OAuth clients (terminal-only utility)

## Dependencies

- `core-graph`: For graph node integration
- `collab`: For shared data
- `reducers`: For event processing
- `gateway`: For OAuth, DNS, and permissions

## Terminal Access

Terminal access is available for any container image that:

1. Runs **ttyd** (web-based terminal server)
2. Registers a **`terminal` HTTP service** via `user-container:map-http-service` event

**How it works:**

- Container runs: `ttyd -p 7681 /bin/bash`
- Container maps service: `map_http_service terminal 7681`
- Gateway registers the service with distinct FQDN: `uc-{uuid}.org-{uuid}.domain.local`
- Frontend constructs terminal URL using `serviceUrl(container, 'terminal')`
- User clicks "Open Terminal" → opens ttyd web UI in new tab

**Protected Service:**

The module registers a protected service `user-containers:terminal` that:
- Checks permission: `user-containers:[user-container:{id}]:terminal`
- Resolves to terminal service metadata (host, port, secure)
- Can be queried via gateway `/svc/user-containers:terminal?user_container_id=...`

**Permission:**

Users need `user-containers:[user-container:*]:terminal` permission to access terminals.

---

## Exports

- `TUserContainersExports`: Container management interface
- `TUserContainer`: Container type definition
- `TContainerImageDefinition`, `TContainerImageInfo`: Image types
- `ContainerImageRegistry`: Image registry class
- `ContainerRunner`: Runner interface
- `serviceUrl`: Helper for generating container URLs
- Event types: `TEventNew`, `TEventDelete`, `TEventWatchdog`, `TEventMapHttpService`

