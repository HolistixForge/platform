# Documentation Proposal: Frontend Architecture & Patterns

**Date:** 2025-01-06  
**Context:** Following completion of frontend-data package refactoring and permission system redesign

---

## Overview

This document proposes new documentation sections to capture architectural decisions, patterns, and features introduced during the frontend-data refactoring. These additions will help developers understand the new architecture and maintain consistency.

---

## Proposed Documentation Sections

### 1. Frontend Context Architecture Pattern

**Location:** `doc/architecture/FRONTEND_CONTEXT_ARCHITECTURE.md` (new file)

**Purpose:** Document the React Context hierarchy and organization-level module loading pattern

**Content to Include:**

1. **Context Hierarchy**
   - `ApiContext` (app-wide) - Provides GanymedeApi, queryClient
   - `OrganizationContext` (organization-level) - Gateway management, module loading
   - `ProjectContext` (project-level) - Project data only
   - Nesting order and responsibilities

2. **OrganizationContext Pattern**
   - Why organization-level context (gateway is per-organization)
   - Gateway hostname management
   - Module loading lifecycle
   - Polling mechanism for gateway deallocation detection
   - When modules are available vs unavailable

3. **Separation of Concerns**
   - ProjectContext: Project data only (no gateway/collab logic)
   - OrganizationContext: Gateway lifecycle, module loading
   - Clear boundaries and responsibilities

4. **Code Examples**
   - How to use OrganizationContext
   - How to access modules from child components
   - Error states and loading states

**Rationale:** This pattern is fundamental to understanding how the frontend manages gateway availability and module loading. It's a significant architectural shift from project-level to organization-level concerns.

---

### 2. Gateway API Access Pattern

**Location:** `doc/architecture/GATEWAY_API_ACCESS.md` (new file)  
**Alternative:** Add section to `doc/architecture/GATEWAY_ARCHITECTURE.md`

**Purpose:** Document how frontend accesses Gateway API with automatic token management

**Content to Include:**

1. **GanymedeApi.fetchGateway() Method**
   - Purpose: Unified API access to Gateway with automatic token management
   - How it works: Reuses existing token refresh logic
   - Organization gateway hostname Map management
   - Automatic project_id injection for token selection

2. **Organization Gateway Hostname Management**
   - `setGatewayHostname(organization_id, gateway_hostname)` method
   - `getGatewayHostname(organization_id)` method
   - Map-based storage (supports multiple organizations)
   - Lifecycle: Set by OrganizationContext, cleared on reset

3. **Token Management Reuse**
   - How `fetchGateway()` reuses `_doTokenLogic()`
   - Automatic token refresh for Gateway calls
   - No separate token management needed
   - Benefits: Consistency, automatic refresh, single source of truth

4. **Gateway Fetch Helper**
   - `createGatewayFetch()` function
   - Purpose: Create ApiFetch instance for module config
   - Used by reducers module for event dispatching
   - Reuses GanymedeApi's token management

5. **Code Examples**
   - Using `fetchGateway()` in queries
   - Setting up gateway fetch for modules
   - Error handling when gateway unavailable

**Rationale:** This is a key architectural pattern that enables seamless Gateway API access from the frontend while maintaining token management consistency.

---

### 3. Permission System Architecture

**Location:** `doc/architecture/PERMISSION_SYSTEM.md` (new file)  
**Alternative:** Expand `doc/architecture/GATEWAY_ARCHITECTURE.md` with detailed permission section

**Purpose:** Document the new module-based permission system

**Content to Include:**

1. **Permission Format Specification**
   - Format: `{module}:[{resource-path}]:{action}`
   - Resource path syntax: `{type}:{id|*}(/{type}:{id|*})*`
   - Examples: Simple, with subresources, wildcards
   - Validation rules and regex pattern

2. **PermissionRegistry System**
   - Purpose: Compile permissions from modules during loading
   - Registration process: Modules register in `load()` function
   - Access pattern: Via `depsExports.gateway.permissionRegistry`
   - Storage: In-memory Map, compiled at gateway startup

3. **Module Permission Registration**
   - How modules register permissions
   - Example: user-containers module
   - Best practices: When to register, what to include
   - Description field for documentation

4. **Permission vs Grant**
   - Module definitions use `*` for all resources
   - User grants can be wildcard or specific
   - Examples of both patterns

5. **Gateway Permission Endpoints**
   - `GET /permissions` - Get all compiled permissions
   - `GET /permissions/projects/{project_id}` - Get user permissions
   - `PATCH /permissions/projects/{project_id}/users/{user_id}` - Update permissions
   - Authentication and authorization requirements

6. **Frontend Integration**
   - How frontend queries permissions
   - `useQueryScope()` - Get all available permissions
   - `useQueryProjectUsersScopes()` - Get project user permissions
   - `useMutationUserScope()` - Update user permissions

**Rationale:** The permission system is a major architectural component that needs comprehensive documentation for module developers and frontend developers.

---

### 4. Token Management Simplification

