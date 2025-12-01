# Architecture Overview

This document provides a high-level overview of the Demiurge platform architecture.

## System Components

Demiurge is composed of three main applications plus supporting infrastructure.

---

## Architecture Diagram

📊 **Complete System Architecture Diagram**

See: [./SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md)

---

## Core Applications

### 1. app-ganymede (API Server)

**Purpose:** Central API for user management, authentication, organizations, and projects.

**Responsibilities:**

- User authentication (OAuth, TOTP, magic link, local)
- Organization management (CRUD, members)
- Project management (CRUD, members)
- Gateway allocation and lifecycle
- Session management

**Tech Stack:**

- Express.js + TypeScript
- Passport.js (authentication strategies)
- PostgreSQL (persistent data)
- OpenAPI validation

**Key Endpoints:**

- `/auth/*` - Authentication flows
- `/organizations` - Organization management
- `/projects` - Project management
- `/gateway/*` - Gateway lifecycle
- `/users` - User search and info

**Database Tables:**

see [psql schema](../../packages/app-ganymede/database/schema/02-schema.sql)

- `users`, `passwords`, `totp`, `magic_links`, `sessions`
- `organizations`, `organizations_members`
- `projects`, `projects_members`
- `gateways`, `organizations_gateways`
- `oauth_clients`, `oauth_tokens` (for user authentication via global `demiurge-global` client)

### 2. app-gateway (Gateway)

**Purpose:** Per-organization collaborative backend with real-time state synchronization.

**Responsibilities:**

- Real-time collaboration (Yjs CRDT)
- Event processing (reducer pattern)
- Permission validation
- OAuth2 provider (for container apps)
- Container management
- VPN server (OpenVPN)
- Reverse proxy (Nginx)

**Tech Stack:**

- Express.js + TypeScript
- Yjs (CRDT for shared state)
- y-websocket (WebSocket sync)
- oauth2-server (OAuth provider)
- OpenVPN (container networking)
- Nginx (HTTP proxy)

**State Management:**

- **Shared State (Yjs):** Collaborative data synced to all clients
  - Graph nodes/edges
  - Container runtime data
  - Chat messages
  - Tabs, spaces
- **Non-Shared State (JSON):** Organization-scoped persistent data
  - User permissions
  - OAuth clients/tokens
  - Container auth tokens

**Module System:**
Extensible architecture where features are implemented as modules:

- `core-graph` - Graph/node system
- `user-containers` - Container management
- `jupyter` - JupyterLab integration
- `chats` - Chat functionality
- `tabs`, `space`, `gateway`, `collab`, `reducers`, and more

See [Module Reference](../../packages/modules/README.md) for detailed documentation on each module.

### 3. app-frontend (React SPA)

**Purpose:** User interface with whiteboard, real-time collaboration, and module UIs.

**Responsibilities:**

- Interactive whiteboard (React Flow)
- Real-time sync with gateway (WebSocket)
- Authentication UI
- Module frontend components
- Container management UI

**Tech Stack:**

- React + TypeScript
- React Flow (whiteboard)
- SCSS (styling)
- Vite (bundler)
- WebSocket client (Yjs)

## Data Flow

### Authentication Flow

```
1. User → Frontend → Ganymede: Login request
2. Ganymede: Validate credentials, create session
3. Ganymede → Frontend: Session cookie
4. Frontend → Ganymede: API requests (with session)
5. Ganymede: Validate session, return data
```

### Project Collaboration Flow

```
1. User opens project in Frontend
2. Frontend → Ganymede: Get project + gateway info
3. Ganymede: Allocate gateway if needed
4. Ganymede → Frontend: Gateway WebSocket URL
5. Frontend → Gateway: WebSocket connection
6. Gateway: Load project shared state (Yjs)
7. Gateway → Frontend: Initial state sync
8. User edits → Frontend → Gateway: Event
9. Gateway: Process event, update shared state
10. Gateway → All clients: State updates (Yjs sync)
```

### Container Creation Flow

```
1. User → Frontend: Create container
2. Frontend → Gateway: user-containers:new event
3. Gateway: Process event
   - Generate container ID and slug
   - Create OAuth clients (if needed)
   - Update shared state
4. Gateway → Frontend: State update (new container)
5. User → Frontend: Copy Docker command
6. Frontend → Ganymede: GET /user-container/{id}/cmd
7. Ganymede: Generate command with JWT token
8. User runs command on local machine
9. Container starts, connects to gateway VPN
10. Container → Gateway: Watchdog + service registration
11. Gateway: Update nginx, register DNS
12. Container accessible at: {slug}.containers.domain.com
```

## Key Architectural Patterns

### 1. Organization-Centric Model

Everything is scoped to organizations:

- Users are members of organizations
- Projects belong to organizations
- Gateways are allocated per organization
- Permissions are defined at organization level

**Benefits:**

- Clear multi-tenancy
- Resource isolation
- Simplified sharing within teams

### 2. Event-Driven Collaboration

Frontend sends events, gateway processes them through reducers:

