# Frontend Architecture

## Overview

The Demiurge frontend is composed of two primary packages:

1. `app-frontend` — React SPA that renders the user interface, context hierarchy, and module views.
2. `frontend-data` — Shared data layer that provides API clients, React Query hooks, and context providers.

This document describes the architectural patterns that connect these packages, focusing on context nesting, gateway access, module loading, and query conventions.

---

## Context Hierarchy

### 1. ApiContext (App-Wide)

- **Source:** `packages/frontend-data/src/lib/api-context.tsx`
- **Provides:** `ganymedeApi`, `ganymedeFQDN`, `queryClient`
- **Scope:** Entire application (wrapped around router)
- **Purpose:** Centralizes API clients and React Query client so every component shares the same data cache and OAuth token management.

### 2. ProjectContext (Project-Level)

- **Source:** `packages/app-frontend/src/app/pages/project/project-context.tsx`
- **Provides:** `ProjectData` (project metadata, organization reference)
- **Scope:** `/p/:owner/:project_name` routes
- **Responsibilities:**
  - Resolve project from URL (owner slug + project name)
  - Handle project loading and error states
  - Pass organization identifier downstream
- **Non-Responsibilities:** No gateway management, modules, or collaboration logic (moved to OrganizationContext).

### 3. OrganizationContext (Organization-Level)

- **Source:** `packages/app-frontend/src/app/pages/organization/organization-context.tsx`
- **Provides:** Gateway lifecycle and module exports via `ModuleProvider`
- **Scope:** Every project once project data is ready and organization ID is known
- **Responsibilities:**
  - Fetch gateway hostname via `useQueryOrganizationGateway(organization_id)`
  - Set gateway hostname on `ganymedeApi`
  - Load frontend modules with organization-specific configuration
  - Render module-provided UI only when gateway is available
  - Show dedicated states for loading/unavailable gateways

### Context Nesting (Simplified)

```
BrowserRouter
└── ApiContext
    └── Routes
        └── ProjectContext (component)
            └── OrganizationContext (when project ready)
                └── ModuleProvider
                    └── projectContext.Provider (React context)
                        └── Project children (pages, components)
```

**Note:** `ProjectContext` manages project state and renders `OrganizationContext` when the project is ready. `ProjectContext` passes `projectContext.Provider` (the React context) as children to `OrganizationContext`. `OrganizationContext` then wraps those children with `ModuleProvider` to provide module exports. This ensures modules are available when project data is accessed via `useProject()`.

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

- Modules are declared via `getModulesFrontend(config)` in `packages/app-frontend/src/app/pages/organization/modules.ts`.
- `OrganizationContext` maps these declarations into `loadModules()` only when a gateway hostname is present.
- Module configuration receives organization-specific dependencies (e.g., a gateway-aware fetch instance).

### Gateway Fetch Helper

- `createGatewayFetch(ganymedeApi, gateway_fqdn)` returns an `ApiFetch` subclass that proxies all requests through `ganymedeApi.fetchGateway`.
- Reducers module receives this helper via its config rather than calling `setFetch()` manually.
- Pattern ensures every module shares the same token lifecycle and error handling.

### Module Availability States

- Loading UI: Displayed while gateway FQDN is being retrieved.
- Unavailable UI: Displayed when gateway is idle or deallocated.
- Ready State: Modules render only when gateway FQDN exists and module exports are available.

---

## Frontend Data Layer (frontend-data)

### Purpose

- Unified data access layer for `app-frontend`.
- Houses API clients, React Query hooks, and contexts so frontend components remain lean.

### Key Components

1. **ApiContext** — Provides `ganymedeApi` and React Query client.
2. **GanymedeApi** — Extends `ApiFetch` with OAuth token storage, gateway Map, and helper utilities.
3. **React Query Hooks** — `useQuery*` and `useMutation*` helpers for users, projects, permissions, and gateway data.
4. **Story API Context** — Lightweight mock context for Storybook.

### Hook Conventions

- Every query hook specifies a clear `queryKey`.
- Hooks return typed data.
- Hooks that depend on gateway hostname handle `enabled` flags and background polling.
- Mutations invalidate the minimal set of query keys to keep the cache consistent.

---

## Permission System (Frontend Perspective)

### Gateway Permission Endpoints

- `GET /permissions` — Returns all module-defined permissions (used to populate UI select lists).
- `GET /permissions/projects/{project_id}` — Returns user-specific permission assignments.
- `PATCH /permissions/projects/{project_id}/users/{user_id}` — Updates assigned permissions.

### Frontend Hooks

- `useQueryScope(organization_id)` — Fetches the catalog of available permissions via `fetchGateway`.
- `useQueryProjectUsersScopes(organization_id, project_id)` — Loads permission assignments.
- `useCollaborators(project_id)` — Merges Ganymede project members with gateway permissions.
- `useMutationUserScope(project_id)` — Updates user permissions and invalidates relevant queries.

### Permission Format Awareness

- Hooks treat permissions as opaque strings; formatting is documented separately in `PERMISSION_SYSTEM.md`.
- UI components render human-readable labels by referencing module-provided metadata.

---

## Related Documentation

- `doc/architecture/PERMISSION_SYSTEM.md`
- `doc/architecture/GATEWAY_ARCHITECTURE.md`
- `doc/architecture/ARCHITECTURAL_DECISIONS.md`

For backend-focused details, refer to the documents above. This file concentrates on frontend-specific architecture and patterns.
