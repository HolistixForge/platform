# Organization Permissions Management UI - Implementation Plan

**Status:** Planning  
**Date:** 2026-01-22  
**Related:** RBAC Implementation (feat/rbac-permissions branch)

---

## Executive Summary

Create a new organization-level permissions management page to replace the project-level `UsersScopes` component with a comprehensive RBAC interface.

**Key Changes:**
- ❌ **Remove:** Project-level authorizations page (uses old direct permissions)
- ✅ **Create:** Organization-level `/org/:org_id/permissions` page
- ✅ **Components:** Three-panel interface (Users, Roles, Members)
- ✅ **Architecture:** Full RBAC with role management and assignment

---

## Current State Analysis

### What Exists (To Be Removed/Replaced)

#### **1. UsersScopes Component** (`packages/ui-base/src/lib/users-scopes/`)
**Location:** `packages/ui-base/src/lib/users-scopes/users-scopes.tsx`

**Current Features:**
- ✅ Three-panel layout (collaborators, search, edit scopes)
- ✅ User search with real-time filtering
- ✅ Checkbox-based scope assignment
- ✅ Owner protection (can't edit owner)
- ✅ Loading states
- ✅ Radix UI components (ScrollArea, Checkbox)

**What Can Be Reused:**
- ✅ **Three-panel layout pattern** - Clean UI structure
- ✅ **User search logic** - Real-time filtering works well
- ✅ **UserListItem component** - User display with actions
- ✅ **ScrollArea wrapper** - Radix UI scroll areas
- ✅ **Loading states** - Button loading indicators
- ✅ **SCSS styling patterns** - Variable-based responsive design

**What CANNOT Be Reused:**
- ❌ **Scope checkboxes** - Incompatible with RBAC (permissions via roles, not direct)
- ❌ **onValidateUser logic** - Uses old API (`useMutationUserScope`)
- ❌ **Scope prop interface** - Direct permission assignment

#### **2. Project Authorizations Page** (`packages/app-frontend/src/app/pages/project/authorizations.tsx`)
**Location:** `packages/app-frontend/src/app/forms/authorizations.tsx`

**Current Features:**
- Uses `UsersScopes` component
- Project-scoped (wrong level for org-wide RBAC)
- Fetches "scope" data (old permission system)

**What Can Be Reused:**
- ✅ **Page wrapper pattern** - Height: 800px, padding: 25px
- ✅ **Hook structure** - `usePermissionsEditorProps` pattern

**What CANNOT Be Reused:**
- ❌ **Project-level context** - RBAC is org-level
- ❌ **useQueryScope** - Old permission API
- ❌ **useMutationUserPermissions** - Direct permission mutation

---

## Goals and Requirements

### Functional Requirements

1. **Organization-Level Page**
   - Route: `/org/:org_id/permissions` or `/org/:org_id/settings/permissions`
   - Accessible only to `org:owner` and `org:admin`
   - Manages entire organization's RBAC system

2. **Three-Tab Interface**
   - **Tab 1: Roles** - Manage role definitions (uses RoleEditor component)
   - **Tab 2: Users** - Assign roles to organization members
   - **Tab 3: Projects** - View/manage project member roles (optional)

3. **Role Management (Tab 1)**
   - List all roles (system + custom)
   - Create new custom roles
   - Edit custom role permissions
   - Delete custom roles (with user removal)
   - Visual distinction for system roles (org:owner, org:admin)

4. **User Role Assignment (Tab 2)**
   - List all organization members
   - Search/filter users
   - Assign org-level roles to users
   - View current role assignments
   - Show permission preview (what permissions each role grants)

5. **Project Members (Tab 3) - Optional**
   - List all projects in organization
   - For each project, show members and their project roles
   - Add/remove project members with roles
   - Quick role assignment

---

## Architecture Decisions

### 1. **Page Location**

**Option A: Top-level organization route** (Recommended)
```
/org/:org_id/permissions
```
- ✅ Clear URL structure
- ✅ Org-scoped (not tied to any project)
- ✅ Easier access control
- ❌ Requires new top-level route

**Option B: Organization settings sub-route**
```
/org/:org_id/settings/permissions
```
- ✅ Grouped with other org settings
- ✅ More scalable (can add other settings pages)
- ❌ Requires settings page infrastructure

**Decision:** Use **Option A** for now (simpler), can migrate to Option B later when more org settings exist.

---

### 2. **Component Architecture**

```
OrganizationPermissionsPage (new page)
├── PermissionTabs (new component)
│   ├── RolesTab
│   │   └── RoleEditor (existing component ✅)
│   ├── UsersTab (new component)
│   │   ├── UserList (reuse UserListItem from UsersScopes)
│   │   ├── UserSearch (reuse pattern from UsersScopes)
│   │   └── UserRoleAssignment (new)
│   └── ProjectsTab (optional, new component)
│       └── ProjectMembersList
```

---

### 3. **Data Flow**

#### **Queries (React Query)**

```typescript
// Fetch all roles
useQueryRoles(organization_id): { roles: Role[] }

// Fetch user's roles
useQueryUserRoles(user_id, organization_id, project_id?): {
  org_roles: Role[],
  project_roles: { [project_id]: Role[] }
}

// Fetch org members (from Ganymede)
useQueryOrgMembers(organization_id): { members: OrgMember[] }

// Fetch all permissions (module-registered)
useQueryPermissions(organization_id): { permissions: PermissionDefinition[] }
```

#### **Mutations (React Query)**

```typescript
// Role management
useMutationCreateRole(organization_id)
useMutationUpdateRole(organization_id)
useMutationDeleteRole(organization_id)

// User-role assignment
useMutationAssignRole(organization_id): (user_id, role_id, scope, project_id?) => Promise
useMutationRemoveRole(organization_id): (user_id, role_id, project_id?) => Promise

// Member management (project-level)
useMutationAddProjectMember(organization_id): (project_id, user_id, role_ids) => Promise
useMutationRemoveProjectMember(organization_id): (project_id, user_id) => Promise
```

---

### 4. **What to Reuse from UsersScopes**

#### **✅ Components to Reuse**

1. **UserListItem** - Display user with avatar, name, actions
   ```tsx
   export const UserListItem = ({
     collaborator,
     onClick,
     children,
   }: {
     collaborator: TCollaborator;
     onClick?: (u: TF_User) => void;
     children?: ReactNode;
   })
   ```
   - Already exported from ui-base
   - Clean user display
   - Supports actions (buttons)

2. **ScrollArea** - Radix UI scroll wrapper
   ```tsx
   export const ScrollArea = ({ children }: { children: ReactNode })
   ```
   - Already exported from ui-base
   - Consistent scrolling UX

#### **✅ Patterns to Reuse**

1. **Three-panel layout** - Works well for list → search → edit flow
2. **Search with debounce** - Real-time user filtering
3. **Loading states** - Button spinner indicators
4. **Optimistic updates** - Immediate UI feedback
5. **CSS variable-based sizing** - `--column-width`, `--avatar-width`

#### **❌ What NOT to Reuse**

1. ~~Scope checkboxes~~ - Use role dropdown/selector instead
2. ~~Direct permission editing~~ - All via roles now
3. ~~`useQueryScope`~~ - Incompatible with RBAC
4. ~~`useMutationUserPermissions`~~ - Use role assignment

---

## Detailed Implementation Plan

### **Phase 1: Create New React Query Hooks** (Location: `packages/frontend-data/src/lib/queries.ts`)

#### 1.1 Role Queries
```typescript
export const useQueryRoles = (organization_id: string) => {
  return useQuery({
    queryKey: ['roles', organization_id],
    queryFn: async () => {
      const res = await gatewayFetch('/roles');
      return res.json();
    },
  });
};

export const useQueryUserRoles = (
  user_id: string,
  organization_id: string,
  project_id?: string
) => {
  return useQuery({
    queryKey: ['user-roles', user_id, organization_id, project_id],
    queryFn: async () => {
      const url = project_id
        ? `/users/${user_id}/roles?project_id=${project_id}`
        : `/users/${user_id}/roles`;
      const res = await gatewayFetch(url);
      return res.json();
    },
  });
};
```

#### 1.2 Role Mutations
```typescript
export const useMutationCreateRole = (organization_id: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (role: CreateRoleInput) => {
      const res = await gatewayFetch('/roles', {
        method: 'POST',
        body: JSON.stringify(role),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['roles', organization_id]);
    },
  });
};

// Similar for update, delete, assign role, remove role
```

#### 1.3 Member Queries
```typescript
export const useQueryOrgMembers = (organization_id: string) => {
  return useQuery({
    queryKey: ['org-members', organization_id],
    queryFn: async () => {
      const res = await ganymedeFetch(`/orgs/${organization_id}/members`);
      return res.json();
    },
  });
};
```

---

### **Phase 2: Create UI Components** (Location: `packages/ui-base/src/lib/permissions-page/`)

#### 2.1 Main Page Component
```tsx
// permissions-page.tsx
export const OrganizationPermissionsPage = ({
  organization_id,
}: {
  organization_id: string;
}) => {
  const [activeTab, setActiveTab] = useState<'roles' | 'users' | 'projects'>('roles');

  return (
    <div className="permissions-page">
      <header>
        <h1>Organization Permissions</h1>
        <Tabs value={activeTab} onChange={setActiveTab} />
      </header>
      
      <div className="tab-content">
        {activeTab === 'roles' && <RolesTab organization_id={organization_id} />}
        {activeTab === 'users' && <UsersTab organization_id={organization_id} />}
        {activeTab === 'projects' && <ProjectsTab organization_id={organization_id} />}
      </div>
    </div>
  );
};
```

#### 2.2 RolesTab (Reuse RoleEditor)
```tsx
// roles-tab.tsx
export const RolesTab = ({ organization_id }: { organization_id: string }) => {
  const { data, isLoading } = useQueryRoles(organization_id);
  const createRole = useMutationCreateRole(organization_id);
  const updateRole = useMutationUpdateRole(organization_id);
  const deleteRole = useMutationDeleteRole(organization_id);

  return (
    <RoleEditor
      roles={data?.roles || []}
      loading={isLoading}
      onCreateRole={createRole.mutateAsync}
      onUpdateRole={updateRole.mutateAsync}
      onDeleteRole={deleteRole.mutateAsync}
    />
  );
};
```

#### 2.3 UsersTab (NEW - inspired by UsersScopes)
```tsx
// users-tab.tsx
export const UsersTab = ({ organization_id }: { organization_id: string }) => {
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const { data: members } = useQueryOrgMembers(organization_id);
  const { data: roles } = useQueryRoles(organization_id);
  const assignRole = useMutationAssignRole(organization_id);
  const removeRole = useMutationRemoveRole(organization_id);

  return (
    <div className="users-tab">
      {/* Left panel: User list */}
      <div className="panel-users">
        <h3>Organization Members</h3>
        <ScrollArea>
          {members?.map(user => (
            <UserListItem
              key={user.user_id}
              collaborator={user}
              onClick={() => setSelectedUser(user.user_id)}
            >
              <RoleBadges roles={getUserRoles(user.user_id)} />
            </UserListItem>
          ))}
        </ScrollArea>
      </div>

      {/* Right panel: Role assignment */}
      {selectedUser && (
        <div className="panel-role-assignment">
          <h3>Assign Roles</h3>
          <UserRoleEditor
            user_id={selectedUser}
            organization_id={organization_id}
            onAssignRole={assignRole}
            onRemoveRole={removeRole}
          />
        </div>
      )}
    </div>
  );
};
```

#### 2.4 ProjectsTab (NEW - optional)
```tsx
// projects-tab.tsx  
export const ProjectsTab = ({ organization_id }: { organization_id: string }) => {
  const { data: projects } = useQueryProjects(organization_id);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  return (
    <div className="projects-tab">
      {/* Left: Project list */}
      <div className="panel-projects">
        <h3>Projects</h3>
        <ScrollArea>
          {projects?.map(project => (
            <ProjectCard
              key={project.project_id}
              project={project}
              onClick={() => setSelectedProject(project.project_id)}
            />
          ))}
        </ScrollArea>
      </div>

      {/* Right: Project members with roles */}
      {selectedProject && (
        <ProjectMembersList
          project_id={selectedProject}
          organization_id={organization_id}
        />
      )}
    </div>
  );
};
```

---

## File Structure

```
packages/
├── ui-base/src/lib/
│   ├── users-scopes/               [DELETE ENTIRELY]
│   │   ├── users-scopes.tsx        ❌ Remove
│   │   ├── users-scopes.scss       ❌ Remove
│   │   ├── users-scopes.stories.tsx ❌ Remove
│   │   └── test-data.ts            ❌ Remove
│   │
│   ├── role-editor/                [KEEP - already created]
│   │   ├── role-editor.tsx         ✅ Done
│   │   ├── role-editor.scss        ✅ Done
│   │   └── role-editor.stories.tsx ✅ Done
│   │
│   └── permissions-page/           [NEW]
│       ├── permissions-page.tsx    📝 Main page component
│       ├── permissions-page.scss   📝 Styling
│       ├── roles-tab.tsx           📝 RoleEditor wrapper
│       ├── users-tab.tsx           📝 User role assignment
│       ├── projects-tab.tsx        📝 Project members (optional)
│       ├── user-role-editor.tsx    📝 Role assignment UI
│       └── permissions-page.stories.tsx 📝 Storybook
│
├── frontend-data/src/lib/
│   ├── queries.ts                  📝 Add new hooks:
│   │                                  - useQueryRoles
│   │                                  - useQueryUserRoles
│   │                                  - useMutationCreateRole
│   │                                  - useMutationUpdateRole
│   │                                  - useMutationDeleteRole
│   │                                  - useMutationAssignRole
│   │                                  - useMutationRemoveRole
│   │                                  - useMutationAddProjectMember
│   │                                  - useMutationRemoveProjectMember
│   │
│   └── types.ts                    📝 Add Role, UserRoleAssignment types
│
└── app-frontend/src/app/
    ├── app.tsx                     📝 Add route: /org/:org_id/permissions
    ├── pages/
    │   ├── project/
    │   │   ├── authorizations.tsx  ❌ DELETE (obsolete, project-level)
    │   │   └── sidebar.tsx         📝 Remove 'authorizations' menu item
    │   │
    │   └── organization/
    │       ├── permissions-page.tsx 📝 NEW: Use OrganizationPermissionsPage
    │       └── organization-sidebar.tsx 📝 NEW: Org-level navigation
```

---

## Component Specifications

### **1. OrganizationPermissionsPage**

**Location:** `packages/ui-base/src/lib/permissions-page/permissions-page.tsx`

**Props:**
```typescript
export interface OrganizationPermissionsPageProps {
  organization_id: string;
  // Logic props (hooks)
  roles: Role[];
  rolesLoading: boolean;
  orgMembers: OrgMember[];
  membersLoading: boolean;
  onCreateRole: (role: CreateRoleInput) => Promise<void>;
  onUpdateRole: (role_id: string, updates: Partial<Role>) => Promise<void>;
  onDeleteRole: (role_id: string) => Promise<void>;
  onAssignRole: (user_id: string, role_id: string, scope: 'org' | 'project', project_id?: string) => Promise<void>;
  onRemoveRole: (user_id: string, role_id: string, project_id?: string) => Promise<void>;
}
```

**UI Structure:**
```tsx
<div className="permissions-page">
  <header>
    <h1>Organization Permissions</h1>
    <p>Manage roles and user access</p>
  </header>

  <Tabs defaultValue="roles">
    <TabsList>
      <TabsTrigger value="roles">Roles</TabsTrigger>
      <TabsTrigger value="users">Users</TabsTrigger>
      <TabsTrigger value="projects">Projects</TabsTrigger>
    </TabsList>

    <TabsContent value="roles">
      <RoleEditor {...roleProps} />
    </TabsContent>

    <TabsContent value="users">
      <UsersTab {...userProps} />
    </TabsContent>

    <TabsContent value="projects">
      <ProjectsTab {...projectProps} />
    </TabsContent>
  </Tabs>
</div>
```

---

### **2. UsersTab Component**

**Location:** `packages/ui-base/src/lib/permissions-page/users-tab.tsx`

**Features:**
- Two-panel layout (user list + role assignment)
- Search users by name/email
- Display current role badges
- Assign/remove org-level roles
- Permission preview popover

**Reused from UsersScopes:**
- `UserListItem` component ✅
- `ScrollArea` component ✅
- User search pattern ✅
- Loading states ✅

**New Elements:**
- Role dropdown selector (instead of checkboxes)
- Permission preview tooltip
- Org vs project role indicator
- Role badge list

**Mock UI:**
```
┌─────────────────────────────────────────────────────────────┐
│ Organization Members                                        │
├─────────────────┬───────────────────────────────────────────┤
│ [Search users]  │  Edit Roles: John Doe                     │
│                 │                                            │
│ ● John Doe      │  Organization Roles:                      │
│   org:admin     │  ┌─────────────────────────────────────┐  │
│                 │  │ ☑ org:admin                          │  │
│ ● Jane Smith    │  │   (view 15 permissions)              │  │
│   project-dev   │  │ ☐ Custom Role 1                      │  │
│                 │  └─────────────────────────────────────┘  │
│ ● Bob Wilson    │                                            │
│   (no roles)    │  [+ Assign New Role ▼]                    │
│                 │                                            │
└─────────────────┴───────────────────────────────────────────┘
```

---

### **3. UserRoleEditor Component**

**Location:** `packages/ui-base/src/lib/permissions-page/user-role-editor.tsx`

**Props:**
```typescript
interface UserRoleEditorProps {
  user_id: string;
  organization_id: string;
  project_id?: string; // Optional for project-scoped assignment
  currentRoles: Role[];
  availableRoles: Role[];
  onAssignRole: (role_id: string, scope: 'org' | 'project') => Promise<void>;
  onRemoveRole: (role_id: string) => Promise<void>;
}
```

**Features:**
- List currently assigned roles with remove button
- Dropdown to select and assign new roles
- Permission preview (hover/click to expand)
- Org vs project scope selector
- Visual distinction for system roles

---

## Migration Strategy

### **Step 1: Create New Components** (No Breaking Changes)
- Create `packages/ui-base/src/lib/permissions-page/` with all new components
- Keep UsersScopes untouched temporarily

### **Step 2: Add React Query Hooks** (Additive)
- Add new hooks to `frontend-data/src/lib/queries.ts`
- Keep old hooks (`useQueryScope`, etc.) temporarily

### **Step 3: Add New Route** (Additive)
- Add `/org/:org_id/permissions` route to app.tsx
- Don't remove project authorizations route yet

### **Step 4: Test New Page**
- Verify role management works
- Verify user role assignment works
- Test permission resolution

### **Step 5: Remove Old Code** (Breaking)
- Delete `packages/ui-base/src/lib/users-scopes/` entirely
- Delete `packages/app-frontend/src/app/pages/project/authorizations.tsx`
- Remove from project sidebar
- Remove old query hooks

---

## Implementation Checklist

### **Phase 1: Backend API Hooks** (frontend-data)
- [ ] `useQueryRoles` - Fetch all roles
- [ ] `useQueryUserRoles` - Fetch user's roles
- [ ] `useQueryOrgMembers` - Fetch org members
- [ ] `useQueryPermissions` - Fetch available permissions
- [ ] `useMutationCreateRole` - Create role
- [ ] `useMutationUpdateRole` - Update role
- [ ] `useMutationDeleteRole` - Delete role
- [ ] `useMutationAssignRole` - Assign role to user
- [ ] `useMutationRemoveRole` - Remove role from user
- [ ] `useMutationAddProjectMember` - Add project member with roles
- [ ] `useMutationRemoveProjectMember` - Remove project member

### **Phase 2: UI Components** (ui-base)
- [ ] Create `permissions-page/` directory
- [ ] `permissions-page.tsx` - Main component with tabs
- [ ] `permissions-page.scss` - Styling
- [ ] `roles-tab.tsx` - Wrapper for RoleEditor
- [ ] `users-tab.tsx` - User role assignment interface
- [ ] `user-role-editor.tsx` - Role selector and assignment
- [ ] `projects-tab.tsx` - Project member management (optional)
- [ ] `permissions-page.stories.tsx` - Storybook stories
- [ ] Export from `ui-base/src/index.ts`

### **Phase 3: App Integration** (app-frontend)
- [ ] Add `/org/:org_id/permissions` route to app.tsx
- [ ] Create `pages/organization/permissions-page.tsx` (wrapper with hooks)
- [ ] Add permission check (require `org:admin` or `org:owner`)
- [ ] Add navigation link (org-level menu)

### **Phase 4: Cleanup** (Breaking Changes)
- [ ] Delete `ui-base/src/lib/users-scopes/` directory
- [ ] Delete `app-frontend/src/app/forms/authorizations.tsx`
- [ ] Remove from `app-frontend/src/app/pages/project/sidebar.tsx`
- [ ] Remove exports from `ui-base/src/index.ts`
- [ ] Remove old query hooks from `frontend-data`

### **Phase 5: Testing**
- [ ] Test role creation/editing
- [ ] Test user role assignment
- [ ] Test permission resolution
- [ ] Test project member add/remove
- [ ] Test with org:owner and org:admin users
- [ ] Test readonly mode
- [ ] Storybook visual testing

---

## Design Considerations

### **UI/UX Principles**

1. **Tab-based Navigation**
   - Clear separation of concerns (Roles vs Users vs Projects)
   - Easy to find specific management tasks

2. **Permission Preview**
   - Show what permissions a role grants (hover or expandable)
   - Help users understand impact of role assignment

3. **Visual Hierarchy**
   - System roles: Distinct badge/styling (can't edit)
   - Custom roles: Editable, deletable
   - Owner: Special protection (can't remove org:owner from owner)

4. **Error Prevention**
   - Confirm before deleting role (shows how many users affected)
   - Prevent removing last admin
   - Clear validation messages

5. **Responsive**
   - Works on various screen sizes
   - Scroll areas for long lists
   - CSS variables for sizing

---

## API Integration Summary

### **Gateway API Calls**

| Action | Method | Endpoint | Body |
|--------|--------|----------|------|
| List roles | GET | `/roles` | - |
| Create role | POST | `/roles` | `{ role_name, display_name, permissions, scope }` |
| Update role | PATCH | `/roles/:id` | `{ display_name?, permissions? }` |
| Delete role | DELETE | `/roles/:id` | - |
| Get user roles | GET | `/users/:id/roles` | - |
| Assign role | POST | `/users/:id/roles` | `{ role_id, scope, project_id? }` |
| Remove role | DELETE | `/users/:id/roles/:role_id` | `?project_id=...` |
| Add project member | POST | `/members/projects/:id/users` | `{ user_id, role_ids }` |
| Remove project member | DELETE | `/members/projects/:id/users/:id` | - |

### **Ganymede API Calls**

| Action | Method | Endpoint | Purpose |
|--------|--------|----------|---------|
| List org members | GET | `/orgs/:id/members` | Get users for assignment |
| List projects | GET | `/orgs/:id/projects` | Get projects for member mgmt |
| List available permissions | GET via Gateway | `/permissions` | Show permission catalog |

---

## Effort Estimation

| Phase | Component | Estimated Lines | Complexity |
|-------|-----------|-----------------|------------|
| 1 | React Query Hooks | ~500 | Medium |
| 2.1 | Main page component | ~200 | Low |
| 2.2 | RolesTab (wrapper) | ~50 | Low |
| 2.3 | UsersTab | ~300 | Medium |
| 2.4 | UserRoleEditor | ~250 | Medium |
| 2.5 | ProjectsTab | ~400 | High (optional) |
| 3 | App integration | ~100 | Low |
| 4 | Cleanup | -1500 | Low |
| 5 | Testing | ~300 | Medium |

**Total Effort:** ~2,600 new lines, ~1,500 deleted lines

---

## Open Questions

1. **Navigation:** Where should the link to this page appear?
   - Option A: Top nav bar (global)
   - Option B: Organization dropdown menu
   - Option C: User menu (if admin)

2. **Permission:** Should regular members see this page in read-only mode?
   - Or should it be completely hidden from non-admins?

3. **Projects Tab:** Should we implement project member management in Phase 1?
   - Or defer to Phase 2 after user feedback?

4. **UsersScopes Removal:** Should we keep it temporarily for backward compatibility?
   - Or remove immediately since there's no backward compat requirement?

---

## Recommended Approach

### **Immediate (MVP)**
1. ✅ Create React Query hooks for RBAC API
2. ✅ Create RolesTab (wrapper for existing RoleEditor)
3. ✅ Create UsersTab with org-level role assignment
4. ✅ Add organization route `/org/:org_id/permissions`
5. ✅ Test with org:admin user

### **Phase 2 (After Testing)**
1. Create ProjectsTab for project member management
2. Add navigation link in app UI
3. Add permission preview popovers
4. Polish UX (animations, better error messages)

### **Phase 3 (Cleanup)**
1. Delete UsersScopes entirely
2. Delete project authorizations page
3. Remove old query hooks
4. Update documentation

---

## Next Steps

**Shall I proceed with implementation?**

**Proposed Order:**
1. Create React Query hooks (frontend-data)
2. Create UsersTab component (ui-base)
3. Create main PermissionsPage component (ui-base)
4. Integrate in app-frontend with route
5. Test end-to-end
6. Delete UsersScopes and old code

**OR would you like me to adjust the plan first?**