**Location:** `doc/architecture/TOKEN_MANAGEMENT.md` (new file)  
**Alternative:** Add section to `doc/architecture/ARCHITECTURAL_DECISIONS.md`

**Purpose:** Document the simplified single-token strategy

**Content to Include:**

1. **Single User Token Strategy**
   - Decision: Only one JWT token needed for entire application
   - Rationale: Permissions no longer in JWT, managed by Gateway
   - Benefits: Simpler code, fewer token refresh scenarios, easier debugging

2. **Token Storage**
   - `LocalStorageStore` for token caching
   - Single token key (no project-specific keys)
   - Automatic refresh via OAuth flow

3. **Token Selection Logic**
   - Removed: Project-based token selection
   - Removed: Client-based token selection
   - Simplified: Single token for all requests

4. **OAuth Flow**
   - Simplified flow (no project-specific scopes)
   - Global `demiurge-global` client
   - Token refresh mechanism

5. **Migration Notes**
   - What changed from previous architecture
   - Why multiple tokens were removed
   - Impact on existing code

**Rationale:** This is a significant simplification that affects how authentication works. Developers need to understand why and how.

---

### 5. API Response Format Standardization

**Location:** `doc/reference/API_RESPONSE_FORMATS.md` (new file)  
**Alternative:** Add section to `doc/reference/API.md`

**Purpose:** Document standardized API response formats

**Content to Include:**

1. **Response Format Changes**
   - Old format: `{ _0: [...] }` (legacy wrapper)
   - New format: Direct objects/arrays or `{ key: [...] }`
   - Rationale: More RESTful, clearer structure

2. **Endpoint-Specific Formats**
   - Projects: `{ projects: TApi_Project[] }`
   - Users: Direct `TG_User` object or `{ users: TG_User[] }`
   - Permissions: `{ permissions: PermissionDefinition[] }` or `{ permissions: { [user_id]: string[] } }`
   - Gateway: `{ gateway_hostname: string | null }`

3. **Type Safety**
   - Explicit type parameters in React Query hooks
   - Type inference improvements
   - Breaking changes and migration guide

4. **Consistency Guidelines**
   - When to use direct objects vs wrapped
   - When to use arrays vs objects
   - Naming conventions

**Rationale:** Response format changes affect all frontend code. Developers need clear documentation of what to expect.

---

### 6. Module Loading at Organization Level

**Location:** `doc/architecture/MODULE_LOADING.md` (new file)  
**Alternative:** Expand existing module documentation

**Purpose:** Document organization-level module loading pattern

**Content to Include:**

1. **Module Loading Lifecycle**
   - When modules load: After gateway hostname is available
   - Where modules load: OrganizationContext
   - Why organization-level: Gateway is per-organization

2. **Module Configuration**
   - Organization-specific configuration
   - `getModulesFrontend(config)` function pattern
   - Passing fetch function to reducers module
   - Other module configuration examples

3. **Module Availability**
   - Modules only available when gateway is running
   - Error states when gateway unavailable
   - Loading states during gateway allocation

4. **Module Provider Pattern**
   - How `ModuleProvider` wraps components
   - Accessing module exports via hooks
   - Type safety for module exports

5. **Frontend vs Backend Modules**
   - Different loading mechanisms
   - Different configuration patterns
   - When to use which

**Rationale:** Module loading is a core architectural pattern that affects how features are organized and loaded.

---

### 7. Gateway Polling Mechanism

**Location:** `doc/architecture/GATEWAY_POLLING.md` (new file)  
**Alternative:** Add section to `doc/architecture/GATEWAY_ARCHITECTURE.md`

**Purpose:** Document the polling strategy for gateway deallocation detection

**Content to Include:**

1. **Problem Statement**
   - Gateway can deallocate itself when idle
   - Frontend needs to detect deallocation
   - No WebSocket/SSE notification available

2. **Polling Strategy**
   - `useQueryOrganizationGateway()` with `refetchInterval`
   - Adaptive polling: 30s when active, 2min when inactive
   - Background polling: Continues when tab not focused

3. **Implementation Details**
   - React Query `refetchInterval` function
   - Dynamic interval based on gateway state
   - `refetchIntervalInBackground: true`

4. **Trade-offs**
   - Network overhead vs responsiveness
   - Battery impact (minimal with adaptive intervals)
   - Alternative approaches considered

**Rationale:** This is a specific technical decision that affects user experience and resource usage.

---

### 8. Project Search Endpoint Enhancement

**Location:** `doc/reference/API.md` (update existing)

**Purpose:** Document the enhanced project search functionality

**Content to Include:**

1. **Enhanced GET /projects Endpoint**
   - Optional query parameters: `owner`, `name`
   - Search by owner username and project name
   - Returns single project when searching, list when not

2. **Use Case**
   - Resolving project_id from URL path
   - URL format: `/p/{owner}/{project_name}`
   - Frontend needs to find project by owner + name

3. **Implementation Details**
   - Database function: `func_projects_get_by_org_and_name`
   - User lookup by username
   - Organization lookup
   - Project search across organizations

