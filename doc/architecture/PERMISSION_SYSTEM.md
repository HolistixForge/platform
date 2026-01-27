# Permission System Architecture

**Status:** ✅ **IMPLEMENTED** (2026-01-22)  
**Branch:** `feat/rbac-permissions`  
**Tests:** 231 passing ✅  
**Lints:** All passing ✅

## Overview

The permission system implements **Role-Based Access Control (RBAC)** where users are assigned roles, and roles contain collections of permissions. This enables gateway modules to describe their authorization requirements and provides scalable permission management for organizations.

**Key Features:**

- **Users → Roles → Permissions** (classic RBAC)
- **Module-registered permissions** (dynamic, extensible)
- **Wildcard permission matching** (e.g., `project:*:admin`)
- **Org and project-level roles** (broad vs. limited access)
- **System roles** (immutable: org:owner, org:admin)
- **Custom roles** (user-defined)

---

## RBAC Architecture

### Data Model

```
Users
  ↓ (assigned)
Roles (org-level or project-level)
  ↓ (contain)
Permissions (module-registered, string-based)
```

### Components

1. **RoleManager** - Manages role definitions (CRUD, system roles)
2. **UserRoleManager** - Manages user-role assignments (org + project)
3. **PermissionManager** - Checks permissions via role resolution
4. **PermissionRegistry** - Modules register permissions here

---

## Permission Format

- **Pattern:** `{module}:{resource}:{action}` or `{module}:{resource-path}:{action}`
- **Module Name:** Lowercase alphanumeric with hyphens (`[a-z0-9-]+`)
- **Resource:** Can be specific ID or wildcard (`*`)
- **Action:** Lowercase alphanumeric with hyphens

**Examples:**

- `org:my-org:admin` - Admin access to specific org
- `project:abc-123:write` - Write access to specific project
- `container:xyz:delete` - Delete specific container
- `gateway:roles:write` - Write access to role management

**Wildcards:**

- `*` - Universal wildcard (matches everything)
- `project:*:admin` - Admin access to ALL projects
- `container:*:create` - Create ANY container

**Characteristics:**

- Modules register permissions with descriptive metadata
- Roles contain permission strings (exact or wildcarded)
- Permission checks resolve via roles at runtime

---

## Roles

### System Roles (Immutable)

**`org:owner`**

- **Permissions:** `["*"]` (universal wildcard)
- **Scope:** Organization-level (applies to all projects)
- **Grants:** Everything (all permissions, all modules)
- **Immutable:** Cannot be edited or deleted
- **Purpose:** Organization owner, full control

**`org:admin`**

- **Permissions:**
  ```
  org:*:admin
  project:*:create
  project:*:admin
  project:*:delete
  gateway:roles:read
  gateway:roles:write
  gateway:permissions:read
  gateway:permissions:write
  container:create
  container:delete
  container:host
  ```
- **Scope:** Organization-level (applies to all projects)
- **Grants:** Manage projects, members, permissions, roles
- **Immutable:** Cannot be deleted (can only be assigned/unassigned)
- **Purpose:** Organization administrator

### Custom Roles

Administrators can create custom roles with specific permission sets.

**Example:**

```json
{
  "role_name": "developer",
  "display_name": "Developer",
  "description": "Can create and manage containers",
  "permissions": [
    "project:*:read",
    "project:*:write",
    "container:*:create",
    "container:*:delete"
  ],
  "scope": "project",
  "immutable": false,
  "system": false
}
```

### Role Scope

**Org-level roles** (`scope: "org"`):

- Apply to ALL projects in the organization
- Example: org:owner, org:admin
- Use case: Core team members

**Project-level roles** (`scope: "project"`):

- Apply to specific projects only
- Example: Custom "developer", "viewer" roles
- Use case: External contractors, guest collaborators

---

## Permission Resolution

### Resolution Strategy

Permissions are resolved **at CHECK time** (not edit time).

**Flow:**

1. Get user's roles (org-level + project-specific if applicable)
2. Expand roles to get all permissions
3. Check if any permission matches (with wildcard support)
4. Special case: `org:owner` always grants access

**Benefits:**

- ✅ Dynamic: New module permissions automatically granted to roles with wildcards
- ✅ Consistent: Role changes immediately affect all users
- ✅ Auditable: Clear "user X accessed via role Y" in logs
- ✅ Flexible: Supports wildcards and patterns

### Wildcard Matching

**Examples:**