```typescript
// Frontend
dispatch({
  type: 'user-containers:new',
  name: 'my-jupyter',
  imageId: 'jupyter:minimal',
});

// Gateway reducer
async function _newUserContainer(context) {
  // 1. Validate
  // 2. Create in shared state
  // 3. Side effects (OAuth, DB, etc.)
}
```

**Benefits:**

- Predictable state updates
- Easy to audit (event log)
- Supports optimistic UI
- Works with CRDT (Yjs)

### 3. Module System

Features are implemented as self-contained modules:

```typescript
export const moduleBackend: ModuleBackend = {
  collabChunk: {
    name: 'user-containers',
    sharedDataModel: { ... },
    reducer: containerReducer,
    events: containerEvents,
    loadExtraContext: () => ({ imageRegistry, ... })
  }
};
```

**Benefits:**

- Loose coupling
- Independent development
- Easy to add/remove features
- Testable in isolation

### 4. Stable URLs via DNS

Containers get permanent URLs that survive gateway changes:

```
{slug}.containers.domain.com → PowerDNS → Gateway → Container
```

Instead of:

```
{gateway-host}/{container-id}/{service}  ❌ Changes when gateway reassigned
```

**Benefits:**

- Bookmarkable URLs
- Shareable links
- No broken URLs after gateway changes

## Security Model

### Authentication

- **Session-based:** HTTP-only cookies for web sessions
- **JWT tokens:** For container authentication (scoped to container)
- **OAuth2:** For third-party integrations and container apps

### Authorization

- **Ganymede:** Validates organization/project membership (database)
- **Gateway:** Validates permissions for events (in-memory, fast)

**Permission Strings:**

```
org:admin                    - Organization admin
org:member                   - Organization member
project:{id}:member          - Project member
container:create             - Can create containers
container:{id}:delete        - Can delete specific container
```

### Container Isolation

- **VPN:** Containers communicate via private VPN (172.16.0.0/16)
- **OAuth:** Containers authenticate users via gateway OAuth provider
- **JWT tokens:** Gateway validates container identity via JWT tokens

## Deployment Architecture

### Development

See [guides/LOCAL_DEVELOPMENT.md](../guides/LOCAL_DEVELOPMENT.md) for complete setup.

- Multiple isolated environments on same machine
- PostgreSQL + Ganymede + Gateway in development container
- User containers in Docker (same as production)
- mkcert for valid SSL certificates

### Production

See [guides/PRODUCTION_DEPLOYMENT.md](../guides/PRODUCTION_DEPLOYMENT.md) for deployment.

- Ganymede on persistent VPS
- PostgreSQL database
- Gateway containers allocated on-demand
- Let's Encrypt SSL certificates
- PowerDNS for stable container URLs

## Technology Choices

| Component         | Technology    | Rationale                           |
| ----------------- | ------------- | ----------------------------------- |
| **Frontend**      | React         | Component model, large ecosystem    |
| **Whiteboard**    | React Flow    | Canvas-based graph editor           |
| **Backend**       | Express.js    | Simple, flexible, Node.js ecosystem |
| **Database**      | PostgreSQL    | Reliable, feature-rich RDBMS        |
| **Collaboration** | Yjs           | CRDT with great performance         |
| **Monorepo**      | Nx            | Build caching, dependency graph     |
| **Containers**    | Docker        | Standard containerization           |
| **VPN**           | OpenVPN       | Mature, reliable                    |
| **DNS**           | PowerDNS      | REST API, database backend          |
| **SSL**           | Let's Encrypt | Free, automated certificates        |

## Performance Considerations

### Collaboration (Yjs)

- **CRDT:** Conflict-free replicated data types
- **Binary protocol:** Efficient over WebSocket
- **Incremental updates:** Only diffs sent
- **Auto-save:** Periodic persistence to disk

### Gateway State

- **In-memory:** Fast permission checks
- **Dirty tracking:** Only save when changed
- **Auto-save:** Every 30s if dirty
- **Graceful shutdown:** Save before exit

### API

- **OpenAPI validation:** Request/response validation
- **Connection pooling:** PostgreSQL connections reused
- **Session storage:** Efficient session lookups

## Scalability

### Current Scale

- **Single Ganymede instance** - All API requests
- **One Gateway per organization** - Allocated on-demand
- **Gateways are stateful** - Can't be easily replicated

### Future Scaling (if needed)

- **Horizontal Ganymede:** Multiple API servers behind load balancer
- **Gateway clustering:** Multi-process gateways with shared Yjs state
- **Database read replicas:** Scale read queries
- **CDN:** Static assets served from CDN

## Related Documentation

- **[System Architecture](SYSTEM_ARCHITECTURE.md)** - Complete system diagram
- **[Gateway Architecture](GATEWAY_ARCHITECTURE.md)** - Multi-gateway pool architecture
- **[Local Development](../guides/LOCAL_DEVELOPMENT.md)** - Dev environment setup
- **[Contributing](../../CONTRIBUTING.md)** - Development workflow
