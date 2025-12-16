# Modules Reference

This directory contains all Holistix modules. Each module is a self-contained feature that can be loaded into the gateway and frontend.

## Module System

Modules follow a dependency-based loading system. Each module declares its dependencies, and the module loader ensures proper initialization order.

See [Module System](module/README.md) for details on the module architecture.

## Available Modules

### Foundation Modules

- **[Module System](module/README.md)** - Base module system with dependency resolution
- **[Collaboration](collab/README.md)** - Real-time collaboration with Yjs CRDT
- **[Reducers](reducers/README.md)** - Event processing system
- **[Core Graph](core-graph/README.md)** - Graph foundation (nodes, edges, connectors)

### Workspace Modules

- **[Whiteboard](whiteboard/README.md)** - Whiteboard and workspace management
- **[Tabs](tabs/README.md)** - Tab management system
- **[Chats](chats/README.md)** - Real-time chat functionality

### Infrastructure Modules

- **[Gateway](gateway/README.md)** - Gateway services (OAuth, tokens, permissions, DNS, protected services)
- **[User Containers](user-containers/README.md)** - Container lifecycle, image registry, terminal access

### Container Image Modules

These modules provide both UI integration and Docker images:

- **[Jupyter](jupyter/README.md)** - JupyterLab notebook environments (with container image)
- **[pgAdmin4](pgadmin4/README.md)** - PostgreSQL administration (with container image)
- **[n8n](n8n/README.md)** - Workflow automation (with container image)

### Integration Modules

- **[Notion](notion/README.md)** - Notion API integration
- **[Airtable](airtable/README.md)** - Airtable API integration
- **[Excalidraw](excalidraw/README.md)** - Collaborative drawing integration
- **[Socials](socials/README.md)** - Social features

## Module Development

For information on developing and testing modules, see:

- [Module Testing Guide](../../doc/guides/MODULES_TESTING.md) - Testing modules with Storybook
- [Architecture Overview](../../doc/architecture/OVERVIEW.md#module-system) - Module system architecture
