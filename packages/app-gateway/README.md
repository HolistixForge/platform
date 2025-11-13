# app-gateway (Gateway)

Gateway application that runs per-organization for real-time collaboration.

## Purpose

App-gateway is the **gateway** process that handles:

- Real-time collaboration via Yjs CRDT
- WebSocket connections for state synchronization
- Event processing through module reducers
- Permission validation
- OAuth2 provider for container applications
- Container management and networking (OpenVPN)
- Reverse proxy (Nginx) for container services

## Architecture

- **One gateway per organization** - All projects within an organization share the same gateway
- **Module-based** - Features implemented as pluggable modules
- **Stateful** - Manages both shared (Yjs) and non-shared (persistent) state

See [doc/architecture/OVERVIEW.md](../../doc/architecture/OVERVIEW.md) for system architecture.

## Key Features

### Collaboration

- Yjs CRDT for conflict-free shared state
- WebSocket synchronization with frontend
- Real-time updates across all connected clients

### State Management

- **Shared State (Yjs):** Graph nodes, containers, chat messages, tabs
- **Non-Shared State (JSON):** Permissions, OAuth clients/tokens, container tokens

### Modules

- `core` - Graph/node system
- `user-containers` - Container management
- `jupyter` - JupyterLab integration
- `chats` - Chat functionality
- `space`, `tabs`, etc.

## Development

See [doc/guides/LOCAL_DEVELOPMENT.md](../../doc/guides/LOCAL_DEVELOPMENT.md) for local setup.

**Build:**

```bash
npx nx run app-gateway:build
```

**Run locally:**

```bash
# Gateway runs as part of local dev environment
/root/.local-dev/dev-001/start.sh
```

## Deployment

Gateway containers are deployed on-demand when organizations start projects.

See [doc/guides/PRODUCTION_DEPLOYMENT.md](../../doc/guides/PRODUCTION_DEPLOYMENT.md) for deployment details.

## Related Documentation

- [Architecture Overview](../../doc/architecture/OVERVIEW.md)
- [Gateway Implementation Details](../../doc/current-works/GATEWAY_WORK.md)
- [Gateway Architecture](../../doc/architecture/GATEWAY_ARCHITECTURE.md)
- [System Architecture](../../doc/architecture/SYSTEM_ARCHITECTURE.md)
- [Module System & Layer Architecture](../modules/space/src/lib/layer.md)
- [Local Development](../../doc/guides/LOCAL_DEVELOPMENT.md)
