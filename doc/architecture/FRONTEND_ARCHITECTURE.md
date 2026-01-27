# Frontend Architecture

## Overview

The Holistix Forge frontend is composed of three primary packages:

1. `collab` — Self-contained collaboration module with engine, context, and hooks.
2. `frontend-data` — Shared data layer that provides API clients, React Query hooks, and context providers.
3. `app-frontend` — React SPA that renders the user interface and wires contexts together.

This document describes the architectural patterns that connect these packages, focusing on context nesting, gateway access, module loading, and query conventions.

**For detailed architecture documentation, see:** [`FRONTEND_DATA_ARCHITECTURE.md`](./FRONTEND_DATA_ARCHITECTURE.md)

---

## Context Hierarchy

### 1. ApiContext (App-Wide)

- **Source:** `packages/frontend-data/src/lib/api-context.tsx`
- **Provides:** `ganymedeApi`, `ganymedeFQDN`, `queryClient`
- **Scope:** Entire application (wrapped around router)
- **Purpose:** Centralizes API clients and React Query client so every component shares the same data cache and OAuth token management.

### 2. ModuleDataProvider (Organization-Level)

- **Source:** `packages/frontend-data/src/lib/modules/module-data-provider.tsx`
- **Provides:** Gateway lifecycle and module exports via `ModuleProvider`
- **Scope:** Every project once organization ID is known
- **Responsibilities:**
  - Fetch gateway hostname via `useQueryOrganizationGateway(organization_id)`
  - Set gateway hostname on `ganymedeApi`
  - Load frontend modules with organization-specific configuration
  - Render module-provided UI only when gateway is available
  - Provide `OrganizationProvider` context
  - Show dedicated states for loading/unavailable gateways

### 3. ProjectProvider (Project-Level)

- **Source:** `packages/frontend-data/src/lib/contexts/project-context.tsx`
- **Provides:** `ProjectData` (project metadata, organization reference, permissions)
- **Scope:** `/p/:owner/:project_name` routes
- **Hooks:** `useProject()`, `useProjectId()`
- **Purpose:** Provides full project data for UI components

### 4. CollabProjectProvider (Collaboration-Level)

- **Source:** `packages/modules/collab/src/lib/collab-project-context.tsx`
- **Provides:** `project_id` (only!) for collaboration hooks
- **Scope:** Within project pages, nested inside `ProjectProvider`
- **Hook:** `useCollabProjectId()` (used internally by collab hooks)
- **Purpose:** Lightweight context that enables collab hooks to work without depending on app-level infrastructure

### Context Nesting (Current)

```
BrowserRouter
└── ApiContext (app-wide)
    └── Routes
        └── ProjectWrapper (UI component in app-frontend)
            └── ModuleDataProvider (from frontend-data)
                ├── OrganizationProvider (from frontend-data)
                ├── ModuleProvider (loaded modules)
                └── ProjectProvider (from frontend-data)
                    └── CollabProjectProvider (from collab module)
                        └── Project Pages & Components
```

**Key Points:**

- `ModuleDataProvider` handles all data infrastructure
- `ProjectProvider` provides full project data for UI
- `CollabProjectProvider` provides ONLY `project_id` for collab hooks
- Two separate contexts with different purposes (no overlap)
- Collab module is self-contained (no dependency on frontend-data)

---

## Gateway Access Pattern

### Gateway FQDN Management

- `GanymedeApi` stores a map of `organization_id -> gateway_fqdn`.
- `OrganizationContext` keeps gateway FQDN up-to-date by calling `ganymedeApi.setGatewayHostname(organization_id, fqdn)`.
- Gateway FQDN is cleared when `ganymedeApi.reset()` executes (e.g., logout).

### `fetchGateway()` Method

- `GanymedeApi.fetchGateway(request, organization_id, project_id?)`
- Reuses the same OAuth token management code path as regular Ganymede calls.
- Automatically injects `project_id` when provided, ensuring proper token key derivation even though the system now uses a single user token.
- Provides consistent logging, error handling, and retry behavior.

### Gateway Polling Strategy

- `useQueryOrganizationGateway()` polls `GET /orgs/{organization_id}/gateway` with adaptive intervals:
  - 30 seconds when an FQDN exists (detect deallocation quickly).
  - 2 minutes when FQDN is null (avoid unnecessary load while waiting for allocation).
- Polling continues in the background to keep UI state accurate, even if the browser tab loses focus.

---

## Module Loading Pattern

### Organization-Scoped Module Loading

- Modules are declared via `getAllModules()` in `packages/app-frontend/src/app/modules.ts`.
- Module configurations are created by `createModuleConfigs()` in `packages/frontend-data/src/lib/modules/modules-config.ts`.
- `ModuleDataProvider` (from frontend-data) orchestrates:
  1. Fetching gateway hostname
  2. Creating module configurations
  3. Loading modules with `loadModules()`
  4. Providing modules via `ModuleProvider`