```typescript
// Role has: "project:*:admin"
hasPermission(user, "project:abc:admin") → TRUE ✅
hasPermission(user, "project:xyz:admin") → TRUE ✅
hasPermission(user, "project:abc:write") → FALSE ❌

// Role has: "container:*:create"
hasPermission(user, "container:123:create") → TRUE ✅
hasPermission(user, "container:456:create") → TRUE ✅
hasPermission(user, "container:123:delete") → FALSE ❌

// Role has: "*"
hasPermission(user, "anything:you:want") → TRUE ✅
```

**Rules:**

- Permission parts are split by `:` (colon)
- Each part must match exactly OR be a wildcard `*`
- Number of parts must be the same
- Wildcard `*` matches any value in that position
- Universal wildcard `*` (single character) matches everything

---

## Module Permission Integration

### How Modules Register Permissions

Modules register permissions during `load()` using `PermissionRegistry`:

```typescript
// In module's index.ts
export const moduleBackend: TModule = {
  name: 'user-containers',
  dependencies: ['gateway'],
  load: ({ depsExports }) => {
    const permissionRegistry = depsExports.gateway.permissionRegistry;

    permissionRegistry.register('container:*:create', {
      resourcePath: 'container:*',
      action: 'create',
      description: 'Create user containers',
    });

    permissionRegistry.register('container:*:delete', {
      resourcePath: 'container:*',
      action: 'delete',
      description: 'Delete user containers',
    });
  },
};
```

### How Modules Check Permissions

Modules check permissions in reducers using `PermissionManager`:

```typescript
// In module's reducer
if (!permissionManager.hasPermission(user_id, 'container:create')) {
  throw new ForbiddenException([
    { message: 'Permission denied: container:create' },
  ]);
}
```

### Integration with RBAC

1. **Modules register permissions** → Available in `PermissionRegistry`
2. **Admins create roles** → Include module-registered permissions
3. **Admins assign roles to users** → Users get module permissions
4. **Module checks permission** → Resolves via roles transparently

**No module code changes needed!** Modules continue working exactly as before.

---

## Gateway API Endpoints

### Role Management

**GET /roles**

- **Purpose:** List all roles (system + custom)
- **Auth:** `gateway:roles:read`
- **Response:** `{ roles: Role[] }`

**GET /roles/:role_id**

- **Purpose:** Get role by ID
- **Auth:** `gateway:roles:read`
- **Response:** `Role`

**POST /roles**

- **Purpose:** Create custom role
- **Auth:** `gateway:roles:write`
- **Body:** `{ role_name, display_name, description, permissions, scope }`
- **Response:** `Role` (201 Created)

**PATCH /roles/:role_id**

- **Purpose:** Update custom role (system roles immutable)
- **Auth:** `gateway:roles:write`
- **Body:** `{ display_name?, description?, permissions? }`
- **Response:** `Role`

**DELETE /roles/:role_id**

- **Purpose:** Delete custom role (system roles immutable)
- **Auth:** `gateway:roles:write`
- **Response:** `{ success: true }`
- **Side Effect:** Removes role from all users

### User-Role Assignment

**GET /users/:user_id/roles**

- **Purpose:** Get user's roles
- **Auth:** `gateway:roles:read`
- **Query:** `?project_id=<uuid>` (optional)
- **Response:** `{ org_roles: Role[], project_roles: { [project_id]: Role[] } }`

**POST /users/:user_id/roles**

- **Purpose:** Assign role to user
- **Auth:** `gateway:roles:write`
- **Body:** `{ role_id, scope: 'org' | 'project', project_id? }`
- **Response:** `{ success: true }`

**DELETE /users/:user_id/roles/:role_id**

- **Purpose:** Remove role from user
- **Auth:** `gateway:roles:write`
- **Query:** `?project_id=<uuid>` (required for project-scoped roles)
- **Response:** `{ success: true }`

### Member Management

**POST /members/projects/:project_id/users**

- **Purpose:** Add member to project with roles
- **Auth:** `project:*:admin`
- **Body:** `{ user_id, role_ids: string[] }`
- **Response:** `{ success: true }`
- **Validates:** User is org member, roles are project-scoped
- **Side Effect:** Updates gateway state and Ganymede database

**DELETE /members/projects/:project_id/users/:user_id**

- **Purpose:** Remove member from project
- **Auth:** `project:*:admin`
- **Response:** `{ success: true }`
- **Side Effect:** Removes all project roles, updates database

### Permission Registry

**GET /permissions**

- **Purpose:** List all module-registered permissions
- **Auth:** `gateway:permissions:read`
- **Response:** `{ permissions: PermissionDefinition[] }`
- **Use Case:** Populate role editor with available permissions

---

## Database Integration

