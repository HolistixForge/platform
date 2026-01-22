# Role-Based Access Control (RBAC) Implementation

**Status**: Planning
**Branch**: `feat/rbac-permissions`
**Started**: 2026-01-22
**Owner**: Development Team

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State Analysis](#current-state-analysis)
3. [Goals and Requirements](#goals-and-requirements)
4. [Key Architecture Decisions](#key-architecture-decisions)
5. [Detailed Implementation Plan](#detailed-implementation-plan)
6. [Documentation Updates](#documentation-updates)
7. [Testing Strategy](#testing-strategy)
8. [Migration Strategy](#migration-strategy)
9. [Timeline and Milestones](#timeline-and-milestones)

---

## Executive Summary

### Problem Statement

The current permission system assigns permissions directly to users on a per-permission basis. This approach:

- Does not scale for organizations with many users
- Makes permission management tedious (assign each permission individually)
- Does not support permission inheritance or grouping
- Makes it difficult to grant consistent permissions to user groups
- Cannot handle new module-registered permissions dynamically

### Solution Overview

Implement a comprehensive **Role-Based Access Control (RBAC)** system where:

- **Users are assigned roles** (not individual permissions)
- **Roles contain collections of permissions** (including module-registered ones)
- **Permissions are resolved at check time** (dynamic, supports wildcards)
- **Roles exist at organization and project levels**
- **System roles are immutable** (org:owner, org:admin)
- **Custom roles can be created** by administrators

### Impact

- **Users**: Simplified permission management, clear role assignments
- **Administrators**: Assign roles instead of hundreds of permissions
- **Developers**: Modules continue registering permissions, no code changes
- **Architecture**: Gateway becomes source of truth for member management

---

## Current State Analysis

### What Exists

#### 1. Permission System (`packages/app-gateway/src/permissions/PermissionManager.ts`)

**Current Implementation:**

```typescript
class PermissionManager implements IPersistenceProvider {
  private permissions: Map<string, string[]>; // user_id → permissions[]

  addPermission(user_id: string, permission: string): void;
  removePermission(user_id: string, permission: string): void;
  hasPermission(user_id: string, permission: string): boolean;

  // Persistence
  loadFromSerializable(data: any): void;
  saveToSerializable(): any;
}
```

**Characteristics:**

- ✅ Direct user-to-permission mapping
- ✅ String-based permissions (e.g., `"project:abc:admin"`)
- ✅ Integrated with GatewayState persistence
- ❌ No role concept
- ❌ No wildcard matching
- ❌ No permission inheritance

#### 2. Permission Registry (`packages/modules/gateway/src/lib/permission-registry.ts`)

**Purpose**: Allow modules to register their permissions during load.

```typescript
export class PermissionRegistry {
  register(
    permission: string,
    definition: {
      resourcePath: string;
      action: string;
      description?: string;
    }
  ): void;

  getAll(): PermissionDefinition[];
  getByModule(module: string): PermissionDefinition[];
}
```

**Example Module Registration:**

```typescript
// packages/modules/user-containers/src/index.ts
permissionRegistry.register('user-containers:[user-container:*]:create', {
  resourcePath: 'user-container:*',
  action: 'create',
  description: 'Create user containers',
});
```

**Characteristics:**

- ✅ Modules register permissions dynamically
- ✅ Permissions follow standard format: `{module}:[{resource-path}]:{action}`
- ✅ Exposed via `GET /permissions` API
- ✅ Used by frontend to list available permissions

#### 3. Permission Checking in Modules

**In Reducers:**

```typescript
// packages/modules/user-containers/src/lib/servers-reducer.ts
const permissionManager = this.depsExports.gateway.permissionManager;
if (!permissionManager.hasPermission(user_id, 'container:create')) {
  throw new ForbiddenException([{ message: 'Permission denied' }]);
}
```

**In Protected Services:**

```typescript
// packages/modules/user-containers/src/index.ts
protectedServiceRegistry.registerService({
  id: 'user-containers:terminal',
  checkPermission: async (ctx, { permissionManager }) => {
    return permissionManager.hasPermission(ctx.userId, permission);
  },
});
```

#### 4. Gateway API Routes

**Current Routes:**

- `GET /permissions` - List all registered permissions
- `GET /permissions/projects/:project_id` - Get user permissions for project
- `PATCH /permissions/projects/:project_id/users/:user_id` - Update user permissions

#### 5. Frontend Permission Management

**Location**: `packages/app-frontend/src/app/forms/authorizations.tsx`

**UI Component**: `UsersScopes` (`packages/ui-base/src/lib/users-scopes/users-scopes.tsx`)

- Lists collaborators
- Shows assigned permissions (scopes)
- Allows adding/removing permissions via checkboxes

**Hooks**: (`packages/frontend-data/src/lib/queries.ts`)

- `useQueryScope()` - Fetch available permissions
- `useCollaborators()` - Get project members with permissions
- `useMutationUserScope()` - Update user permissions

#### 6. Ganymede Member Management

**Organization Members:**

- `GET /orgs/:org_id/members` - List members ✅
- `POST /orgs/:org_id/members` - Add member ✅
- `DELETE /orgs/:org_id/members/:user_id` - Remove member ✅
- `PUT /orgs/:org_id/members/:user_id` - Update member role ✅

**Project Members:**

- `GET /projects/:project_id/members` - List members ✅
- `POST /projects/:project_id/members` - Add member ⚠️ (SHOULD BE DEPRECATED)
- `DELETE /projects/:project_id/members/:user_id` - Remove member ⚠️ (SHOULD BE DEPRECATED)

**Database Tables:**

```sql
-- Stores organization membership with simple roles
organizations_members (organization_id, user_id, role: owner|admin|member)

-- Stores project membership (for listing projects when gateway offline)
projects_members (project_id, user_id, added_at)
```

**Why in Database?**
From `ARCHITECTURAL_DECISIONS.md`:

> **Key Principle:** If users need to browse it without gateway running → Ganymede Database
>
> - Users need to list their projects even when gateway is offline
> - Can manage organization members without gateway
> - Project members stored for listing, NOT for fine-grained permissions

#### 7. Organization Roles in Database

**Currently**: Simple enum stored in `organizations_members.role`:

- `owner` - Organization owner (full control)
- `admin` - Organization administrator
- `member` - Regular member

**Used for**: Basic access control in Ganymede API (who can create projects, add members, etc.)

### What's Missing

❌ **Role Management System**

- No data structures for roles
- No CRUD operations for roles
- No way to create custom roles

❌ **User-Role Assignment**

- No tracking of which users have which roles
- No org-level vs project-level role distinction

❌ **Permission Resolution via Roles**

- `hasPermission()` only checks direct permissions
- No wildcard matching (`[*]` in permissions)
- No role-based permission inheritance

❌ **Role-Based UI**

- Frontend UI only works with direct permissions
- No role selection/assignment interface
- No role editor for administrators

❌ **Gateway-Orchestrated Member Management**

- Project member management happens in Ganymede directly
- Gateway state can become out of sync with database
- No centralized member management flow

❌ **Lazy Project Initialization**

- All projects initialized eagerly on gateway startup
- Slow for organizations with many projects

---

## Goals and Requirements

### Primary Goals

1. **Implement Full RBAC System**

   - Users → Roles → Permissions
   - Support org-level and project-level roles
   - Default system roles (immutable)
   - Custom roles (user-defined)

2. **Module Permission Integration**

   - Roles can contain module-registered permissions
   - Dynamic permission resolution (supports future modules)
   - Wildcard matching for resource IDs

3. **Centralized Member Management**

   - Gateway orchestrates all member operations
   - Gateway calls Ganymede internal API for persistence
   - Maintains consistency between gateway state and database

4. **Performance & Scalability**

   - Lazy project initialization (on-demand)
   - Fresh data (no stale member cache)
   - Efficient permission checking

5. **Backward Compatibility**
   - No breaking changes to module code
   - Existing direct permissions continue working
   - Gradual migration path

### Functional Requirements

#### FR-1: Role Management

- **FR-1.1**: System shall provide default system roles (`org:owner`, `org:admin`)
- **FR-1.2**: System roles shall be immutable (cannot be edited or deleted)
- **FR-1.3**: Administrators shall be able to create custom roles
- **FR-1.4**: Custom roles shall be deletable (if not assigned to users)
- **FR-1.5**: Roles shall have a scope: `org` (all projects) or `project` (specific projects)

#### FR-2: Permission Assignment

- **FR-2.1**: Roles shall contain arrays of permission strings
- **FR-2.2**: Permissions can include wildcards (`*`, `[*]`)
- **FR-2.3**: Roles can contain any registered permission (including module ones)
- **FR-2.4**: Users shall be assigned org-level roles (apply to all projects)
- **FR-2.5**: Users shall be assigned project-level roles (specific projects only)

#### FR-3: Permission Checking

- **FR-3.1**: Permission checks shall resolve via user's roles
- **FR-3.2**: Wildcard permissions shall match specific resource IDs
  - Example: `user-containers:[user-container:*]:create` matches `user-containers:[user-container:abc123]:create`
- **FR-3.3**: org:owner role shall always grant all permissions (wildcard `*`)
- **FR-3.4**: Permission checking shall be backward compatible with direct permissions

#### FR-4: Member Management

- **FR-4.1**: All project member add/remove operations shall go through gateway
- **FR-4.2**: Gateway shall validate user is organization member before adding to project
- **FR-4.3**: Gateway shall update its state, then call Ganymede internal API
- **FR-4.4**: Ganymede public project member routes shall be deprecated

#### FR-5: Project Initialization

- **FR-5.1**: Projects shall initialize lazily (on first access)
- **FR-5.2**: Project initialization shall dispatch `project:init` event
- **FR-5.3**: Permission initialization shall happen during project initialization
- **FR-5.4**: Gateway shall fetch fresh organization members when initializing permissions

#### FR-6: UI Requirements

- **FR-6.1**: UI shall display roles instead of raw permissions
- **FR-6.2**: UI shall show which permissions are granted by each role
- **FR-6.3**: Administrators shall have a role editor UI
- **FR-6.4**: Role editor shall list all registered permissions (including module ones)

### Non-Functional Requirements

#### NFR-1: Performance

- Permission checks shall complete in < 5ms (99th percentile)
- Role resolution shall be cached where appropriate
- Lazy initialization shall reduce gateway startup time by 80%+

#### NFR-2: Security

- System roles shall be immutable (prevent privilege escalation)
- org:owner shall always retain full access (prevent lockout)
- Gateway internal APIs shall be protected by gateway token authentication
- Permission checks shall happen on every sensitive operation

#### NFR-3: Maintainability

- Module code shall require zero changes
- Permission format shall remain consistent
- Migration from direct permissions to roles shall be seamless

#### NFR-4: Scalability

- System shall support 1000+ users per organization
- System shall support 100+ roles per organization
- System shall support 1000+ projects per organization

---

## Key Architecture Decisions

### Decision 1: Permission Resolution at CHECK Time (Not Edit Time)

**Options Considered:**

1. **Resolve at CHECK time**: When checking permission, resolve user's roles to permissions dynamically
2. **Resolve at EDIT time**: When assigning role, expand to permissions and store expanded list

**Decision**: Resolve at CHECK time

**Rationale:**

- ✅ **Dynamic**: New module permissions automatically granted to roles with wildcards
- ✅ **Consistent**: Role changes immediately affect all users
- ✅ **Auditable**: Clear "user X accessed via role Y" in logs
- ✅ **Flexible**: Supports wildcards and patterns
- ❌ **Performance**: Slightly slower (mitigated by caching)

**Implementation:**

```typescript
hasPermission(user_id, permission) {
  // 1. Get user's roles (org + project)
  // 2. Get all permissions from all roles
  // 3. Check if any role permission matches (with wildcard matching)
}
```

---

### Decision 2: Org Roles AND Project Roles

**Decision**: Support both org-level and project-level roles

**Org Roles** (scope: `org`):

- Applied to ALL projects in organization
- Example: `org:admin` → Can manage all projects
- Use case: Core team members

**Project Roles** (scope: `project`):

- Applied to SPECIFIC projects only
- Example: `developer` role on Project A, not Project B
- Use case: External contractors, guest users, project-specific access

**Why Both?**

- Organizations need broad access for core team (org roles)
- Organizations need limited access for external collaborators (project roles)
- Flexibility: Some users need full access, others need project-specific access

---

### Decision 3: Gateway Orchestrates Member Management

**Current Problem**: Frontend can call Ganymede directly to add/remove project members, bypassing gateway state.

**Decision**: Gateway becomes the source of truth for member management

**Flow:**

```
Frontend
  ↓ (event)
Gateway (validates, updates state)
  ↓ (internal API call)
Ganymede (persists to database)
```

**Rationale:**

- ✅ **Consistency**: Gateway state always in sync with database
- ✅ **Validation**: Gateway enforces business logic
- ✅ **Centralized**: Single source of truth for permissions
- ✅ **Flexible**: Gateway can emit events, trigger side effects

**Implementation:**

- Deprecate public Ganymede project member routes
- Create internal Ganymede API (gateway-only)
- Gateway sends events (`member:add`, `member:remove`)
- Event handlers update gateway state, then call Ganymede

---

### Decision 4: Lazy Project Initialization

**Current**: All projects initialized eagerly on gateway startup
**Problem**: Slow for organizations with 100+ projects

**Decision**: Initialize projects lazily (on first access)

**Implementation:**

```typescript
GET /collab/room-id?project_id=X
  ↓
if (!isInitialized(project_id)) {
  initializeProject(project_id);  // Dispatches project:init
}
  ↓
return room_id;
```

**Benefits:**

- ✅ **Fast startup**: Gateway ready in seconds
- ✅ **Resource efficient**: Only active projects consume resources
- ✅ **Organic discovery**: New projects discovered when accessed

---

### Decision 5: Fresh Organization Member Data

**Current**: Organization members passed in `/collab/start` handshake config
**Problem**: Stale data if members change after gateway startup

**Decision**: Fetch organization members from Ganymede when needed

**Implementation:**

```typescript
// Remove from handshake:
// config.members = [...]

// Add to GatewayState:
async fetchOrganizationMembers(): Promise<OrgMember[]> {
  // Fetch from Ganymede API
}
```

**Benefits:**

- ✅ **Fresh data**: Always up-to-date member list
- ✅ **Simpler handshake**: Less data in initial config
- ✅ **Robust**: Handles member changes after gateway startup

---

### Decision 6: Module Permission Integration (No Changes Required)

**Decision**: Modules continue registering permissions exactly as before

**Module Perspective:**

```typescript
// Registration (unchanged)
permissionRegistry.register('my-module:[resource:*]:action', {
  description: 'My action'
});

// Checking (unchanged)
if (!permissionManager.hasPermission(user_id, 'my-module:[resource:123]:action')) {
  throw new ForbiddenException([...]);
}
```

**RBAC Integration:**

- Roles can contain module-registered permissions
- Wildcard matching supports `[resource:*]` patterns
- PermissionManager.hasPermission() resolves via roles transparently

**Benefits:**

- ✅ **Zero module changes**: Modules work without modification
- ✅ **Future-proof**: New modules automatically supported
- ✅ **Consistent**: Same permission format throughout

---

## Detailed Implementation Plan

### Phase 1: Core RBAC Infrastructure (Backend)

**Duration**: ~3 days
**Dependencies**: None

#### Task 1.1: Create RoleManager

**File**: `packages/app-gateway/src/permissions/RoleManager.ts`

**Interface:**

```typescript
export interface Role {
  role_id: string;
  role_name: string; // "org:owner", "org:admin", "developer"
  display_name: string;
  description: string;
  permissions: string[]; // ["*"] or ["project:[*]:create", ...]
  immutable: boolean; // System roles cannot be edited/deleted
  system: boolean; // Built-in vs custom
  scope: 'org' | 'project';
}

export class RoleManager implements IPersistenceProvider {
  private roles: Map<string, Role>;

  constructor();

  // CRUD
  createRole(role: Omit<Role, 'role_id'>): string;
  getRole(role_id: string): Role | undefined;
  getRoleByName(role_name: string): Role | undefined;
  updateRole(role_id: string, updates: Partial<Role>): void;
  deleteRole(role_id: string): void;

  // Queries
  getAllRoles(): Role[];
  getRolesByScope(scope: 'org' | 'project'): Role[];
  getSystemRoles(): Role[];
  getCustomRoles(): Role[];

  // Initialization
  initializeDefaultRoles(): void;

  // Persistence
  loadFromSerializable(data: any): void;
  saveToSerializable(): any;
}
```

**Default System Roles:**

```typescript
const DEFAULT_SYSTEM_ROLES: Omit<Role, 'role_id'>[] = [
  {
    role_name: 'org:owner',
    display_name: 'Organization Owner',
    description: 'Full control over organization and all projects',
    permissions: ['*'],
    immutable: true,
    system: true,
    scope: 'org',
  },
  {
    role_name: 'org:admin',
    display_name: 'Organization Administrator',
    description: 'Manage projects, members, and permissions',
    permissions: [
      'org:[*]:admin',
      'project:[*]:create',
      'project:[*]:admin',
      'project:[*]:delete',
      'gateway:[permissions:*]:read',
      'gateway:[permissions:*]:write',
      'gateway:[roles:*]:read',
      'gateway:[roles:*]:write',
      'user-containers:[user-container:*]:*',
    ],
    immutable: true,
    system: true,
    scope: 'org',
  },
];
```

**Validation:**

- System roles cannot be edited or deleted
- Role names must be unique
- Permissions must follow valid format

**Tests:**

- Create role with valid data
- Attempt to edit system role (should fail)
- Attempt to delete role assigned to users (should fail)
- Load/save serialization

---

#### Task 1.2: Create UserRoleManager

**File**: `packages/app-gateway/src/permissions/UserRoleManager.ts`

**Interface:**

```typescript
export interface UserRoleAssignments {
  org_roles: string[]; // role_ids with scope=org
  project_roles: {
    [project_id: string]: string[]; // role_ids with scope=project
  };
}

export class UserRoleManager implements IPersistenceProvider {
  private userRoles: Map<string, UserRoleAssignments>;
  private roleManager: RoleManager; // Reference to resolve roles

  constructor(roleManager: RoleManager);

  // Assignment
  assignOrgRole(user_id: string, role_id: string): void;
  removeOrgRole(user_id: string, role_id: string): void;
  assignProjectRole(user_id: string, project_id: string, role_id: string): void;
  removeProjectRole(user_id: string, project_id: string, role_id: string): void;
  removeAllProjectRoles(user_id: string, project_id: string): void;

  // Queries
  getUserOrgRoles(user_id: string): Role[];
  getUserProjectRoles(user_id: string, project_id: string): Role[];
  getAllUserRoles(user_id: string, project_id?: string): Role[];

  // Permission resolution
  getUserPermissions(user_id: string, project_id?: string): string[];

  // Bulk operations
  getUsersWithRole(role_id: string): string[];
  removeRoleFromAllUsers(role_id: string): void;

  // Persistence
  loadFromSerializable(data: any): void;
  saveToSerializable(): any;
}
```

**Validation:**

- Org roles must have scope=org
- Project roles must have scope=project
- Cannot assign non-existent role
- Role must exist in RoleManager

**Tests:**

- Assign org role to user
- Assign project role to user
- Get all user roles (org + project)
- Remove role from user
- Bulk removal when role deleted

---

#### Task 1.3: Update PermissionManager with Role Resolution

**File**: `packages/app-gateway/src/permissions/PermissionManager.ts`

**Changes:**

```typescript
export class PermissionManager implements IPersistenceProvider {
  private permissions: Map<string, string[]>; // Direct permissions (backward compat)
  private userRoleManager?: UserRoleManager; // NEW: Reference for role resolution

  // NEW: Set UserRoleManager reference
  setUserRoleManager(userRoleManager: UserRoleManager): void {
    this.userRoleManager = userRoleManager;
  }

  // UPDATED: Check via direct permissions OR roles
  hasPermission(
    user_id: string,
    permission: string,
    project_id?: string
  ): boolean {
    // 1. Check direct permissions (backward compat)
    const directPerms = this.permissions.get(user_id) || [];
    if (directPerms.includes(permission)) {
      return true;
    }

    // 2. Check via roles (if available)
    if (this.userRoleManager) {
      return this.hasPermissionViaRoles(user_id, permission, project_id);
    }

    return false;
  }

  // NEW: Check permission via role resolution
  private hasPermissionViaRoles(
    user_id: string,
    permission: string,
    project_id?: string
  ): boolean {
    // Get all user roles (org + project-specific)
    const roles = this.userRoleManager!.getAllUserRoles(user_id, project_id);

    // Special case: org:owner always has access
    if (roles.some((r) => r.role_name === 'org:owner')) {
      return true;
    }

    // Get all permissions from all roles
    const rolePermissions = roles.flatMap((r) => r.permissions);

    // Check if any role permission matches (with wildcard)
    return rolePermissions.some((roleP) =>
      this.matchPermission(roleP, permission)
    );
  }

  // NEW: Wildcard permission matching
  private matchPermission(pattern: string, permission: string): boolean {
    if (pattern === '*') return true; // Universal wildcard

    const patternParts = pattern.split(':');
    const permParts = permission.split(':');

    if (patternParts.length !== permParts.length) return false;

    return patternParts.every((part, i) => {
      if (part === '*') return true; // Wildcard in this position

      // Handle resource path wildcards: [user-container:*]
      if (part.startsWith('[') && part.endsWith(']')) {
        const patternResource = part.slice(1, -1);
        const permResource = permParts[i].slice(1, -1);
        return this.matchResourcePath(patternResource, permResource);
      }

      return part === permParts[i]; // Exact match
    });
  }

  // NEW: Match resource paths with wildcards
  private matchResourcePath(pattern: string, resource: string): boolean {
    // "user-container:*" matches "user-container:abc123"
    // "user-container:abc/service:*" matches "user-container:abc/service:xyz"
    const patternParts = pattern.split('/');
    const resourceParts = resource.split('/');

    if (patternParts.length !== resourceParts.length) return false;

    return patternParts.every((pp, i) => {
      const [pType, pId] = pp.split(':');
      const [rType, rId] = resourceParts[i].split(':');

      if (pType !== rType) return false;
      if (pId === '*') return true; // Wildcard ID
      return pId === rId;
    });
  }

  // Existing methods unchanged...
}
```

**Tests:**

- Wildcard matching: `project:[*]:admin` matches `project:abc:admin`
- Resource wildcard: `user-containers:[user-container:*]:create` matches `user-containers:[user-container:123]:create`
- Nested wildcards: `user-containers:[user-container:*/service:*]:read`
- Universal wildcard: `*` matches everything
- org:owner always has access
- Backward compat: direct permissions still work

---

#### Task 1.4: Initialize Managers in Gateway Startup

**File**: `packages/app-gateway/src/initialization/gateway-init.ts`

**Changes:**

```typescript
export async function initializeGatewayForOrganization(...): Promise<GatewayInstances> {
  // ... existing code ...

  // 3. Create manager instances
  const roleManager = new RoleManager();           // NEW
  const userRoleManager = new UserRoleManager(roleManager);  // NEW
  const permissionManager = new PermissionManager();
  const oauthManager = new OAuthManager();
  const tokenManager = new TokenManager();
  const projectRooms = new ProjectRoomsManager();

  // 3.5. Wire up managers
  permissionManager.setUserRoleManager(userRoleManager);  // NEW

  // 4. Register all managers with GatewayState
  gatewayState.register('roles', roleManager);           // NEW
  gatewayState.register('user_roles', userRoleManager);  // NEW
  gatewayState.register('permissions', permissionManager);
  gatewayState.register('oauth', oauthManager);
  gatewayState.register('projects', projectRooms);

  // 4.5. Initialize default system roles
  roleManager.initializeDefaultRoles();  // NEW

  // ... rest of initialization ...

  return {
    gatewayState,
    roleManager,        // NEW
    userRoleManager,    // NEW
    permissionManager,
    // ... other instances ...
  };
}
```

**GatewayInstances Type Update:**

```typescript
export interface GatewayInstances {
  gatewayState: GatewayState;
  roleManager: RoleManager; // NEW
  userRoleManager: UserRoleManager; // NEW
  permissionManager: PermissionManager;
  // ... rest ...
}
```

---

### Phase 2: Gateway Events & Member Management

**Duration**: ~2 days
**Dependencies**: Phase 1

#### Task 2.1: Remove Members from /collab/start Handshake

**File**: `packages/app-ganymede/src/routes/gateway/index.ts`

**Changes:**

```typescript
// REMOVE from config:
// members: orgMembers,

// Config becomes:
const config = {
  organization_id: allocationRow['organization_id'],
  gateway_id: allocationRow['gateway_id'],
  organization_token: organizationToken,
  projects: projectIds, // Keep projects for reference
};
```

**File**: `packages/app-gateway/src/routes/collab.ts`

**Changes:**

```typescript
// REMOVE member initialization logic:
// const { members } = config;
// config.members no longer exists
```

---

#### Task 2.2: Add GatewayState.fetchOrganizationMembers()

**File**: `packages/app-gateway/src/state/GatewayState.ts`

**Changes:**

```typescript
export class GatewayState {
  // ... existing fields ...

  /**
   * Fetch fresh organization members from Ganymede
   * Used when initializing permissions for projects
   */
  async fetchOrganizationMembers(): Promise<OrgMember[]> {
    if (!this.organizationId || !this.organizationToken) {
      throw new Error('Gateway not initialized with organization context');
    }

    const ganymedeUrl = process.env.GANYMEDE_URL || 'http://app-ganymede:3000';
    const url = `${ganymedeUrl}/orgs/${this.organizationId}/members`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.organizationToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch org members: ${response.status} ${response.statusText}`
      );
    }

    const { members } = await response.json();
    return members; // [{ user_id, username, email, role: "owner"|"admin"|"member" }]
  }
}

export interface OrgMember {
  user_id: string;
  username: string;
  email: string;
  role: 'owner' | 'admin' | 'member'; // Database role (simple)
}
```

---

#### Task 2.3: Create Member Add Event Handler

**File**: `packages/app-gateway/src/events/member-events.ts` (NEW)

```typescript
import { getGatewayInstances } from '../initialization/gateway-instances';
import { RequestData } from '@holistix-forge/reducers';
import { ForbiddenException, NotFoundException } from '@holistix-forge/log';

export type MemberAddEvent = {
  type: 'member:add';
  project_id: string;
  user_id: string;
  role_ids: string[]; // Roles to assign
};

export type MemberRemoveEvent = {
  type: 'member:remove';
  project_id: string;
  user_id: string;
};

/**
 * Handle member:add event
 * 1. Validate requester has permission
 * 2. Validate user is org member
 * 3. Validate roles exist and are project-scoped
 * 4. Assign roles in gateway state
 * 5. Call Ganymede internal API to persist
 */
export async function handleMemberAdd(
  event: MemberAddEvent,
  requestData: RequestData
): Promise<void> {
  const { project_id, user_id, role_ids } = event;
  const instances = getGatewayInstances();

  if (!instances) {
    throw new Error('Gateway instances not initialized');
  }

  // 1. Validate: Requester has permission to manage project members
  const hasPermission = instances.permissionManager.hasPermission(
    requestData.user_id,
    `project:${project_id}:admin`,
    project_id
  );

  if (!hasPermission) {
    throw new ForbiddenException([
      { message: 'Permission denied: project:admin required' },
    ]);
  }

  // 2. Validate: User is organization member
  const orgMembers = await instances.gatewayState.fetchOrganizationMembers();
  const isMember = orgMembers.some((m) => m.user_id === user_id);

  if (!isMember) {
    throw new ForbiddenException([
      { message: 'User must be organization member first' },
    ]);
  }

  // 3. Validate: Roles exist and are project-scoped
  for (const role_id of role_ids) {
    const role = instances.roleManager.getRole(role_id);

    if (!role) {
      throw new NotFoundException([{ message: `Role not found: ${role_id}` }]);
    }

    if (role.scope !== 'project') {
      throw new ForbiddenException([
        {
          message: `Role ${role.role_name} is not project-scoped (scope: ${role.scope})`,
        },
      ]);
    }
  }

  // 4. Assign roles in gateway state
  for (const role_id of role_ids) {
    instances.userRoleManager.assignProjectRole(user_id, project_id, role_id);
  }

  // 5. Call Ganymede internal API to add to projects_members table
  const ganymedeUrl = process.env.GANYMEDE_URL || 'http://app-ganymede:3000';
  const gatewayToken =
    process.env.GATEWAY_TOKEN || instances.gatewayState.getOrganizationToken();

  const response = await fetch(
    `${ganymedeUrl}/internal/projects/${project_id}/members`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Gateway-Token': gatewayToken,
      },
      body: JSON.stringify({ user_id }),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Failed to add member in Ganymede: ${response.status} ${response.statusText}`
    );
  }

  // Gateway state will autosave roles
}

/**
 * Handle member:remove event
 * 1. Validate requester has permission
 * 2. Remove all project roles for user
 * 3. Call Ganymede internal API to remove from projects_members
 */
export async function handleMemberRemove(
  event: MemberRemoveEvent,
  requestData: RequestData
): Promise<void> {
  const { project_id, user_id } = event;
  const instances = getGatewayInstances();

  if (!instances) {
    throw new Error('Gateway instances not initialized');
  }

  // 1. Validate: Requester has permission
  const hasPermission = instances.permissionManager.hasPermission(
    requestData.user_id,
    `project:${project_id}:admin`,
    project_id
  );

  if (!hasPermission) {
    throw new ForbiddenException([
      { message: 'Permission denied: project:admin required' },
    ]);
  }

  // 2. Remove all project roles for user
  instances.userRoleManager.removeAllProjectRoles(user_id, project_id);

  // 3. Call Ganymede internal API
  const ganymedeUrl = process.env.GANYMEDE_URL || 'http://app-ganymede:3000';
  const gatewayToken =
    process.env.GATEWAY_TOKEN || instances.gatewayState.getOrganizationToken();

  const response = await fetch(
    `${ganymedeUrl}/internal/projects/${project_id}/members/${user_id}`,
    {
      method: 'DELETE',
      headers: {
        'X-Gateway-Token': gatewayToken,
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `Failed to remove member in Ganymede: ${response.status} ${response.statusText}`
    );
  }
}
```

**Register Events:**

```typescript
// In gateway module's reducers
case 'member:add':
  return handleMemberAdd(event, requestData);
case 'member:remove':
  return handleMemberRemove(event, requestData);
```

---

#### Task 2.4: Update project:init to Initialize Permissions

**File**: `packages/app-gateway/src/state/ProjectRooms.ts`

**Changes:**

```typescript
export class ProjectRoomsManager implements IPersistenceProvider {
  // ... existing code ...

  /**
   * Initialize permissions for a project
   * Called after project:init event dispatch
   */
  private async initializeProjectPermissions(
    project_id: string
  ): Promise<void> {
    const instances = getGatewayInstances();
    if (!instances) {
      throw new Error('Gateway instances not initialized');
    }

    // Fetch fresh organization members
    const orgMembers = await instances.gatewayState.fetchOrganizationMembers();

    // Get project members from Ganymede
    const ganymedeUrl = process.env.GANYMEDE_URL || 'http://app-ganymede:3000';
    const orgToken = instances.gatewayState.getOrganizationToken();

    const response = await fetch(
      `${ganymedeUrl}/projects/${project_id}/members`,
      {
        headers: {
          Authorization: `Bearer ${orgToken}`,
        },
      }
    );

    if (!response.ok) {
      log(
        EPriority.Warning,
        'PROJECT_ROOMS',
        `Failed to fetch project members for ${project_id}: ${response.statusText}`
      );
      return;
    }

    const { members } = await response.json();

    // Initialize permissions:
    // 1. Org owners/admins already have access via org roles (no action needed)
    // 2. Project members without roles need default access

    // Get default project role (if exists)
    const defaultRole = instances.roleManager.getRoleByName('project:access');

    for (const member of members) {
      // Check if user already has project-specific roles
      const projectRoles = instances.userRoleManager.getUserProjectRoles(
        member.user_id,
        project_id
      );

      if (projectRoles.length > 0) {
        continue; // User already has roles
      }

      // Check if user has org admin/owner role
      const orgRoles = instances.userRoleManager.getUserOrgRoles(
        member.user_id
      );
      const isOrgAdmin = orgRoles.some(
        (r) => r.role_name === 'org:owner' || r.role_name === 'org:admin'
      );

      if (isOrgAdmin) {
        continue; // Org admins already have access via org roles
      }

      // Assign default role if available
      if (defaultRole) {
        instances.userRoleManager.assignProjectRole(
          member.user_id,
          project_id,
          defaultRole.role_id
        );

        log(
          EPriority.Info,
          'PROJECT_ROOMS',
          `Assigned default role to user ${member.user_id} for project ${project_id}`
        );
      }
    }
  }

  /**
   * Initialize a project room
   * Gets YJS doc from y-websocket (creates it if needed), generates room_id, loads saved state
   *
   * IMPORTANT: Uses ywsUtils.getYDoc() to get the SAME doc that WebSocket clients will connect to
   */
  async initializeProject(project_id: string): Promise<string> {
    // ... existing code for YJS doc initialization ...

    // Dispatch project:init event for modules to create default data
    if (this.eventProcessor) {
      const systemRequestData = {
        ip: 'system',
        user_id: 'system',
        jwt: {},
        headers: {},
        project_id,
      };

      await this.eventProcessor
        .processEvent({ type: 'project:init', project_id }, systemRequestData)
        .catch((err) => {
          log(
            EPriority.Error,
            'PROJECT_ROOMS',
            `Failed to dispatch project:init for ${project_id}`,
            err
          );
        });
    }

    // NEW: Initialize permissions after project:init
    await this.initializeProjectPermissions(project_id);

    log(
      EPriority.Info,
      'PROJECT_ROOMS',
      `✅ Project fully initialized: ${project_id}, room: ${room_id}`
    );

    return room_id;
  }
}
```

---

### Phase 3: Ganymede API Changes

**Duration**: ~1 day
**Dependencies**: Phase 2

#### Task 3.1: Create Ganymede Internal API Routes

**File**: `packages/app-ganymede/src/routes/internal/projects.ts` (NEW)

```typescript
import { Router, Request, RequestHandler } from 'express';
import { authenticateGatewayToken } from '../../middleware/gateway-auth';
import { pg } from '../../database/pg';
import { asyncHandler } from '../../middleware/route-handler';

export const setupInternalProjectRoutes = (
  router: Router,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  rateLimiter?: RequestHandler
) => {
  /**
   * POST /internal/projects/:project_id/members
   * Add member to project (Gateway-only)
   *
   * This route is ONLY callable by gateway (not frontend)
   * Gateway manages roles, this just updates projects_members table
   */
  router.post(
    '/internal/projects/:project_id/members',
    authenticateGatewayToken, // NEW middleware
    asyncHandler(async (req: Request, res) => {
      const { user_id } = req.body;

      if (!user_id) {
        return res.status(400).json({ error: 'user_id required' });
      }

      await pg.query('CALL proc_projects_members_edit($1, $2, $3)', [
        req.params.project_id,
        user_id,
        true, // add = true
      ]);

      return res.json({ success: true });
    })
  );

  /**
   * DELETE /internal/projects/:project_id/members/:user_id
   * Remove member from project (Gateway-only)
   */
  router.delete(
    '/internal/projects/:project_id/members/:user_id',
    authenticateGatewayToken,
    asyncHandler(async (req: Request, res) => {
      await pg.query('CALL proc_projects_members_edit($1, $2, $3)', [
        req.params.project_id,
        req.params.user_id,
        false, // add = false
      ]);

      return res.json({ success: true });
    })
  );
};
```

**File**: `packages/app-ganymede/src/middleware/gateway-auth.ts` (NEW)

```typescript
import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to authenticate gateway requests
 * Checks X-Gateway-Token header against GATEWAY_TOKEN env var
 */
export const authenticateGatewayToken = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const providedToken = req.headers['x-gateway-token'];
  const expectedToken = process.env.GATEWAY_TOKEN;

  if (!expectedToken) {
    console.error('GATEWAY_TOKEN not configured');
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  if (!providedToken) {
    return res.status(401).json({ error: 'Gateway token required' });
  }

  if (providedToken !== expectedToken) {
    return res.status(403).json({ error: 'Invalid gateway token' });
  }

  next();
};
```

**File**: `packages/app-ganymede/src/app.ts`

```typescript
import { setupInternalProjectRoutes } from './routes/internal/projects';

// ... existing code ...

// Register internal routes
setupInternalProjectRoutes(router, rateLimiter);
```

---

#### Task 3.2: Deprecate Public Ganymede Project Member Routes

**File**: `packages/app-ganymede/src/routes/projects/index.ts`

**Changes:**

```typescript
// POST /projects/:project_id/members - DEPRECATED
router.post(
  '/projects/:project_id/members',
  authenticateJwtUser,
  asyncHandler(async (req: AuthRequest, res) => {
    return res.status(410).json({
      error: 'Endpoint deprecated',
      message: 'Use gateway member management instead',
      see: 'POST /gateway/events with type:member:add',
      migration: 'This endpoint will be removed in v2.0',
    });
  })
);

// DELETE /projects/:project_id/members/:user_id - DEPRECATED
router.delete(
  '/projects/:project_id/members/:user_id',
  authenticateJwtUser,
  asyncHandler(async (req: AuthRequest, res) => {
    return res.status(410).json({
      error: 'Endpoint deprecated',
      message: 'Use gateway member management instead',
      see: 'POST /gateway/events with type:member:remove',
      migration: 'This endpoint will be removed in v2.0',
    });
  })
);

// GET /projects/:project_id/members - KEEP (read-only)
// No changes - this is used for listing members
```

**Update OpenAPI Spec:**

```typescript
// packages/app-ganymede/src/oas30.json
// Mark POST and DELETE as deprecated
{
  "/projects/{project_id}/members": {
    "post": {
      "deprecated": true,
      "description": "DEPRECATED: Use gateway member management API instead",
      // ... rest
    }
  },
  "/projects/{project_id}/members/{user_id}": {
    "delete": {
      "deprecated": true,
      "description": "DEPRECATED: Use gateway member management API instead",
      // ... rest
    }
  }
}
```

---

#### Task 3.3: Update proc_projects_new to Add Creator

**File**: `packages/app-ganymede/database/procedures/proc_projects_new.sql`

**Changes:**

```sql
CREATE OR REPLACE PROCEDURE public.proc_projects_new(
    IN in_organization_id uuid,
    IN in_project_name character varying(100),
    IN in_public boolean,
    IN in_creator_user_id uuid,  -- NEW parameter
    OUT new_project_id uuid
)
LANGUAGE 'plpgsql'
AS $BODY$
BEGIN
    new_project_id := gen_random_uuid();

    INSERT INTO projects (
        project_id,
        organization_id,
        name,
        public,
        created_at
    ) VALUES (
        new_project_id,
        in_organization_id,
        in_project_name,
        in_public,
        NOW()
    );

    -- Add creator to projects_members (for project listing)
    IF in_creator_user_id IS NOT NULL THEN
        INSERT INTO projects_members (project_id, user_id, added_at)
        VALUES (new_project_id, in_creator_user_id, NOW())
        ON CONFLICT (project_id, user_id) DO NOTHING;
    END IF;

    RETURN;
END;
$BODY$;
```

**File**: `packages/app-ganymede/src/routes/projects/index.ts`

**Changes:**

```typescript
// POST /projects - Create project
router.post(
  '/projects',
  authenticateJwtUser,
  asyncHandler(async (req: AuthRequest, res) => {
    const { organization_id, name, public: isPublic } = req.body;

    // Check user is org member
    const roleCheck = await pg.query(
      'SELECT func_user_get_org_role($1, $2) as role',
      [req.user.id, organization_id]
    );
    const role = roleCheck.next()?.oneRow()['role'] as string | null;
    if (!role) {
      return res.status(403).json({ error: 'Not organization member' });
    }

    // Create project with creator
    const result = await pg.query(
      'CALL proc_projects_new($1, $2, $3, $4, $5)',
      [
        organization_id,
        name,
        isPublic,
        req.user.id, // NEW: Pass creator user_id
        null,
      ]
    );

    const new_project_id = result.next()?.oneRow()['new_project_id'];
    return res.json({ project_id: new_project_id });
  })
);
```

---

### Phase 4: Lazy Project Initialization

**Duration**: ~1 day
**Dependencies**: Phase 2, Phase 3

#### Task 4.1: Implement Lazy Initialization in GET /collab/room-id

**File**: `packages/app-gateway/src/routes/collab.ts`

**Changes:**

```typescript
/**
 * GET /collab/room-id?project_id=<uuid>
 * Get room ID for a project (lazy initialization)
 *
 * If project not initialized, initializes it now
 */
router.get(
  '/collab/room-id',
  authenticateJwt,
  requireProjectAccess(), // Middleware checks permission
  asyncHandler(async (req: AuthRequest, res) => {
    const project_id = req.query.project_id as string;

    if (!project_id) {
      return res.status(400).json({ error: 'project_id required' });
    }

    const instances = getGatewayInstances();
    if (!instances) {
      throw new NotFoundException([
        { message: 'Gateway instances not initialized' },
      ]);
    }

    // Check if project is already initialized
    let room_id = instances.projectRooms.getRoomId(project_id);

    // If not initialized, do it NOW (lazy initialization)
    if (!room_id) {
      log(
        EPriority.Info,
        'COLLAB',
        `🔄 Lazy initializing project: ${project_id}`
      );

      const startTime = Date.now();

      try {
        room_id = await instances.projectRooms.initializeProject(project_id);

        const duration = Date.now() - startTime;
        log(
          EPriority.Info,
          'COLLAB',
          `✅ Project initialized in ${duration}ms: ${project_id}, room: ${room_id}`
        );
      } catch (error: any) {
        log(
          EPriority.Error,
          'COLLAB',
          `Failed to initialize project ${project_id}: ${error.message}`,
          error
        );
        throw error;
      }
    }

    return res.json({ room_id });
  })
);
```

---

#### Task 4.2: Remove Eager Initialization from /collab/start

**File**: `packages/app-gateway/src/routes/collab.ts`

**Changes:**

```typescript
router.post(
  '/collab/start',
  asyncHandler(async (req: Request, res) => {
    // ... handshake validation ...

    // Initialize gateway with organization context
    if (
      config.organization_token &&
      config.organization_id &&
      config.gateway_id
    ) {
      const { getServers } = await import('../servers');
      const servers = getServers();

      const instances = await initializeGatewayForOrganization(
        config.organization_id,
        config.gateway_id,
        config.organization_token,
        servers
      );

      // REMOVE eager project initialization
      /*
      if (config.projects && config.projects.length > 0) {
        for (const project_id of config.projects) {
          await instances.projectRooms.initializeProject(project_id);
        }
      }
      */

      // NEW: Just log that projects exist (will initialize on demand)
      if (config.projects && config.projects.length > 0) {
        log(
          EPriority.Info,
          'GATEWAY',
          `Gateway has ${config.projects.length} projects (will initialize on demand)`
        );
      } else {
        log(
          EPriority.Info,
          'GATEWAY',
          'No projects registered for this organization'
        );
      }
    }

    return res.json({});
  })
);
```

---

### Phase 5: Gateway Role API Routes

**Duration**: ~2 days
**Dependencies**: Phase 1

#### Task 5.1: Create Role CRUD API

**File**: `packages/app-gateway/src/routes/roles.ts` (NEW)

```typescript
import { Router, Request, RequestHandler } from 'express';
import { asyncHandler } from '../middleware/route-handler';
import { authenticateJwt } from '../middleware/jwt-auth';
import { requirePermission } from '../middleware/permissions';
import { getGatewayInstances } from '../initialization/gateway-instances';
import { Role } from '../permissions/RoleManager';

export const setupRolesRoutes = (
  router: Router,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  rateLimiter?: RequestHandler
) => {
  /**
   * GET /roles
   * List all roles (system + custom)
   * Requires: gateway:[roles:*]:read
   */
  router.get(
    '/roles',
    authenticateJwt,
    requirePermission('gateway:[roles:*]:read'),
    asyncHandler(async (req: Request, res) => {
      const instances = getGatewayInstances();
      if (!instances) {
        return res.status(500).json({ error: 'Gateway not initialized' });
      }

      const roles = instances.roleManager.getAllRoles();
      return res.json({ roles });
    })
  );

  /**
   * GET /roles/:role_id
   * Get role by ID
   * Requires: gateway:[roles:*]:read
   */
  router.get(
    '/roles/:role_id',
    authenticateJwt,
    requirePermission('gateway:[roles:*]:read'),
    asyncHandler(async (req: Request, res) => {
      const instances = getGatewayInstances();
      if (!instances) {
        return res.status(500).json({ error: 'Gateway not initialized' });
      }

      const role = instances.roleManager.getRole(req.params.role_id);
      if (!role) {
        return res.status(404).json({ error: 'Role not found' });
      }

      return res.json(role);
    })
  );

  /**
   * POST /roles
   * Create custom role
   * Requires: gateway:[roles:*]:write
   */
  router.post(
    '/roles',
    authenticateJwt,
    requirePermission('gateway:[roles:*]:write'),
    asyncHandler(async (req: Request, res) => {
      const instances = getGatewayInstances();
      if (!instances) {
        return res.status(500).json({ error: 'Gateway not initialized' });
      }

      const { role_name, display_name, description, permissions, scope } =
        req.body;

      // Validation
      if (!role_name || !display_name || !permissions || !scope) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['role_name', 'display_name', 'permissions', 'scope'],
        });
      }

      if (!Array.isArray(permissions)) {
        return res.status(400).json({ error: 'permissions must be array' });
      }

      if (!['org', 'project'].includes(scope)) {
        return res.status(400).json({ error: 'scope must be org or project' });
      }

      // Create role
      const role_id = instances.roleManager.createRole({
        role_name,
        display_name,
        description: description || '',
        permissions,
        scope,
        immutable: false,
        system: false,
      });

      const role = instances.roleManager.getRole(role_id);
      return res.status(201).json(role);
    })
  );

  /**
   * PATCH /roles/:role_id
   * Update custom role
   * Requires: gateway:[roles:*]:write
   */
  router.patch(
    '/roles/:role_id',
    authenticateJwt,
    requirePermission('gateway:[roles:*]:write'),
    asyncHandler(async (req: Request, res) => {
      const instances = getGatewayInstances();
      if (!instances) {
        return res.status(500).json({ error: 'Gateway not initialized' });
      }

      const role = instances.roleManager.getRole(req.params.role_id);
      if (!role) {
        return res.status(404).json({ error: 'Role not found' });
      }

      if (role.immutable) {
        return res.status(403).json({
          error: 'Cannot modify system role',
          role: role.role_name,
        });
      }

      const { display_name, description, permissions } = req.body;

      instances.roleManager.updateRole(req.params.role_id, {
        display_name,
        description,
        permissions,
      });

      const updated = instances.roleManager.getRole(req.params.role_id);
      return res.json(updated);
    })
  );

  /**
   * DELETE /roles/:role_id
   * Delete custom role
   * Requires: gateway:[roles:*]:write
   */
  router.delete(
    '/roles/:role_id',
    authenticateJwt,
    requirePermission('gateway:[roles:*]:write'),
    asyncHandler(async (req: Request, res) => {
      const instances = getGatewayInstances();
      if (!instances) {
        return res.status(500).json({ error: 'Gateway not initialized' });
      }

      const role = instances.roleManager.getRole(req.params.role_id);
      if (!role) {
        return res.status(404).json({ error: 'Role not found' });
      }

      if (role.immutable) {
        return res.status(403).json({
          error: 'Cannot delete system role',
          role: role.role_name,
        });
      }

      // Remove role from all users first
      instances.userRoleManager.removeRoleFromAllUsers(req.params.role_id);

      // Delete role
      instances.roleManager.deleteRole(req.params.role_id);

      return res.json({ success: true });
    })
  );
};
```

**Register Routes:**

```typescript
// packages/app-gateway/src/main.ts
import { setupRolesRoutes } from './routes/roles';

// ... existing code ...
setupRolesRoutes(router, rateLimiter);
```

---

#### Task 5.2: Create User-Role Assignment API

**File**: `packages/app-gateway/src/routes/user-roles.ts` (NEW)

```typescript
import { Router, Request, RequestHandler } from 'express';
import { asyncHandler } from '../middleware/route-handler';
import { authenticateJwt } from '../middleware/jwt-auth';
import { requirePermission } from '../middleware/permissions';
import { getGatewayInstances } from '../initialization/gateway-instances';

export const setupUserRolesRoutes = (
  router: Router,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  rateLimiter?: RequestHandler
) => {
  /**
   * GET /users/:user_id/roles
   * Get user's roles (org + project-specific)
   * Requires: gateway:[roles:*]:read
   */
  router.get(
    '/users/:user_id/roles',
    authenticateJwt,
    requirePermission('gateway:[roles:*]:read'),
    asyncHandler(async (req: Request, res) => {
      const instances = getGatewayInstances();
      if (!instances) {
        return res.status(500).json({ error: 'Gateway not initialized' });
      }

      const { project_id } = req.query;
      const { user_id } = req.params;

      const orgRoles = instances.userRoleManager.getUserOrgRoles(user_id);

      let projectRoles = {};
      if (project_id) {
        projectRoles = {
          [project_id as string]: instances.userRoleManager.getUserProjectRoles(
            user_id,
            project_id as string
          ),
        };
      }

      return res.json({
        org_roles: orgRoles,
        project_roles: projectRoles,
      });
    })
  );

  /**
   * POST /users/:user_id/roles
   * Assign role to user
   * Body: { role_id: string, scope: 'org' | 'project', project_id?: string }
   * Requires: gateway:[roles:*]:write
   */
  router.post(
    '/users/:user_id/roles',
    authenticateJwt,
    requirePermission('gateway:[roles:*]:write'),
    asyncHandler(async (req: Request, res) => {
      const instances = getGatewayInstances();
      if (!instances) {
        return res.status(500).json({ error: 'Gateway not initialized' });
      }

      const { user_id } = req.params;
      const { role_id, scope, project_id } = req.body;

      // Validation
      if (!role_id || !scope) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['role_id', 'scope'],
        });
      }

      if (scope === 'project' && !project_id) {
        return res.status(400).json({
          error: 'project_id required for project-scoped role',
        });
      }

      // Check role exists
      const role = instances.roleManager.getRole(role_id);
      if (!role) {
        return res.status(404).json({ error: 'Role not found' });
      }

      // Assign role
      if (scope === 'org') {
        if (role.scope !== 'org') {
          return res.status(400).json({
            error: `Role ${role.role_name} is not org-scoped`,
          });
        }
        instances.userRoleManager.assignOrgRole(user_id, role_id);
      } else {
        if (role.scope !== 'project') {
          return res.status(400).json({
            error: `Role ${role.role_name} is not project-scoped`,
          });
        }
        instances.userRoleManager.assignProjectRole(
          user_id,
          project_id,
          role_id
        );
      }

      return res.json({ success: true });
    })
  );

  /**
   * DELETE /users/:user_id/roles/:role_id
   * Remove role from user
   * Query: ?project_id=<uuid> (for project-scoped roles)
   * Requires: gateway:[roles:*]:write
   */
  router.delete(
    '/users/:user_id/roles/:role_id',
    authenticateJwt,
    requirePermission('gateway:[roles:*]:write'),
    asyncHandler(async (req: Request, res) => {
      const instances = getGatewayInstances();
      if (!instances) {
        return res.status(500).json({ error: 'Gateway not initialized' });
      }

      const { user_id, role_id } = req.params;
      const { project_id } = req.query;

      const role = instances.roleManager.getRole(role_id);
      if (!role) {
        return res.status(404).json({ error: 'Role not found' });
      }

      if (role.scope === 'org') {
        instances.userRoleManager.removeOrgRole(user_id, role_id);
      } else {
        if (!project_id) {
          return res.status(400).json({
            error: 'project_id required for project-scoped role',
          });
        }
        instances.userRoleManager.removeProjectRole(
          user_id,
          project_id as string,
          role_id
        );
      }

      return res.json({ success: true });
    })
  );
};
```

**Register Routes:**

```typescript
// packages/app-gateway/src/main.ts
import { setupUserRolesRoutes } from './routes/user-roles';

// ... existing code ...
setupUserRolesRoutes(router, rateLimiter);
```

---

### Phase 6: Frontend UI Updates

**Duration**: ~3 days
**Dependencies**: Phase 5

#### Task 6.1: Update UsersScopes UI to Show Roles

**File**: `packages/ui-base/src/lib/users-scopes/users-scopes.tsx`

**Changes:**

```typescript
// Update TCollaborator interface
export interface TCollaborator extends TF_User {
  roles: Role[]; // NEW: Array of role objects (not just IDs)
  scope: string[]; // Keep for backward compat (permissions)
  is_owner: boolean;
}

// Update component to display roles
export const UsersScopes = ({
  collaborators,
  // ... other props
  roles: availableRoles, // NEW: All available roles
}: UsersScopesProps) => {
  // ... existing code ...

  return (
    <div className="panel-edit-scopes">
      <span className="panel-title">Edit roles</span>

      {/* Show current roles */}
      <div className="current-roles">
        {editedUser.roles.map((role) => (
          <RoleChip
            key={role.role_id}
            role={role}
            onRemove={() => onRemoveRole(role.role_id)}
          />
        ))}
      </div>

      {/* Role selector */}
      <RoleSelector
        availableRoles={availableRoles}
        assignedRoles={editedUser.roles}
        onChange={onRoleChange}
      />

      {/* Show permissions granted by roles */}
      <div className="role-permissions">
        <span className="subtitle">Permissions from roles:</span>
        {editedUser.roles
          .flatMap((r) => r.permissions)
          .map((perm) => (
            <PermissionBadge key={perm} permission={perm} />
          ))}
      </div>
    </div>
  );
};
```

---

#### Task 6.2: Create RoleEditor UI Component

**File**: `packages/ui-base/src/lib/role-editor/role-editor.tsx` (NEW)

```typescript
import { useState } from 'react';
import { Role } from '@holistix-forge/types';

export interface RoleEditorProps {
  roles: Role[];
  permissions: string[]; // All available permissions from modules
  onCreateRole: (role: Omit<Role, 'role_id'>) => Promise<void>;
  onUpdateRole: (role_id: string, updates: Partial<Role>) => Promise<void>;
  onDeleteRole: (role_id: string) => Promise<void>;
}

export const RoleEditor = ({
  roles,
  permissions,
  onCreateRole,
  onUpdateRole,
  onDeleteRole,
}: RoleEditorProps) => {
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  return (
    <div className="role-editor">
      <div className="role-list">
        <h3>Roles</h3>
        {roles.map((role) => (
          <RoleListItem
            key={role.role_id}
            role={role}
            onClick={() => setSelectedRole(role)}
            onDelete={
              role.immutable ? undefined : () => onDeleteRole(role.role_id)
            }
          />
        ))}
        <button onClick={() => setIsCreating(true)}>Create Role</button>
      </div>

      <div className="role-details">
        {selectedRole && !isCreating && (
          <RoleDetailsEditor
            role={selectedRole}
            availablePermissions={permissions}
            onUpdate={(updates) => onUpdateRole(selectedRole.role_id, updates)}
          />
        )}

        {isCreating && (
          <CreateRoleForm
            availablePermissions={permissions}
            onCreate={async (role) => {
              await onCreateRole(role);
              setIsCreating(false);
            }}
            onCancel={() => setIsCreating(false)}
          />
        )}
      </div>
    </div>
  );
};

const RoleDetailsEditor = ({ role, availablePermissions, onUpdate }) => {
  const [selectedPerms, setSelectedPerms] = useState<string[]>(
    role.permissions
  );

  return (
    <div>
      <h3>{role.display_name}</h3>
      {role.system && <span className="badge">System Role</span>}
      {role.immutable && <span className="badge">Immutable</span>}

      <p>{role.description}</p>

      {!role.immutable && (
        <>
          <h4>Permissions:</h4>
          <PermissionMultiSelect
            available={availablePermissions}
            selected={selectedPerms}
            onChange={setSelectedPerms}
          />

          <button onClick={() => onUpdate({ permissions: selectedPerms })}>
            Save Changes
          </button>
        </>
      )}

      {role.immutable && (
        <div>
          <h4>Permissions (read-only):</h4>
          {role.permissions.map((p) => (
            <PermissionBadge key={p} permission={p} />
          ))}
        </div>
      )}
    </div>
  );
};
```

---

#### Task 6.3: Update Frontend Hooks for Roles

**File**: `packages/frontend-data/src/lib/queries.ts`

**Changes:**

```typescript
/**
 * Fetch all roles from gateway
 */
export const useQueryRoles = (organization_id: string | null) => {
  const ganymedeApi = useGanymedeApi();

  return useQuery({
    queryKey: ['roles', organization_id],
    queryFn: async () => {
      if (!organization_id) return [];
      const response = await ganymedeApi.fetchGateway('/roles', {
        method: 'GET',
      });
      return response.roles;
    },
    enabled: !!organization_id,
  });
};

/**
 * Create custom role
 */
export const useMutationCreateRole = (organization_id: string | null) => {
  const ganymedeApi = useGanymedeApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (role: Omit<Role, 'role_id'>) => {
      const response = await ganymedeApi.fetchGateway('/roles', {
        method: 'POST',
        body: JSON.stringify(role),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles', organization_id] });
    },
  });
};

/**
 * Assign role to user
 */
export const useMutationAssignRole = (organization_id: string | null) => {
  const ganymedeApi = useGanymedeApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      user_id,
      role_id,
      scope,
      project_id,
    }: {
      user_id: string;
      role_id: string;
      scope: 'org' | 'project';
      project_id?: string;
    }) => {
      const response = await ganymedeApi.fetchGateway(
        `/users/${user_id}/roles`,
        {
          method: 'POST',
          body: JSON.stringify({ role_id, scope, project_id }),
        }
      );
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['user-roles', variables.user_id],
      });
      queryClient.invalidateQueries({
        queryKey: ['collaborators', organization_id],
      });
    },
  });
};
```

---

### Phase 7: Documentation Updates

**Duration**: ~2 days
**Dependencies**: All phases

Files to update (see [Documentation Updates](#documentation-updates) section below).

---

### Phase 8: Testing

**Duration**: ~3 days
**Dependencies**: All phases

See [Testing Strategy](#testing-strategy) section below.

---

## Documentation Updates

### Files Requiring Updates

#### 1. Core Architecture Documentation

**`doc/architecture/PERMISSION_SYSTEM.md`** - ⚠️ **MAJOR UPDATE**

- Rewrite entire document to describe RBAC system
- Document role data model
- Document permission resolution strategy
- Document org vs project roles
- Document module permission integration
- Update API endpoint documentation
- Add examples of role creation and assignment

**`doc/architecture/GATEWAY_ARCHITECTURE.md`** - **UPDATE**

- Section "Permissions in Gateway Non-Shared State":
  - Add role management (RoleManager, UserRoleManager)
  - Update persistence format to include roles
- Section "Manager Responsibilities":
  - Add RoleManager responsibilities
  - Add UserRoleManager responsibilities
  - Update PermissionManager section (role resolution)

**`doc/architecture/ARCHITECTURAL_DECISIONS.md`** - **UPDATE**

- Add new section: "Role-Based Access Control (RBAC)"
- Document decision to resolve permissions at check time
- Document org vs project roles decision
- Document lazy project initialization decision

**`doc/architecture/SYSTEM_ARCHITECTURE.md`** - **MINOR UPDATE**

- Update diagram if roles significantly change architecture
- Mention RBAC in permission system overview

**`doc/architecture/FRONTEND_ARCHITECTURE.md`** - **UPDATE**

- Update section on authorization hooks
- Document new role-related hooks (useQueryRoles, etc.)
- Update UsersScopes component documentation

**`doc/architecture/FRONTEND_DATA_ARCHITECTURE.md`** - **UPDATE**

- Add role management hooks documentation
- Update collaborator data structure (now includes roles)

---

#### 2. Current Work Documentation

**`doc/current-works/MULTI_PROJECT_ARCHITECTURE.md`** - **UPDATE**

- Update permission initialization section
- Document lazy project initialization
- Update member management flow (gateway orchestrates)

---

#### 3. Guide Documentation

**`doc/guides/LOCAL_DEVELOPMENT.md`** - **UPDATE**

- Add GATEWAY_TOKEN environment variable setup
- Document role management in local development

**`doc/guides/PRODUCTION_DEPLOYMENT.md`** - **UPDATE**

- Add GATEWAY_TOKEN configuration requirement
- Document role migration strategy for existing deployments

**`doc/guides/TROUBLESHOOTING.md`** - **ADD**

- Add section: "Permission Denied After RBAC Migration"
- Add section: "User Cannot Access Project"
- Add section: "Gateway Token Authentication Failures"

---

#### 4. Package Documentation

**`packages/app-gateway/README.md`** - **UPDATE**

- Add RoleManager and UserRoleManager to architecture overview
- Document new API routes (/roles, /users/:id/roles)
- Update permission checking section (now via roles)

**`packages/app-ganymede/README.md`** - **UPDATE**

- Document deprecated project member routes
- Document internal API routes (gateway-only)
- Add GATEWAY_TOKEN configuration

**`packages/frontend-data/README.md`** - **UPDATE**

- Document new role management hooks
- Update collaborator hooks (now include roles)

**`packages/ui-base/README.md` (if exists)** - **UPDATE**

- Document RoleEditor component
- Update UsersScopes component docs (now shows roles)

---

#### 5. Module Documentation

**`packages/modules/gateway/README.md`** - **UPDATE**

- Document that modules can continue registering permissions as before
- Explain how registered permissions integrate with roles
- Mention wildcard matching in roles

**`packages/modules/README.md`** - **UPDATE**

- Add note about permission system and RBAC
- Mention that module permissions can be assigned to roles

---

#### 6. Reference Documentation

**`doc/reference/API.md`** - **UPDATE**

- Add gateway role API endpoints documentation
- Add user-role assignment endpoints
- Mark deprecated Ganymede routes
- Document internal API endpoints

---

### Documentation Checklist

- [ ] `doc/architecture/PERMISSION_SYSTEM.md` - Complete rewrite
- [ ] `doc/architecture/GATEWAY_ARCHITECTURE.md` - Add RBAC managers
- [ ] `doc/architecture/ARCHITECTURAL_DECISIONS.md` - Add RBAC decisions
- [ ] `doc/architecture/FRONTEND_ARCHITECTURE.md` - Update auth hooks
- [ ] `doc/current-works/MULTI_PROJECT_ARCHITECTURE.md` - Update permissions
- [ ] `doc/guides/LOCAL_DEVELOPMENT.md` - Add GATEWAY_TOKEN
- [ ] `doc/guides/PRODUCTION_DEPLOYMENT.md` - Add migration guide
- [ ] `doc/guides/TROUBLESHOOTING.md` - Add RBAC troubleshooting
- [ ] `packages/app-gateway/README.md` - Add role managers
- [ ] `packages/app-ganymede/README.md` - Document API changes
- [ ] `packages/frontend-data/README.md` - Add role hooks
- [ ] `packages/modules/gateway/README.md` - Explain RBAC integration
- [ ] `doc/reference/API.md` - Add new endpoints

---

## Testing Strategy

### Test Categories

#### 1. Unit Tests (Backend)

**RoleManager Tests** (`packages/app-gateway/src/permissions/RoleManager.spec.ts`)

- ✅ Create custom role
- ✅ Create role with invalid data (should fail)
- ✅ Update custom role
- ✅ Attempt to update system role (should fail)
- ✅ Delete custom role
- ✅ Attempt to delete system role (should fail)
- ✅ Attempt to delete role assigned to users (should fail)
- ✅ Get role by ID
- ✅ Get role by name
- ✅ List all roles
- ✅ List roles by scope (org vs project)
- ✅ Initialize default system roles
- ✅ Persistence: loadFromSerializable
- ✅ Persistence: saveToSerializable

**UserRoleManager Tests** (`packages/app-gateway/src/permissions/UserRoleManager.spec.ts`)

- ✅ Assign org role to user
- ✅ Assign project role to user
- ✅ Assign non-existent role (should fail)
- ✅ Remove org role from user
- ✅ Remove project role from user
- ✅ Remove all project roles for user
- ✅ Get user org roles
- ✅ Get user project roles
- ✅ Get all user roles (org + project)
- ✅ Get user permissions (expanded from roles)
- ✅ Get users with specific role
- ✅ Remove role from all users (bulk operation)
- ✅ Persistence: loadFromSerializable
- ✅ Persistence: saveToSerializable

**PermissionManager Tests (Updated)** (`packages/app-gateway/src/permissions/PermissionManager.spec.ts`)

- ✅ Check permission via direct assignment (backward compat)
- ✅ Check permission via org role
- ✅ Check permission via project role
- ✅ org:owner always has access
- ✅ Wildcard matching: `*` matches everything
- ✅ Wildcard matching: `project:[*]:admin` matches `project:abc:admin`
- ✅ Resource wildcard: `user-containers:[user-container:*]:create` matches `user-containers:[user-container:123]:create`
- ✅ Nested resource wildcards
- ✅ Permission denied when no role/permission
- ✅ Permission denied for wrong resource ID
- ✅ Multiple roles grant union of permissions

---

#### 2. Integration Tests (Backend)

**Gateway Initialization Tests** (`packages/app-gateway/src/initialization/gateway-init.spec.ts`)

- ✅ Gateway initializes with RoleManager and UserRoleManager
- ✅ Default system roles are created
- ✅ Managers are registered with GatewayState
- ✅ PermissionManager is wired to UserRoleManager

**Member Management Event Tests** (`packages/app-gateway/src/events/member-events.spec.ts`)

- ✅ member:add event adds user with roles
- ✅ member:add validates requester permission
- ✅ member:add validates user is org member
- ✅ member:add validates roles exist
- ✅ member:add calls Ganymede internal API
- ✅ member:remove event removes all project roles
- ✅ member:remove validates requester permission
- ✅ member:remove calls Ganymede internal API

**Project Initialization Tests** (`packages/app-gateway/src/state/ProjectRooms.spec.ts`)

- ✅ Lazy initialization on first access
- ✅ project:init event dispatched
- ✅ Permissions initialized after project:init
- ✅ Org members fetched fresh from Ganymede
- ✅ Project members fetched from Ganymede
- ✅ Org admins/owners don't get additional roles (already have access)
- ✅ Regular members get default role if available

**Gateway API Route Tests** (`packages/app-gateway/src/routes/roles.spec.ts`)

- ✅ GET /roles returns all roles
- ✅ GET /roles/:id returns specific role
- ✅ POST /roles creates custom role
- ✅ POST /roles validates required fields
- ✅ PATCH /roles/:id updates custom role
- ✅ PATCH /roles/:id fails for system roles
- ✅ DELETE /roles/:id deletes custom role
- ✅ DELETE /roles/:id fails for system roles
- ✅ DELETE /roles/:id removes role from all users

**User-Role Assignment Tests** (`packages/app-gateway/src/routes/user-roles.spec.ts`)

- ✅ GET /users/:id/roles returns user roles
- ✅ POST /users/:id/roles assigns org role
- ✅ POST /users/:id/roles assigns project role
- ✅ POST /users/:id/roles validates scope matches role
- ✅ DELETE /users/:id/roles/:role_id removes role

---

#### 3. Integration Tests (Ganymede)

**Internal API Tests** (`packages/app-ganymede/src/routes/internal/projects.spec.ts`)

- ✅ POST /internal/projects/:id/members requires gateway token
- ✅ POST /internal/projects/:id/members adds member to DB
- ✅ DELETE /internal/projects/:id/members/:user_id requires gateway token
- ✅ DELETE /internal/projects/:id/members/:user_id removes member from DB
- ✅ Internal routes reject requests without gateway token
- ✅ Internal routes reject requests with invalid token

**Deprecated Route Tests** (`packages/app-ganymede/src/routes/projects/index.spec.ts`)

- ✅ POST /projects/:id/members returns 410 Gone
- ✅ DELETE /projects/:id/members/:user_id returns 410 Gone
- ✅ Deprecated responses include migration instructions

**Database Tests** (`packages/app-ganymede/database/procedures/proc_projects_new.spec.ts`)

- ✅ proc_projects_new adds creator to projects_members
- ✅ Creator is added on conflict (idempotent)

---

#### 4. E2E Tests (Full Stack)

**Role Management Flow** (`e2e/role-management.spec.ts`)

1. ✅ Admin creates custom "Developer" role with permissions
2. ✅ Admin assigns role to user
3. ✅ User can perform actions granted by role
4. ✅ User cannot perform actions not granted by role
5. ✅ Admin updates role permissions
6. ✅ User's access changes immediately
7. ✅ Admin removes role from user
8. ✅ User loses access

**Project Creation & Access Flow** (`e2e/project-access.spec.ts`)

1. ✅ User creates new project
2. ✅ Creator is added to projects_members table
3. ✅ User opens project (lazy initialization)
4. ✅ project:init event dispatched
5. ✅ Permissions initialized
6. ✅ Creator has access to project
7. ✅ Other org admins have access (via org role)
8. ✅ Regular org members without roles don't have access

**Member Management Flow** (`e2e/member-management.spec.ts`)

1. ✅ Admin adds user to project with "Developer" role
2. ✅ User appears in project members list
3. ✅ User has access to project
4. ✅ User can perform actions granted by role
5. ✅ Admin removes user from project
6. ✅ User loses access to project

**Module Permission Integration** (`e2e/module-permissions.spec.ts`)

1. ✅ Module registers custom permission
2. ✅ Permission appears in GET /permissions
3. ✅ Admin creates role with module permission
4. ✅ Admin assigns role to user
5. ✅ User can perform module action
6. ✅ Module reducer checks permission (succeeds)
7. ✅ User without role cannot perform action (fails)

---

#### 5. Performance Tests

**Permission Check Performance** (`perf/permission-check.spec.ts`)

- ✅ Measure hasPermission() latency (p50, p95, p99)
- ✅ Target: < 5ms p99 with 1000 users, 100 roles
- ✅ Wildcard matching performance
- ✅ Nested resource path matching

**Project Initialization Performance** (`perf/project-init.spec.ts`)

- ✅ Lazy init is faster than eager init
- ✅ Target: < 500ms to initialize project
- ✅ Gateway startup time with 1000 projects
- ✅ Target: < 10s gateway startup (vs 5+ minutes eager)

**Role Resolution Performance** (`perf/role-resolution.spec.ts`)

- ✅ getUserPermissions() latency
- ✅ Expanding 10 roles with 50 permissions each
- ✅ Target: < 10ms

---

### Test Coverage Targets

| Component                   | Target Coverage | Priority |
| --------------------------- | --------------- | -------- |
| RoleManager                 | 95%+            | High     |
| UserRoleManager             | 95%+            | High     |
| PermissionManager (updated) | 95%+            | High     |
| Wildcard matching           | 100%            | Critical |
| Member event handlers       | 90%+            | High     |
| Gateway role API routes     | 85%+            | Medium   |
| Internal Ganymede routes    | 90%+            | High     |
| Frontend role hooks         | 80%+            | Medium   |
| UI components               | 70%+            | Low      |

---

### Test Data Setup

**Fixtures needed:**

- Sample users (org owner, org admin, regular members)
- Sample organization with members
- Sample projects with members
- Sample roles (system + custom)
- Sample user-role assignments
- Sample module-registered permissions

**Database seeding for tests:**

```sql
-- Test users
INSERT INTO users (user_id, username, email) VALUES
  ('user-owner', 'owner', 'owner@test.com'),
  ('user-admin', 'admin', 'admin@test.com'),
  ('user-member', 'member', 'member@test.com');

-- Test organization
INSERT INTO organizations (organization_id, name) VALUES
  ('org-test', 'Test Org');

-- Org members
INSERT INTO organizations_members (organization_id, user_id, role) VALUES
  ('org-test', 'user-owner', 'owner'),
  ('org-test', 'user-admin', 'admin'),
  ('org-test', 'user-member', 'member');

-- Test projects
INSERT INTO projects (project_id, organization_id, name) VALUES
  ('project-1', 'org-test', 'Project One');

-- Project members
INSERT INTO projects_members (project_id, user_id) VALUES
  ('project-1', 'user-owner');
```

---

## Migration Strategy

### For Existing Deployments

#### Phase 1: Deploy RBAC System (Non-Breaking)

1. **Deploy gateway with RBAC code**

   - RoleManager, UserRoleManager coexist with existing PermissionManager
   - Backward compatibility: direct permissions still work
   - No user action required

2. **Initialize default system roles**

   - `org:owner` and `org:admin` roles created automatically
   - Existing permissions continue working

3. **Deploy Ganymede API changes**
   - Internal routes active
   - Public routes deprecated but still functional (return 410)
   - Frontend still works with old API temporarily

#### Phase 2: Migrate Existing Permissions to Roles

1. **Create migration script** (`scripts/migrate-permissions-to-roles.ts`)

   ```typescript
   // For each organization:
   // 1. Fetch org members with database roles
   // 2. Assign gateway roles based on database roles:
   //    - owner → org:owner role
   //    - admin → org:admin role
   //    - member → keep existing permissions OR assign custom role
   // 3. For project-specific permissions:
   //    - Group by permission patterns
   //    - Create custom roles if needed
   //    - Assign roles to users
   ```

2. **Run migration** (requires gateway restart)

   ```bash
   npm run migrate:permissions-to-roles
   ```

3. **Verify** migration
   - Check all users can still access their projects
   - Verify permission checks pass
   - Monitor logs for permission denied errors

#### Phase 3: Update Frontend

1. **Deploy updated frontend**

   - New role-based UI
   - Uses new gateway API routes
   - Falls back gracefully if gateway not updated

2. **Train administrators**
   - How to create custom roles
   - How to assign roles to users
   - How to migrate from old permission system

#### Phase 4: Cleanup (Breaking Changes)

1. **Remove deprecated Ganymede routes** (v2.0)

   - DELETE POST /projects/:id/members
   - DELETE DELETE /projects/:id/members/:user_id
   - Only internal routes remain

2. **Remove direct permission support** (optional, v3.0)
   - Force all permissions to go through roles
   - Clean up PermissionManager legacy code

---

### Rollback Plan

If RBAC causes issues:

1. **Gateway rollback**:

   - Direct permissions still work (backward compat)
   - Can revert to previous gateway version
   - Loses role assignments, but permissions remain

2. **Ganymede rollback**:

   - Public routes still exist (deprecated but functional)
   - Can revert to previous Ganymede version

3. **Data rollback**:
   - GatewayState snapshots include roles
   - Can restore from backup if needed

---

## Timeline and Milestones

### Phase-by-Phase Timeline

| Phase                             | Duration    | Start  | End    | Dependencies |
| --------------------------------- | ----------- | ------ | ------ | ------------ |
| Phase 1: Core RBAC Infrastructure | 3 days      | Day 1  | Day 3  | None         |
| Phase 2: Gateway Events & Members | 2 days      | Day 4  | Day 5  | Phase 1      |
| Phase 3: Ganymede API Changes     | 1 day       | Day 6  | Day 6  | Phase 2      |
| Phase 4: Lazy Initialization      | 1 day       | Day 7  | Day 7  | Phase 2, 3   |
| Phase 5: Gateway Role API         | 2 days      | Day 8  | Day 9  | Phase 1      |
| Phase 6: Frontend UI              | 3 days      | Day 10 | Day 12 | Phase 5      |
| Phase 7: Documentation            | 2 days      | Day 13 | Day 14 | All          |
| Phase 8: Testing                  | 3 days      | Day 15 | Day 17 | All          |
| **Total**                         | **17 days** |        |        |              |

### Milestones

#### Milestone 1: Backend Complete (Day 9)

- ✅ RoleManager and UserRoleManager implemented
- ✅ Permission resolution via roles working
- ✅ Wildcard matching implemented
- ✅ Gateway events for member management
- ✅ Lazy project initialization
- ✅ Ganymede internal API
- ✅ Gateway role API routes
- **Deliverable**: Backend fully functional with RBAC

#### Milestone 2: Frontend Complete (Day 12)

- ✅ Role-based UI components
- ✅ RoleEditor component
- ✅ Updated UsersScopes
- ✅ Frontend hooks for roles
- **Deliverable**: Full end-to-end RBAC system working

#### Milestone 3: Documentation & Testing Complete (Day 17)

- ✅ All documentation updated
- ✅ Unit tests passing (95%+ coverage)
- ✅ Integration tests passing
- ✅ E2E tests passing
- ✅ Performance tests meet targets
- **Deliverable**: Production-ready RBAC system

---

## Success Criteria

### Functional Success Criteria

1. ✅ **Role Management**

   - Administrators can create custom roles
   - Roles can contain module-registered permissions
   - System roles are immutable
   - Role deletion removes from all users

2. ✅ **Permission Resolution**

   - Users assigned roles get correct permissions
   - Wildcard permissions match correctly
   - org:owner has universal access
   - Permission checks are backward compatible

3. ✅ **Member Management**

   - All member operations go through gateway
   - Gateway state stays in sync with database
   - Fresh organization members fetched when needed

4. ✅ **Project Initialization**

   - Projects initialize lazily (on first access)
   - Permissions initialized correctly
   - Faster gateway startup

5. ✅ **UI**
   - Role editor works
   - Users can be assigned roles
   - Permissions visible in UI

### Technical Success Criteria

1. ✅ **Performance**

   - Permission checks < 5ms (p99)
   - Project initialization < 500ms
   - Gateway startup < 10s (with 1000 projects)

2. ✅ **Reliability**

   - No permission denied errors for valid users
   - No stale data issues
   - Gateway state persistence works

3. ✅ **Code Quality**

   - 90%+ test coverage for core RBAC code
   - All linter rules pass
   - No TypeScript errors

4. ✅ **Documentation**
   - All architecture docs updated
   - Migration guide complete
   - API documentation accurate

---

## Risks and Mitigation

### Risk 1: Permission Lockout

**Risk**: Admin accidentally removes all roles from org owner, causing lockout.

**Mitigation**:

- org:owner role is immutable (cannot be deleted)
- At least one user must always have org:owner role
- Warning in UI when removing roles from last admin

### Risk 2: Performance Degradation

**Risk**: Role resolution is slower than direct permission checks.

**Mitigation**:

- Implement caching for resolved permissions
- Benchmark before and after
- Target < 5ms permission checks

### Risk 3: Gateway-Ganymede Sync Issues

**Risk**: Gateway state out of sync with database members.

**Mitigation**:

- Fetch fresh org members when needed (not cached)
- Gateway orchestrates all member operations
- Internal API protected by gateway token

### Risk 4: Migration Complexity

**Risk**: Migrating existing permissions to roles is complex.

**Mitigation**:

- Migration script thoroughly tested
- Dry-run mode to preview changes
- Rollback plan in place
- Backward compatibility during transition

### Risk 5: Module Compatibility

**Risk**: Existing modules break with new permission system.

**Mitigation**:

- Zero module code changes required
- Backward compatible hasPermission()
- Test with all existing modules

---

## Appendix

### Glossary

- **RBAC**: Role-Based Access Control
- **Org Role**: Role applied to all projects in organization
- **Project Role**: Role applied to specific projects
- **System Role**: Immutable built-in role (org:owner, org:admin)
- **Custom Role**: User-defined role
- **Direct Permission**: Legacy permission assigned directly to user (pre-RBAC)
- **Wildcard Permission**: Permission with `*` or `[*]` matching any resource
- **Lazy Initialization**: Initializing resources on first access (not eagerly)

### References

- [PERMISSION_SYSTEM.md](../architecture/PERMISSION_SYSTEM.md) - Current permission system
- [GATEWAY_ARCHITECTURE.md](../architecture/GATEWAY_ARCHITECTURE.md) - Gateway architecture
- [ARCHITECTURAL_DECISIONS.md](../architecture/ARCHITECTURAL_DECISIONS.md) - Key decisions
- [MULTI_PROJECT_ARCHITECTURE.md](./MULTI_PROJECT_ARCHITECTURE.md) - Multi-project setup

---

**Document End** - Ready for implementation. Branch: `feat/rbac-permissions`
