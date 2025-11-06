# AI Context: Demiurge Quick Start

This document helps AI assistants quickly understand the Demiurge codebase and architecture.

## Project Overview

**Demiurge** is a real-time collaborative development platform with:

- Interactive whiteboard (React Flow)
- User-managed containerized applications (JupyterLab, pgAdmin, etc.)
- Real-time collaboration using Yjs CRDT
- Module-based extensible architecture
- Organization and project management

**Tech Stack:** React, TypeScript, Node.js, Express, Yjs, PostgreSQL, Docker, Nginx, OpenVPN

**Monorepo:** Nx workspace with ~18 packages

## Quick Architecture Overview

```
┌─────────────┐
│  Frontend   │ React + Yjs (WebSocket)
│  (Browser)  │
└──────┬──────┘
       │
       ├─HTTP──▶ Ganymede API (users, orgs, projects, auth)
       │         └─ PostgreSQL (persistent data)
       │
       └─WS────▶ Gateway (per-org collaborative backend)
                 ├─ Yjs CRDT (shared state)
                 ├─ Reducers (event processors)
                 ├─ Permissions (in-memory)
                 ├─ OAuth2 provider (for containers)
                 └─ OpenVPN + Nginx (container networking)
                     │
                     └─▶ User Containers (Docker)
                         JupyterLab, pgAdmin, n8n, etc.
```

**Key Architectural Patterns:**

- **Event-driven collaboration:** Frontend dispatches events → Gateway reducers process → Yjs updates all clients
- **Organization-centric:** Users → Organizations → Projects → Gateways (1 per org)
- **Module system:** Features as pluggable modules (user-containers, jupyter, chats, tabs, etc.)
- **Stable container URLs:** DNS-based (PowerDNS) for permanent URLs

## Key Files & Locations

### Applications

- **Frontend:** `packages/app-frontend/` - React SPA, whiteboard
- **Ganymede:** `packages/app-ganymede/` - Main API server
- **Gateway:** `packages/app-collab/` - Per-org collaborative backend
- **CLI:** `packages/app-ganymede-cmds/` - Admin CLI tools

### Core Libraries

- **Modules:** `packages/modules/` - Feature modules
  - `core/` - Graph/node system
  - `user-containers/` - Container management
  - `jupyter/` - JupyterLab integration
  - `space/` - Whiteboard spaces, **layer system** (see `space/src/lib/layer.md`)
  - `chats/`, `tabs/`, etc.
- **Backend engine:** `packages/backend-engine/` - Express utilities (stripped down)
- **UI:** `packages/ui-base/`, `packages/ui-views/` - React components

### Documentation

- **Start here:** [`README.md`](../../README.md) - Project overview
- **Doc hub:** [`doc/README.md`](../README.md) - Complete documentation index
- **Architecture:** [`doc/architecture/OVERVIEW.md`](../architecture/OVERVIEW.md)
- **Current work:** [`doc/architecture/REFACTORING.md`](../architecture/REFACTORING.md)
- **Local dev:** [`doc/guides/LOCAL_DEVELOPMENT.md`](../guides/LOCAL_DEVELOPMENT.md)
- **API:** [`doc/reference/API.md`](../reference/API.md)

### Database

- **Repo:** Separate repo at `/root/workspace/database/`
- **Schema:** `database/schema/02-schema.sql` - 11 tables (users, orgs, projects, gateways, oauth)
- **Procedures:** `database/procedures/*.sql` - SQL stored procedures

## Current State (Nov 2024)

### ✅ Recently Completed

- **Organization-centric refactor:** Merged app-account into app-ganymede
- **Gateway architecture:** Implemented permissions, OAuth2, container management
- **Backend-engine cleanup:** Stripped to essentials, using standard Express
- **Local dev setup:** Multi-environment local development with mkcert SSL
- **Documentation reorganization:** Clean structure with archive for historical docs

### 🎯 Current Focus

- Testing and stabilization
- Frontend integration with new backend architecture
- Module refinement

See [`doc/architecture/REFACTORING.md`](../architecture/REFACTORING.md) for complete status.

## Key Concepts for AI Assistants

### 1. Event-Driven Collaboration

**Pattern:**

```typescript
// Frontend dispatches event
dispatch({
  type: 'user-containers:new',
  name: 'my-jupyter',
  imageId: 'jupyter:minimal',
});

// Gateway reducer processes
async function _newUserContainer(context) {
  // 1. Validate
  // 2. Update Yjs shared state
  // 3. Side effects (DB, OAuth, etc.)
}

// Yjs pushes updates to all clients automatically
```

**Key files:**

- Event definitions: `packages/modules/*/src/lib/*-events.ts`
- Reducers: `packages/modules/*/src/lib/*-reducer.ts`
- Shared data models: `packages/modules/*/src/lib/*-shared-model.ts`

### 2. Module System

**Structure:**

```typescript
export const moduleBackend: ModuleBackend = {
  collabChunk: {
    name: 'user-containers',
    sharedDataModel: { ... },      // Yjs data structure
    reducer: containerReducer,      // Event processor
    events: containerEvents,        // Event types
    loadExtraContext: () => ({ ... }) // Shared utilities
  }
};
```

**Key files:**

- Module definition: `packages/modules/*/src/index.ts`
- Frontend: `packages/modules/*/src/frontend.ts`
- Layer system (advanced): `packages/modules/space/src/lib/layer.md` ⭐

### 3. State Management

**Gateway has TWO types of state:**

1. **Shared State (Yjs CRDT)** - Synced to all clients

   - Graph nodes/edges, containers, chat messages, tabs
   - In-memory, persisted to disk periodically
   - File: `/data/project-{id}/{timestamp}.json`