### Gateway Fetch Helper

- `createGatewayFetch(ganymedeApi, gateway_hostname, organization_id)` (in frontend-data) returns an `ApiFetch` subclass that proxies all requests through `ganymedeApi.fetchGateway`.
- Reducers module receives this helper via its config.
- Pattern ensures every module shares the same token lifecycle and error handling.

### Collab Module Configuration

- Collab module uses `CollabRegistryConfig` with a factory function:
  ```typescript
  {
    type: 'registry',
    createConfigForProject: (project_id) => ({
      type: 'yjs-client',
      ws_server: `wss://${gateway_hostname}`,
      room_id: project_id,
      token: { get: () => ganymedeApi.getAccessToken(), ... },
      user: { ... }
    })
  }
  ```
- Factory enables lazy creation of project-specific collab instances

### Module Availability States

- **Loading UI:** Displayed while gateway FQDN is being retrieved.
- **Unavailable UI:** Displayed when gateway is idle or deallocated (with "Start Organization" button).
- **Ready State:** Modules render only when gateway FQDN exists and module exports are available.

---

## Frontend Data Layer (frontend-data)

### Purpose

- Unified data access layer for `app-frontend`.
- Houses API clients, React Query hooks, contexts, and module loading infrastructure.
- Does NOT include collaboration hooks (those are in the `collab` module).

### Key Components

1. **ApiContext** — Provides `ganymedeApi` and React Query client.
2. **GanymedeApi** — Extends `ApiFetch` with OAuth token storage, gateway Map, and helper utilities.
3. **React Query Hooks** — `useQuery*` and `useMutation*` helpers for users, projects, permissions, and gateway data.
4. **Data Contexts:**
   - `ProjectProvider` / `useProject()` — Full project data
   - `OrganizationProvider` / `useOrganization()` — Organization ID
5. **Module Infrastructure:**
   - `ModuleDataProvider` — Orchestrates module loading and gateway management
   - `createModuleConfigs()` — Creates configurations for modules
6. **Story API Context** — Lightweight mock context for Storybook.

### Hook Conventions

- Every query hook specifies a clear `queryKey`.
- Hooks return typed data.
- Hooks that depend on gateway hostname handle `enabled` flags and background polling.
- Mutations invalidate the minimal set of query keys to keep the cache consistent.

### What's NOT in frontend-data

- ❌ Collaboration hooks (in `collab` module)
- ❌ UI components (in `app-frontend`)
- ❌ Module implementations (in respective module packages)

---

## Permission System (Frontend Perspective)

### Gateway Permission Endpoints

- `GET /permissions` — Returns all module-defined permissions (used to populate UI select lists).
- `GET /permissions/projects/{project_id}` — Returns user-specific permission assignments.
- `PATCH /permissions/projects/{project_id}/users/{user_id}` — Updates assigned permissions.

### Frontend Hooks (RBAC)

**Role Management:**

- `useQueryRoles(organization_id)` — Fetches all roles (system + custom) from gateway
- `useQueryRole(organization_id, role_id)` — Fetch specific role details
- `useMutationCreateRole(organization_id)` — Create new custom role
- `useMutationUpdateRole(organization_id, role_id)` — Update custom role
- `useMutationDeleteRole(organization_id, role_id)` — Delete custom role

**User Role Assignments:**

- `useQueryUserRoles(organization_id, user_id)` — Get user's role assignments (org + project)
- `useQueryOrgMembers(organization_id)` — Get organization members for user management
- `useMutationAssignRole(organization_id)` — Assign role to user
- `useMutationUnassignRole(organization_id)` — Remove role from user

**Permissions:**

- `useQueryPermissions(organization_id)` — Fetches registered permissions from gateway
- `useCollaborators(organization_id, project_id)` — Merges Ganymede project members with gateway role data

**Legacy (Deprecated):**

- ~~`useQueryScope`~~ - Replaced by `useQueryPermissions`
- ~~`useQueryProjectUsersScopes`~~ - Replaced by `useQueryUserRoles` + `useQueryOrgMembers`
- ~~`useMutationUserScope`~~ - Replaced by `useMutationAssignRole` / `useMutationUnassignRole`

### Permission Format Awareness

- RBAC model: Users → Roles → Permissions
- Permissions are opaque strings with format `{module}:{resource}:{action}`
- Supports wildcard matching (e.g., `project:*:admin` matches all projects)
- See [PERMISSION_SYSTEM.md](../architecture/PERMISSION_SYSTEM.md) for complete details

---

## Related Documentation

- `doc/architecture/PERMISSION_SYSTEM.md`
- `doc/architecture/GATEWAY_ARCHITECTURE.md`
- `doc/architecture/ARCHITECTURAL_DECISIONS.md`

For backend-focused details, refer to the documents above. This file concentrates on frontend-specific architecture and patterns.