### Organization Members (Ganymede DB)

```sql
CREATE TABLE organizations_members (
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role varchar(20) NOT NULL,  -- 'owner' | 'admin' | 'member'
    PRIMARY KEY (organization_id, user_id)
);
```

**Purpose:** Track organization membership with simple database roles.

**Database roles:**

- `owner` - Organization owner
- `admin` - Organization administrator
- `member` - Regular member

**Note:** These are simple database roles for basic access control in Ganymede API. Fine-grained permissions are managed in gateway via RBAC.

### Project Members (Ganymede DB)

```sql
CREATE TABLE projects_members (
    project_id uuid NOT NULL,
    user_id uuid NOT NULL,
    added_at timestamp,
    PRIMARY KEY (project_id, user_id)
);
```

**Purpose:** Track project membership for project listing when gateway is offline.

**NOT for fine-grained permissions:** This table only determines which users can see a project in their project list. Actual permissions are managed in gateway via roles.

### Gateway State (JSON Persistence)

```json
{
  "roles": {
    "role-uuid-1": {
      "role_id": "role-uuid-1",
      "role_name": "org:owner",
      "display_name": "Organization Owner",
      "permissions": ["*"],
      "immutable": true,
      "system": true,
      "scope": "org"
    }
  },
  "user_roles": {
    "user-123": {
      "org_roles": ["role-uuid-1"],
      "project_roles": {
        "project-abc": ["role-uuid-2"]
      }
    }
  }
}
```

**Persistence:** Stored in gateway state, synced to Ganymede every 5 minutes.

---

## Member Management Flow

### Add Project Member

```
1. Admin → POST /members/projects/:id/users { user_id, role_ids }
   ↓
2. Gateway validates:
   - Requester has project:*:admin permission
   - User is organization member (fetch fresh from Ganymede)
   - Roles exist and are project-scoped
   ↓
3. Gateway assigns roles in UserRoleManager
   ↓
4. Gateway calls Ganymede: POST /internal/projects/:id/members
   ↓
5. Ganymede updates projects_members table
   ↓
6. Success! User now has access to project
```

### Remove Project Member

```
1. Admin → DELETE /members/projects/:id/users/:user_id
   ↓
2. Gateway validates:
   - Requester has project:*:admin permission
   ↓
3. Gateway removes ALL project roles for user
   ↓
4. Gateway calls Ganymede: DELETE /internal/projects/:id/members/:user_id
   ↓
5. Ganymede removes from projects_members table
   ↓
6. Success! User loses access to project
```

**Key:** Gateway is the source of truth. All member operations go through gateway to maintain consistency.

---

## Project Initialization & Permissions

### Lazy Initialization

Projects initialize **on first access** (not eagerly at gateway startup).

**Flow:**

```
1. User opens project page
   ↓
2. Frontend → GET /collab/room-id?project_id=X
   ↓
3. Gateway checks: Is project initialized?
   ↓ NO
4. Gateway initializes NOW:
   - Create YJS document
   - Dispatch project:init event
   - Fetch project members from Ganymede
   - Check member roles
   - Log warnings for members without roles
   ↓
5. Return room_id
```

**Benefits:**

- Fast gateway startup (< 10s vs minutes)
- Only active projects consume resources
- New projects discovered organically

### Permission Initialization

When a project initializes:

1. **Fetch project members** from Ganymede database
2. **Check each member's roles:**
   - Org owners/admins: Already have access via org roles ✅
   - Project members: Check if they have project-specific roles
   - No roles: Log warning (user has no access) ⚠️

**Note:** Users must be explicitly assigned roles to access projects. Being in `projects_members` table is NOT sufficient for access.

---

## Frontend Integration

### Hooks (from `frontend-data`)

**Role Management:**

- `useQueryRoles(organization_id)` - Fetch all roles
- `useMutationCreateRole(organization_id)` - Create custom role
- `useMutationUpdateRole(organization_id)` - Update role
- `useMutationDeleteRole(organization_id)` - Delete role

**User-Role Assignment:**

- `useQueryUserRoles(user_id, project_id?)` - Get user's roles
- `useMutationAssignRole(organization_id)` - Assign role to user
- `useMutationRemoveRole(organization_id)` - Remove role from user

**Member Management:**

- `useMutationAddMember(organization_id)` - Add member to project with roles
- `useMutationRemoveMember(organization_id)` - Remove member from project

**Permissions:**

- `useQueryPermissions(organization_id)` - List all registered permissions
- `useCollaborators(organization_id, project_id)` - Get project members with roles

### UI Components