2. **Non-Shared State (JSON)** - Organization-scoped, not synced
   - User permissions, OAuth clients/tokens, container tokens
   - In-memory, auto-saved every 30s
   - File: `/data/gateway-state-{org_id}.json`

**Key files:**

- `packages/app-collab/src/state/GatewayState.ts` - Generic persistent storage
- `packages/app-collab/src/state/ProjectRooms.ts` - Multi-project YJS rooms
- `packages/app-collab/src/permissions/PermissionManager.ts` - Permission logic
- `packages/app-collab/src/oauth/OAuthManager.ts` - OAuth2 provider

### 4. Database Schema (PostgreSQL)

**11 core tables:**

- `users`, `passwords`, `totp`, `magic_links`, `sessions` (auth)
- `organizations`, `organizations_members` (multi-tenancy)
- `projects`, `projects_members` (workspaces)
- `gateways`, `organizations_gateways` (gateway allocation)

**Container data NOT in DB** - stored in gateway shared state (Yjs)

See [`doc/architecture/REFACTORING.md#database-schema`](../architecture/REFACTORING.md#database-schema) for details.

### 5. Permissions

**Simple string-based system:**

```typescript
// Organization level
'org:owner', 'org:admin', 'org:member';

// Project level
('project:{id}:member');

// Resource level
('container:create');
('container:{id}:delete');
```

**Location:** Gateway validates all events via `PermissionManager`

**Key files:**

- `packages/app-collab/src/permissions/PermissionManager.ts`
- `packages/app-collab/src/middleware/permissions.ts`

## Common Tasks for AI Assistants

### Understanding a Feature

1. Check [`doc/README.md`](../README.md) "By Topic" section
2. Read relevant architecture doc
3. Find module in `packages/modules/`
4. Check reducer + shared-model files

### Adding a New Endpoint

1. See [`CONTRIBUTING.md`](../../CONTRIBUTING.md#backend-express)
2. Add to `packages/app-ganymede/src/routes/` or `packages/app-collab/src/routes/`
3. Update OpenAPI spec: `src/oas30.json`
4. Use `asyncHandler` for error handling

### Adding a New Module Feature

1. See [`doc/guides/MODULES_TESTING.md`](../guides/MODULES_TESTING.md)
2. Update module's reducer, events, shared-model
3. Add frontend components in module's `src/lib/components/`
4. Export in `frontend.ts`

### Working with Database

1. Database repo: `/root/workspace/database/`
2. Schema: `schema/02-schema.sql`
3. Procedures: `procedures/proc_*.sql`, `functions/func_*.sql`
4. Apply: `./run.sh schema`, `./run.sh procedures`

### Local Development

1. Full guide: [`doc/guides/LOCAL_DEVELOPMENT.md`](../guides/LOCAL_DEVELOPMENT.md)
2. Quick: `scripts/local-dev/create-env.sh dev-001`
3. Build: `npx nx run-many -t build`
4. Start: `/root/.local-dev/dev-001/start.sh`

## Important Notes

### Recent Major Changes

- **app-account deleted** - Merged into app-ganymede (Nov 2024)
- **"servers" → "user-containers"** - Terminology updated everywhere
- **backend-engine stripped** - Now just Express utilities, not a framework
- **Organization model** - Gateway per org (not per project)

### Code Search Tips

- Use `codebase_search` for semantic searches
- Use `grep` for exact string matches
- Check `doc/archive/` for historical context on design decisions

### Vocabulary

- **Ganymede** = API server (users, orgs, projects)
- **Gateway/Collab** = Per-org collaborative backend
- **Module** = Feature plugin (user-containers, jupyter, chats, etc.)
- **Shared state** = Yjs CRDT data (synced to clients)
- **Non-shared state** = Gateway-local persistent data (permissions, OAuth)
- **Reducer** = Event processor function
- **Layer** = Rendering layer in whiteboard (see layer.md)

## Quick Reference Links

**Architecture:**

- [Overview](../architecture/OVERVIEW.md) - System design
- [Refactoring](../architecture/REFACTORING.md) - Current work & database schema
- [Gateway Plan](../architecture/GATEWAY_IMPLEMENTATION_PLAN.md) - Implementation details
- [Layer System](../../packages/modules/space/src/lib/layer.md) - Whiteboard layers ⭐

**Guides:**

- [Local Development](../guides/LOCAL_DEVELOPMENT.md) - Multi-env setup
- [Module Testing](../guides/MODULES_TESTING.md) - Testing modules
- [Nx Workspace](../guides/NX_WORKSPACE.md) - Monorepo commands

**Reference:**

- [API](../reference/API.md) - REST API endpoints
- [Cheatsheet](../reference/CHEATSHEET.md) - Common commands

**Contributing:**

- [Contributing Guide](../../CONTRIBUTING.md) - Development workflow

## When User Says...

- **"How does X work?"** → Check architecture docs, then search module reducers
- **"Add endpoint for Y"** → Update routes, add to oas30.json, use asyncHandler
- **"Fix bug in Z"** → Search for feature in modules/, check reducer + events
- **"Update database"** → Work in `/root/workspace/database/`, update schema/procedures
- **"Test locally"** → Follow LOCAL_DEVELOPMENT.md, use create-env.sh
- **"Where is the code for...?"** → Check doc/README.md "By Topic" or use codebase_search

---

**Last updated:** 2025-01-06  
**Maintained by:** Core team

For detailed explanations, always start with the [documentation hub](../README.md).