4. **Response Format**
   - Search mode: Direct `TApi_Project` object
   - List mode: `{ projects: TApi_Project[] }`

**Rationale:** This is a new feature that extends existing endpoint functionality.

---

### 9. Frontend Data Package Architecture

**Location:** `doc/architecture/FRONTEND_DATA_PACKAGE.md` (new file)

**Purpose:** Document the frontend-data package structure and patterns

**Content to Include:**

1. **Package Overview**
   - Purpose: React hooks and API clients for frontend
   - Key exports: Hooks, API clients, types
   - Dependencies: React Query, ApiFetch

2. **API Client Architecture**
   - `GanymedeApi` class extending `ApiFetch`
   - Token management with `LocalStorageStore`
   - Gateway API access via `fetchGateway()`
   - Organization gateway hostname management

3. **React Query Hooks**
   - Query hooks: `useQuery*` patterns
   - Mutation hooks: `useMutation*` patterns
   - Query key conventions
   - Invalidation strategies

4. **Context Providers**
   - `ApiContext` - App-wide API access
   - `StoryApiContext` - Storybook mocks

5. **Type Definitions**
   - Shared types from `@monorepo/demiurge-types`
   - Response type expectations
   - Type safety patterns

6. **Best Practices**
   - When to create new hooks
   - How to handle errors
   - Loading states
   - Caching strategies

**Rationale:** This package is central to frontend development. Developers need clear documentation of its structure and patterns.

---

### 10. Migration Guide: Frontend Data Refactoring

**Location:** `doc/guides/MIGRATION_FRONTEND_DATA.md` (new file)

**Purpose:** Guide for developers migrating code affected by the refactoring

**Content to Include:**

1. **Breaking Changes Summary**
   - Removed `accountApi` references
   - Simplified token management
   - Changed response formats
   - Updated endpoint URLs

2. **Migration Checklist**
   - Update API endpoint calls
   - Update response format handling
   - Remove project-specific token logic
   - Update permission queries

3. **Code Examples**
   - Before/after comparisons
   - Common migration patterns
   - Error handling updates

4. **Testing Considerations**
   - What to test after migration
   - Common issues and solutions
   - Regression testing checklist

**Rationale:** Helps developers understand what changed and how to update their code.

---

## Documentation Organization

### Recommended Structure

```
doc/
├── architecture/
│   ├── FRONTEND_CONTEXT_ARCHITECTURE.md (NEW)
│   ├── GATEWAY_API_ACCESS.md (NEW)
│   ├── PERMISSION_SYSTEM.md (NEW)
│   ├── TOKEN_MANAGEMENT.md (NEW)
│   ├── MODULE_LOADING.md (NEW)
│   ├── GATEWAY_POLLING.md (NEW)
│   ├── FRONTEND_DATA_PACKAGE.md (NEW)
│   ├── GATEWAY_ARCHITECTURE.md (UPDATE - add permission registry section)
│   └── ARCHITECTURAL_DECISIONS.md (UPDATE - add token management decision)
│
├── reference/
│   ├── API.md (UPDATE - add project search, update response formats)
│   └── API_RESPONSE_FORMATS.md (NEW - optional, could be in API.md)
│
└── guides/
    └── MIGRATION_FRONTEND_DATA.md (NEW)
```

---

## Priority Recommendations

### High Priority (Core Architecture)

1. **Frontend Context Architecture Pattern** - Essential for understanding the new structure
2. **Gateway API Access Pattern** - Critical for frontend developers
3. **Permission System Architecture** - Needed for module developers
4. **Token Management Simplification** - Important architectural decision

### Medium Priority (Implementation Details)

5. **API Response Format Standardization** - Helps with consistency
6. **Module Loading at Organization Level** - Important pattern
7. **Frontend Data Package Architecture** - Package-specific documentation

### Low Priority (Specific Features)

8. **Gateway Polling Mechanism** - Implementation detail
9. **Project Search Endpoint Enhancement** - Feature documentation
10. **Migration Guide** - One-time reference

---

## Cross-References

Each new document should include:

- Links to related architecture docs
- Links to API reference docs
- Links to code examples
- Links to related decisions in `ARCHITECTURAL_DECISIONS.md`

---

## Implementation Notes

1. **Start with High Priority** - Focus on core architecture docs first
2. **Use Code Examples** - Include real code from the codebase
3. **Update Existing Docs** - Don't duplicate, enhance existing sections
4. **Add Diagrams** - Context hierarchy, data flow, etc.
5. **Keep It Current** - Update as architecture evolves

---

## Questions to Resolve

1. Should `GATEWAY_API_ACCESS.md` be a separate file or part of `GATEWAY_ARCHITECTURE.md`?
2. Should `API_RESPONSE_FORMATS.md` be separate or part of `API.md`?
3. Should permission system docs be in architecture or reference?
4. Do we need a separate "Frontend Patterns" section or keep in architecture?

---

**Status:** Proposal - Awaiting review and approval before implementation