**PermissionsPage** (`packages/ui-base/src/lib/permissions-page`) ✅ Implemented

- Organization-level permissions management at `/org/:org_id/permissions`
- **Roles Tab**: List all roles (system + custom), create/edit/delete custom roles, view role permissions
- **Users Tab**: Display organization members, show user roles, assign/remove roles from users
- **UserRoleEditor**: Modal for editing user role assignments with role preview

**RoleEditor** (`packages/ui-base/src/lib/role-editor`) ✅ Implemented

- Create/edit custom roles
- Select permissions from all registered permissions (fetched from gateway)
- Set role display name, description, and scope (org or project)
- Validate role names and prevent conflicts with system roles

---

## Permission Checking

### In Module Reducers

```typescript
import { PermissionManager } from '@holistix-forge/gateway';

// In reducer
const permissionManager = this.depsExports.gateway.permissionManager;

if (!permissionManager.hasPermission(user_id, 'container:create')) {
  throw new ForbiddenException([
    { message: 'Permission denied: container:create' },
  ]);
}
```

### In Protected Services

```typescript
protectedServiceRegistry.registerService({
  id: 'user-containers:terminal',
  checkPermission: async (ctx, { permissionManager }) => {
    const permission = `container:${containerId}:terminal`;
    return permissionManager.hasPermission(ctx.userId, permission);
  },
  resolve: async (ctx) => {
    // Return service metadata
  },
});
```

### In Gateway Routes

```typescript
import { requirePermission } from '../middleware/permissions';

router.get(
  '/protected-route',
  authenticateJwt,
  requirePermission('gateway:feature:access'),
  asyncHandler(async (req, res) => {
    // Route handler
  })
);
```

---

## Implementation Details

### RoleManager (`packages/app-gateway/src/permissions/RoleManager.ts`)

**Responsibilities:**

- Store role definitions
- CRUD operations for roles
- Validation (immutable roles, unique names)
- Persistence via `IPersistenceProvider`
- Initialize default system roles

**Key Methods:**

- `createRole(roleData)` - Create custom role
- `getRole(role_id)` - Get role by ID
- `getRoleByName(role_name)` - Get role by name
- `updateRole(role_id, updates)` - Update custom role
- `deleteRole(role_id)` - Delete custom role
- `getAllRoles()` - List all roles

### UserRoleManager (`packages/app-gateway/src/permissions/UserRoleManager.ts`)

**Responsibilities:**

- Store user-role assignments
- Support org-level and project-level assignments
- Expand roles to permissions
- Persistence via `IPersistenceProvider`

**Key Methods:**

- `assignOrgRole(user_id, role_id)` - Assign org role
- `assignProjectRole(user_id, project_id, role_id)` - Assign project role
- `removeOrgRole(user_id, role_id)` - Remove org role
- `removeProjectRole(user_id, project_id, role_id)` - Remove project role
- `getUserOrgRoles(user_id)` - Get user's org roles
- `getUserProjectRoles(user_id, project_id)` - Get user's project roles
- `getAllUserRoles(user_id, project_id?)` - Get all roles (org + project)
- `getUserPermissions(user_id, project_id?)` - Expand to permissions

### PermissionManager (`packages/app-gateway/src/permissions/PermissionManager.ts`)

**Responsibilities:**

- Check if user has permission
- Resolve permissions via roles
- Support wildcard matching

**Key Methods:**

- `hasPermission(user_id, permission, project_id?)` - Main permission check
- `getPermissions(user_id, project_id?)` - Get expanded permissions

**Algorithm:**

```typescript
hasPermission(user_id, permission, project_id?) {
  1. Get user's roles (org + project)
  2. If org:owner → return true (universal access)
  3. Get all permissions from all roles
  4. Check if any permission matches (with wildcards)
  5. Return result
}
```

### PermissionRegistry (`packages/modules/gateway/src/lib/permission-registry.ts`)

**Responsibilities:**

- Store module-registered permission definitions
- Validate permission format
- Expose via API for UI

**Key Methods:**

- `register(permission, definition)` - Module registers permission
- `getAll()` - Get all registered permissions
- `getByModule(module)` - Get permissions for specific module
- `get(permission)` - Get permission definition

---

## Security Considerations

### System Role Protection

**org:owner role:**

- Cannot be edited or deleted
- Always grants universal access (`*` permission)
- At least one user should always have this role
- Prevents permission lockout

**org:admin role:**

- Cannot be deleted (only assigned/unassigned)
- Has predefined permissions
- Cannot be modified

### Gateway Token Protection

Internal API routes are protected by `GATEWAY_TOKEN`:

```typescript
// In gateway
headers: {
  'X-Gateway-Token': process.env.GATEWAY_TOKEN
}

// In Ganymede middleware
if (providedToken !== process.env.GATEWAY_TOKEN) {
  return 403 Forbidden
}
```

**Purpose:** Prevents frontend from directly modifying `projects_members` table, ensuring gateway state stays in sync.

### Permission Check Failures

When permission check fails:

- Reducer throws `ForbiddenException`
- HTTP middleware returns `403 Forbidden`
- Logged for audit trail
- User sees "Permission denied" error

---

## Best Practices

### For Module Authors

1. **Register permissions during load** to ensure they appear in UI
2. **Provide descriptive metadata** to help administrators understand capabilities
3. **Check permissions in reducers** before sensitive operations
4. **Use meaningful permission names** (e.g., `container:create`, not `perm1`)
5. **No code changes needed** - existing permission checks work with RBAC

### For Administrators

1. **Assign roles, not individual permissions** to users
2. **Use org roles** for core team members (broad access)
3. **Use project roles** for external collaborators (limited access)
4. **Create custom roles** for common permission sets
5. **Review role permissions** regularly
6. **Monitor warnings** in logs for members without roles

### For Frontend Developers

1. **Use provided hooks** instead of manual API calls
2. **Display roles** to users (not raw permissions)
3. **Show permission preview** when selecting roles
4. **Handle loading states** when fetching roles/permissions
5. **Validate role assignments** before submitting

---

## Migration from Direct Permissions

The system previously supported direct user-to-permission assignments. This has been **completely removed** in favor of pure RBAC.

**Old System (Removed):**

```typescript
// Direct assignment
permissionManager.addPermission(user_id, 'project:abc:admin');

// Check
hasPermission(user_id, 'project:abc:admin'); // true
```

**New System (RBAC):**

```typescript
// Create role
roleId = roleManager.createRole({
  role_name: 'project-admin',
  permissions: ['project:*:admin'],
  scope: 'project',
});

// Assign role
userRoleManager.assignProjectRole(user_id, project_id, roleId);

// Check (automatic via role resolution)
hasPermission(user_id, 'project:abc:admin'); // true
```

**No backward compatibility:** Old permission data is ignored.

---

## Troubleshooting

### User Cannot Access Project

**Symptoms:**

- User is in `projects_members` table
- WebSocket shows `[WARNING] [WS_AUTH] No access to project`
- Frontend shows permission denied error

**Diagnosis:**

1. Check if user has any roles:

   ```bash
   GET /users/:user_id/roles?project_id=<project_id>
   ```

2. Check what permissions user has:

   ```typescript
   instances.permissionManager.getPermissions(user_id, project_id);
   ```

3. Check gateway logs for permission initialization warnings

**Solutions:**

- **No roles assigned:** Assign appropriate role via member management API
- **Org member but not project member:** Add to project via `POST /members/projects/:id/users`
- **Has roles but wrong scope:** Ensure roles are project-scoped for project access

### Permission Check Always Fails

**Symptoms:**

- User has role assigned
- Role has permission
- `hasPermission()` returns false

**Diagnosis:**

1. Check role scope matches usage (org role for org permissions, project role for project permissions)
2. Verify wildcard matching is correct
3. Check permission string format (no brackets in actual checks)
4. Verify UserRoleManager is wired to PermissionManager

**Debug:**

```typescript
const roles = userRoleManager.getAllUserRoles(user_id, project_id);
const permissions = roles.flatMap((r) => r.permissions);
console.log(
  'User roles:',
  roles.map((r) => r.role_name)
);
console.log('User permissions:', permissions);
```

### Gateway Token Authentication Fails

**Symptoms:**

- Internal API returns `401 Unauthorized` or `403 Forbidden`
- Logs show "Gateway token missing" or "Invalid gateway token"

**Solutions:**

- **Check GATEWAY_TOKEN is set** in both gateway and Ganymede
- **Verify token matches** between services
- **Check header name** is `X-Gateway-Token`

---

## Related Documents

- [Gateway Architecture](./GATEWAY_ARCHITECTURE.md) - Overall gateway design
- [Frontend Architecture](./FRONTEND_ARCHITECTURE.md) - Frontend integration
- [RBAC Implementation Plan](../current-works/PERMISSIONS_RBAC.md) - Detailed implementation plan
- [Protected Services](./PROTECTED_SERVICES.md) - Protected service registry

---

**Last Updated:** 2026-01-22  
**Status:** Implemented (Phases 1-5 complete, frontend UI pending)
