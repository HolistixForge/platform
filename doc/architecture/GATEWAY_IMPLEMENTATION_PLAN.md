# Gateway Implementation - Detailed Task Inventory (REVISED)

**Goal:** Transform gateway from project-based to organization-based with clean separation of concerns.

---

## 🎯 KEY ARCHITECTURAL DECISIONS

### 1. **Clean Separation of Concerns** ✅

- **GatewayState** = Generic persistent storage (save/load/dirty tracking)
- **PermissionManager** = Uses GatewayState for permission data
- **OAuthManager** = Uses GatewayState for OAuth data
- **ContainerTokenManager** = Uses GatewayState for container tokens
- Each manager is responsible for its domain logic

### 2. **Simple Permissions (MVP)** ✅

- Array of permission strings per user: `["org:admin", "container:123:delete"]`
- Exact string matching (no hierarchy/wildcards for now)
- Easy to add hierarchy later without breaking changes
- Focus on getting it working first

### 3. **One Gateway = One Organization** ✅

- Gateway manages ALL projects within an organization
- Shares VPN network
- Single permission system for entire org

### 4. **Separate YJS State Per Project** ✅

- Each project has its own YJS room (different room_id)
- Separate files: `/data/project-{project_id}/timestamp.json`
- Gateway manages multiple concurrent YJS rooms

### 5. **Storage Layout** ✅

```
/data/
├── gateway-state-{org_id}.json       ← Generic org-scoped data
│   ├── permissions: {...}             ← Used by PermissionManager
│   ├── oauth_clients: {...}           ← Used by OAuthManager
│   ├── oauth_tokens: {...}            ← Used by OAuthManager
│   └── container_tokens: {...}        ← Used by ContainerTokenManager
├── project-{proj_1}/
│   ├── 1699123456789.json             ← Project 1 YJS state
│   └── 1699123567890.json
├── project-{proj_2}/
│   └── 1699123456789.json             ← Project 2 YJS state
└── project-{proj_3}/
    └── 1699123456789.json             ← Project 3 YJS state
```

---

## 📦 CLASS RESPONSIBILITIES

### GatewayState (Generic Storage)

- Load/save JSON file
- Track dirty flag
- Auto-save every 30s if dirty
- Provide generic get/set/update methods
- **Does NOT know about** permissions, OAuth, or containers

### PermissionManager

- Simple string array per user
- `hasPermission(user_id, permission: string): boolean` - Exact match
- `addPermission(user_id, permission: string)` - Uses GatewayState
- `removePermission(user_id, permission: string)` - Uses GatewayState
- `initializeFromConfig(org_config)` - Set initial permissions

### OAuthManager

- OAuth2Server model implementation
- Uses GatewayState for clients/codes/tokens storage
- `getClient()`, `saveToken()`, etc.

### ContainerTokenManager

- Generate/validate HMAC tokens
- Uses GatewayState for storage
- `generateToken(container_id, project_id)`
- `validateToken(token)`

---

## 🎯 IMPLEMENTATION PHASES (REVISED)

### PHASE 1: GatewayState (Generic Storage Foundation)

**Purpose:** Generic persistent storage that other managers use

**Files to Create:**

1. `packages/app-collab/src/state/GatewayState.ts` - Generic state manager
2. `packages/app-collab/src/state/types.ts` - Data structure types

**Sub-tasks:**

**1.1 Create Data Structure Types** (`state/types.ts`)

```typescript
// Simple data structure (no logic here)
export interface TGatewayStateData {
  organization_id: string;
  gateway_id: string;

  // Permission data (used by PermissionManager)
  permissions: {
    [user_id: string]: string[]; // Just array of permission strings
  };

  // OAuth data (used by OAuthManager)
  oauth_clients: {
    [client_id: string]: {
      client_id: string;
      client_secret: string;
      container_id: string;
      project_id: string;
      service_name: string;
      redirect_uris: string[];
      grants: string[];
      created_at: string;
    };
  };

  oauth_authorization_codes: {
    [code: string]: {
      code: string;
      client_id: string;
      user_id: string;
      scope: string[];
      redirect_uri: string;
      expires_at: string;
      created_at: string;
    };
  };

  oauth_tokens: {
    [token_id: string]: {
      token_id: string;
      client_id: string;
      user_id: string;
      scope: string[];
      access_token: string;
      access_token_expires_at: string;
      refresh_token: string;
      refresh_token_expires_at: string;
      created_at: string;
    };
  };

  // Container tokens (used by ContainerTokenManager)
  container_tokens: {
    [container_id: string]: {
      token: string;
      project_id: string;
      created_at: string;
    };
  };

  saved_at: string;
}
```

**1.2 Create GatewayState Class** (`state/GatewayState.ts`)

- [ ] **Generic storage class - no domain logic**
- [ ] Constructor(org_id, gateway_id) - Initialize empty state
- [ ] `initialize(org_id, gateway_id)` - Setup IDs
- [ ] `load()` - Load from `/data/gateway-state-{org_id}.json`
- [ ] `save()` - Atomic write (tmp file + rename)
- [ ] `markDirty()` - Set dirty flag
- [ ] `startAutoSave()` - setInterval(30s), save if dirty
- [ ] **Generic accessors:**
  - [ ] `getData()` - Get entire state (read-only)
  - [ ] `updateData(updater: (data) => void)` - Update state + markDirty
  - [ ] `get(path: string)` - Get nested value (e.g., 'permissions.user123')
  - [ ] `set(path: string, value)` - Set nested value + markDirty
- [ ] Shutdown handlers (SIGTERM, SIGINT) - save before exit
- [ ] Error handling for load/save failures

**1.3 Test GatewayState**

- [ ] Create instance, save, load
- [ ] Verify atomic writes
- [ ] Verify auto-save only when dirty
- [ ] Verify shutdown saves
- [ ] Verify state isolation (multiple instances if needed)

---

### PHASE 2: PermissionManager (Simple String-Based)

**Purpose:** Manage permissions using GatewayState for persistence

**Files to Create:**

1. `packages/app-collab/src/permissions/PermissionManager.ts` - Permission logic
2. `packages/app-collab/src/permissions/types.ts` - Permission types
3. `packages/app-collab/src/middleware/permissions.ts` - Express middleware

**Sub-tasks:**

**2.1 Create PermissionManager** (`permissions/PermissionManager.ts`)

```typescript
export class PermissionManager {
  constructor(private gatewayState: GatewayState) {}

  // Simple exact-match permission checking
  hasPermission(user_id: string, permission: string): boolean {
    const perms = this.gatewayState.getData().permissions[user_id] || [];
    return perms.includes(permission);
  }

  addPermission(user_id: string, permission: string): void {
    this.gatewayState.updateData((data) => {
      if (!data.permissions[user_id]) {
        data.permissions[user_id] = [];
      }
      if (!data.permissions[user_id].includes(permission)) {
        data.permissions[user_id].push(permission);
      }
    });
  }

  removePermission(user_id: string, permission: string): void {
    this.gatewayState.updateData((data) => {
      if (data.permissions[user_id]) {
        data.permissions[user_id] = data.permissions[user_id].filter(
          (p) => p !== permission
        );
      }
    });
  }

  getPermissions(user_id: string): string[] {
    return this.gatewayState.getData().permissions[user_id] || [];
  }

  setPermissions(user_id: string, permissions: string[]): void {
    this.gatewayState.updateData((data) => {
      data.permissions[user_id] = permissions;
    });
  }

  // Initialize from organization config
  async initializeFromConfig(config: TOrganizationConfig): Promise<void> {
    // Map org roles to permission strings
    for (const member of config.members) {
      const perms = [`org:${member.role}`]; // Simple: "org:owner", "org:admin", "org:member"
      this.setPermissions(member.user_id, perms);
    }

    // Fetch and add project-level permissions
    for (const project_id of config.projects) {
      const members = await fetchProjectMembers(project_id);
      for (const member of members) {
        this.addPermission(member.user_id, `project:${project_id}:member`);
      }
    }
  }
}
```

**2.2 Create Permission Middleware** (`middleware/permissions.ts`)

```typescript
// Simple middleware - just checks exact permission string
export const requirePermission = (permission: string) =>
  asyncHandler(async (req: AuthRequest, res, next) => {
    if (!permissionManager.hasPermission(req.user.id, permission)) {
      return res
        .status(403)
        .json({ error: `Permission denied: ${permission}` });
    }
    next();
  });

// For dynamic permissions with IDs from request
export const requirePermissionTemplate = (template: string) =>
  asyncHandler(async (req: AuthRequest, res, next) => {
    // Replace ${params.id} with actual value
    const permission = template.replace(
      /\$\{params\.(\w+)\}/g,
      (_, key) => req.params[key]
    );

    if (!permissionManager.hasPermission(req.user.id, permission)) {
      return res
        .status(403)
        .json({ error: `Permission denied: ${permission}` });
    }
    next();
  });
```

**2.3 Create Singleton Instance** (`permissions/index.ts`)

- [ ] Export `permissionManager` singleton
- [ ] Export types

**2.4 Test Permissions**

- [ ] Add permission, check it exists
- [ ] Remove permission, check it's gone
- [ ] Check non-existent permission returns false
- [ ] Middleware blocks unauthorized requests
- [ ] Middleware allows authorized requests

**Note:** Hierarchy/wildcards can be added later by just updating `hasPermission()` logic

---

### PHASE 3: Multi-Project YJS Rooms

**Purpose:** One gateway manages multiple YJS rooms (one per project)

**Files to Create:**

1. `packages/app-collab/src/state/ProjectRooms.ts` - Room manager
2. `packages/json-file-persistence/src/ProjectPersistence.ts` - Per-project save/load

**Sub-tasks:**

**3.1 Create ProjectRoomsManager** (`state/ProjectRooms.ts`)

- [ ] Class with `Map<project_id, RoomData>`
- [ ] `initializeProject(project_id)` - Create YJS doc + room_id
- [ ] `getRoom(project_id)` - Get room data
- [ ] `getAllRooms()` - Return all rooms for WebSocket
- [ ] `saveAll()` - Save all project YJS states
- [ ] `startAutoSave()` - Save all every 2min

**3.2 Create ProjectPersistence** (`json-file-persistence/src/ProjectPersistence.ts`)

- [ ] Constructor(project_id)
- [ ] `load(ydoc)` - Load from `/data/project-{id}/{latest}.json`
- [ ] `save(ydoc)` - Save to `/data/project-{id}/{timestamp}.json`
- [ ] `getStoragePath()` - Ensure directory exists
- [ ] `getLatestFile()` - Find most recent save
- [ ] `cleanupOldFiles()` - Keep last N files

**3.3 Update WebSocket** (`websocket.ts`)

- [ ] Accept `ProjectRoomsManager` instead of single roomId
- [ ] Route WebSocket connections to correct room
- [ ] Use query param or path to identify project: `/ws?project_id=123`
- [ ] Each connection subscribes to correct YJS doc

**3.4 Update Initialization** (`main.ts`)

- [ ] Create `projectRooms = new ProjectRoomsManager()`
- [ ] For each project in org config: `projectRooms.initializeProject(project_id)`
- [ ] Pass projectRooms to WebSocket setup
- [ ] Start auto-save for all rooms

**3.5 Test Multi-Project Rooms**

- [ ] 3 projects = 3 separate YJS docs
- [ ] 3 separate file directories
- [ ] Data isolation verified

---

### PHASE 4: OAuthManager

**Purpose:** Manage OAuth clients/codes/tokens using GatewayState

**Files to Create:**

1. `packages/app-collab/src/oauth/OAuthManager.ts` - OAuth data management
2. `packages/app-collab/src/oauth/model.ts` - OAuth2Server model adapter
3. `packages/app-collab/src/oauth/server.ts` - OAuth2Server instance
4. `packages/app-collab/src/routes/oauth.ts` - OAuth routes

**Sub-tasks:**

**4.1 Add OAuth2Server Dependency**

- [ ] Add `@node-oauth/oauth2-server` to package.json
- [ ] Run `npm install`

**4.2 Create OAuthManager** (`oauth/OAuthManager.ts`)

```typescript
export class OAuthManager {
  constructor(private gatewayState: GatewayState) {}

  // Client management
  addClient(client: TOAuthClient): void {
    this.gatewayState.updateData((data) => {
      data.oauth_clients[client.client_id] = client;
    });
  }

  getClient(client_id: string): TOAuthClient | null {
    return this.gatewayState.getData().oauth_clients[client_id] || null;
  }

  deleteClient(client_id: string): void {
    this.gatewayState.updateData((data) => {
      delete data.oauth_clients[client_id];
    });
  }

  // Authorization codes
  saveCode(code: TOAuthCode): void { ... }
  getCode(code_string: string): TOAuthCode | null { ... }
  deleteCode(code_string: string): void { ... }

  // Tokens
  saveToken(token: TOAuthToken): void { ... }
  getToken(access_token: string): TOAuthToken | null { ... }
  deleteToken(token_id: string): void { ... }

  // Cleanup expired codes/tokens
  cleanupExpired(): void { ... }
}
```

**4.3 Create OAuth2Server Model** (`oauth/model.ts`)

- [ ] Implement OAuth2Server model interface
- [ ] Use `oauthManager` for all data access
- [ ] `getClient()` - Call oauthManager.getClient()
- [ ] `saveAuthorizationCode()` - Call oauthManager.saveCode()
- [ ] `getAuthorizationCode()` - Call oauthManager.getCode()
- [ ] `saveToken()` - Call oauthManager.saveToken()
- [ ] `getRefreshToken()` - Call oauthManager.getToken()
- [ ] `validateScope()` - Use permissionManager.hasPermission()

**4.4 Create OAuth2Server Instance** (`oauth/server.ts`)

- [ ] Initialize OAuth2Server with model
- [ ] Export singleton

**4.5 Create OAuth Routes** (`routes/oauth.ts`)

- [ ] `GET /oauth/authorize` - Check auth, show consent
- [ ] `POST /oauth/authorize` - Generate code, redirect
- [ ] `POST /oauth/token` - Exchange code for tokens
- [ ] `GET /oauth/public-key` - Return JWT public key

**4.6 Update main.ts**

- [ ] Setup OAuth routes

**4.7 Test OAuth**

- [ ] Client registration works
- [ ] Authorization flow works
- [ ] Token exchange works
- [ ] Token validation works

---

### PHASE 5: ContainerTokenManager

**Purpose:** Manage container HMAC tokens using GatewayState

**Files to Create:**

1. `packages/app-collab/src/containers/ContainerTokenManager.ts`

**Sub-tasks:**

**5.1 Create ContainerTokenManager** (`containers/ContainerTokenManager.ts`)

```typescript
export class ContainerTokenManager {
  constructor(private gatewayState: GatewayState) {}

  generateToken(container_id: string, project_id: string): string {
    const payload = {
      container_id,
      project_id,
      org_id: this.gatewayState.getData().organization_id,
    };
    const token = makeHmacToken(CONFIG.HMAC_SECRET, payload);

    this.gatewayState.updateData((data) => {
      data.container_tokens[container_id] = {
        token,
        project_id,
        created_at: new Date().toISOString(),
      };
    });

    return token;
  }

  validateToken(
    token: string
  ): { container_id: string; project_id: string } | null {
    // Verify HMAC, extract payload
    const payload = verifyHmacToken(token, CONFIG.HMAC_SECRET);
    const stored =
      this.gatewayState.getData().container_tokens[payload.container_id];

    if (stored && stored.token === token) {
      return {
        container_id: payload.container_id,
        project_id: payload.project_id,
      };
    }
    return null;
  }

  deleteToken(container_id: string): void {
    this.gatewayState.updateData((data) => {
      delete data.container_tokens[container_id];
    });
  }
}
```

**5.2 Test ContainerTokenManager**

- [ ] Generate token
- [ ] Validate token
- [ ] Invalid token rejected
- [ ] Delete token

---

### PHASE 6: Organization-Based Initialization

**Purpose:** Initialize gateway for entire org with multiple projects

**Files to Update:**

1. `packages/app-collab/src/main.ts` - Org initialization
2. `packages/modules/gateway/src/index.ts` - Update config types

**Sub-tasks:**

**6.1 Update Gateway Module Config** (`modules/gateway/src/index.ts`)

- [ ] Define `TOrganizationConfig`:
  ```typescript
  export type TOrganizationConfig = {
    organization_id: string;
    organization_name: string;
    gateway_id: string;
    gateway_token: string;
    projects: string[]; // project_ids
    members: Array<{
      user_id: string;
      username: string;
      role: 'owner' | 'admin' | 'member';
    }>;
  };
  ```
- [ ] Update exports to include `organization_id` instead of `project_id`
- [ ] Remove `ForwardException`, `RunException` (deleted from backend-engine)

**6.2 Create Initialization Flow** (`main.ts`)

```typescript
async function startOrganizationGateway(config: TOrganizationConfig) {
  // 1. Initialize GatewayState
  gatewayState.initialize(config.organization_id, config.gateway_id);
  await gatewayState.load();
  gatewayState.startAutoSave();

  // 2. Initialize managers
  const permissionManager = new PermissionManager(gatewayState);
  const oauthManager = new OAuthManager(gatewayState);
  const containerTokenManager = new ContainerTokenManager(gatewayState);

  // 3. Initialize permissions
  await permissionManager.initializeFromConfig(config);

  // 4. Initialize projects (YJS rooms)
  const projectRooms = new ProjectRoomsManager();
  for (const project_id of config.projects) {
    await projectRooms.initializeProject(project_id);
  }
  projectRooms.startAutoSave();

  // 5. Initialize modules
  await initModules(bep, config, projectRooms);

  // 6. Start WebSocket (all rooms)
  graftYjsWebsocket(servers, projectRooms);

  // 7. Signal ready
  await fetch(`https://${CONFIG.GANYMEDE_FQDN}/gateway/ready`, {
    method: 'POST',
    headers: { authorization: config.gateway_token },
    body: JSON.stringify({ gateway_id: config.gateway_id }),
  });
}
```

**6.3 Update `/collab/start` Route**

- [ ] Receive `TOrganizationConfig` from Ganymede
- [ ] Call `startOrganizationGateway(config)`

**6.4 Export Manager Instances**

- [ ] Export from `state/index.ts` or create context
- [ ] Make available to routes and modules

**6.5 Test Initialization**

- [ ] Start gateway with org config
- [ ] Verify gatewayState loaded
- [ ] Verify permissions initialized
- [ ] Verify all projects have YJS rooms
- [ ] Verify auto-saves working

---

### PHASE 7: Container Integration

**Purpose:** Update user-containers module to use managers

**Files to Update:**

1. `packages/modules/user-containers/src/lib/servers-reducer.ts`

**Sub-tasks:**

**7.1 Update Container Reducer**

- [ ] Inject `permissionManager`, `oauthManager`, `containerTokenManager` via context
- [ ] Update `_new()`:
  - [ ] Check permission: `permissionManager.hasPermission(user_id, "container:create")`
  - [ ] Create OAuth clients via `oauthManager.addClient()`
- [ ] Update `_delete()`:
  - [ ] Check permission: `permissionManager.hasPermission(user_id, "container:delete")`
  - [ ] Delete OAuth clients via `oauthManager.deleteClient()`
  - [ ] Delete container token via `containerTokenManager.deleteToken()`

**7.2 Add Container Hosting Endpoint** (Optional)

- [ ] Route: `POST /containers/:id/hosting-token`
- [ ] Check permission
- [ ] Generate token via `containerTokenManager.generateToken()`
- [ ] Return Docker command with SETTINGS

**7.3 Update Watchdog Validation**

- [ ] Validate token via `containerTokenManager.validateToken()`
- [ ] Update container state in correct project's YJS room

**7.4 Test Container Flow**

- [ ] Create container → OAuth clients in gatewayState
- [ ] Host container → Token generated
- [ ] Watchdog → Token validated
- [ ] Delete container → Cleanup OAuth + token

---

### PHASE 8: Integration & Cleanup

**Sub-tasks:**

**8.1 Fix Module Imports**

- [ ] Update `modules/gateway` - Remove deleted exception imports
- [ ] Use standard `Error` class

**8.2 Delete app-ganymede-cmds**

- [ ] Run `npx nx g remove app-ganymede-cmds`
- [ ] No longer needed (API-based management)

**8.3 Clean OAuth in Ganymede**

- [ ] Keep only global client in `app-ganymede/src/models/oauth.ts`
- [ ] Remove database OAuth logic

**8.4 Update OpenAPI Specs**

- [ ] Add OAuth endpoints to `app-collab/src/oas30.json`
- [ ] Remove OAuth from `app-ganymede/src/oas30.json` (moved to gateway)

**8.5 End-to-End Testing**

- [ ] Create org → Start gateway → 3 projects initialized
- [ ] Permission check works
- [ ] OAuth flow works
- [ ] Container lifecycle works
- [ ] State persists across restarts

---

## 🗂️ FINAL FILE STRUCTURE

```
packages/app-collab/src/
├── state/
│   ├── GatewayState.ts              🆕 Generic storage (load/save/dirty)
│   ├── ProjectRooms.ts              🆕 Multi-room YJS manager
│   ├── types.ts                     🆕 Data structure types
│   └── index.ts                     🆕 Export singletons
├── permissions/
│   ├── PermissionManager.ts         🆕 Permission logic (uses GatewayState)
│   ├── types.ts                     🆕 Permission types
│   └── index.ts                     🆕 Export permissionManager
├── oauth/
│   ├── OAuthManager.ts              🆕 OAuth data mgmt (uses GatewayState)
│   ├── model.ts                     🆕 OAuth2Server model (uses OAuthManager)
│   ├── server.ts                    🆕 OAuth2Server instance
│   └── index.ts                     🆕 Export oauth2Server
├── containers/
│   ├── ContainerTokenManager.ts     🆕 Token mgmt (uses GatewayState)
│   └── index.ts                     🆕 Export containerTokenManager
├── routes/
│   ├── collab.ts                    🔄 Update for org
│   ├── oauth.ts                     🆕 OAuth endpoints
│   └── containers.ts                🆕 Container endpoints (optional)
├── middleware/
│   ├── route-handler.ts             ✅ asyncHandler
│   └── permissions.ts               🆕 Permission middleware
└── main.ts                          🔄 Org initialization

packages/json-file-persistence/src/
├── index.ts                         🔄 Generic save/load
└── ProjectPersistence.ts            🆕 Per-project YJS persistence
```

---

## 📝 REVISED CHECKLIST (8 PHASES, ~80 TASKS)

### ✅ PREREQUISITES (DONE)

- [x] Database refactored (organizations)
- [x] Apps converted to TypeScript Express
- [x] Backend-engine stripped
- [x] app-account deleted

### 🏗️ PHASE 1: GatewayState (Generic Storage) - 12 tasks

- [ ] 1.1 Create `state/types.ts`

  - [ ] Define `TGatewayStateData` (just data structure)
  - [ ] No methods, no logic - pure data types

- [ ] 1.2 Create `state/GatewayState.ts`

  - [ ] Constructor(org_id?, gateway_id?)
  - [ ] `initialize(org_id, gateway_id)` - Set IDs
  - [ ] `getData(): Readonly<TGatewayStateData>` - Get state
  - [ ] `updateData(updater: (data) => void)` - Update + markDirty
  - [ ] `load()` - Read from `/data/gateway-state-{org_id}.json`
  - [ ] `save()` - Atomic write (tmp + rename)
  - [ ] `markDirty()` - Set flag
  - [ ] `startAutoSave()` - setInterval(30s)
  - [ ] Shutdown handlers

- [ ] 1.3 Create `state/index.ts`

  - [ ] Export singleton `gatewayState`

- [ ] 1.4 Test GatewayState
  - [ ] Save/load cycle
  - [ ] Auto-save triggers
  - [ ] Atomic writes
  - [ ] Shutdown saves

---

### 🔐 PHASE 2: PermissionManager (Simple) - 10 tasks

- [ ] 2.1 Create `permissions/PermissionManager.ts`

  - [ ] Constructor(gatewayState)
  - [ ] `hasPermission(user_id, permission)` - Exact string match
  - [ ] `addPermission(user_id, permission)` - Uses updateData()
  - [ ] `removePermission(user_id, permission)` - Uses updateData()
  - [ ] `getPermissions(user_id)` - Returns string[]
  - [ ] `setPermissions(user_id, permissions)` - Replaces all
  - [ ] `initializeFromConfig(org_config)` - Setup initial perms

- [ ] 2.2 Create `middleware/permissions.ts`

  - [ ] `requirePermission(permission)` - Simple check
  - [ ] `requirePermissionTemplate(template)` - Replace ${params.x}

- [ ] 2.3 Create `permissions/index.ts`

  - [ ] Export singleton `permissionManager`

- [ ] 2.4 Test PermissionManager
  - [ ] Add/remove/check permissions
  - [ ] Middleware blocks/allows correctly
  - [ ] Initialize from config works

**Note:** Hierarchy can be added later in `hasPermission()` without changing interface

---

### 🏘️ PHASE 3: Multi-Project Rooms - 11 tasks

- [ ] 3.1 Create `state/ProjectRooms.ts`

  - [ ] `ProjectRoomsManager` class
  - [ ] `initializeProject(project_id)` - Create room + YJS doc
  - [ ] `getRoom(project_id)` - Return { room_id, ydoc, persistence }
  - [ ] `getAllRooms()` - For WebSocket
  - [ ] `saveAll()` - Save all projects
  - [ ] `startAutoSave()` - Every 2min

- [ ] 3.2 Create `json-file-persistence/src/ProjectPersistence.ts`

  - [ ] Constructor(project_id)
  - [ ] `load(ydoc)` - From `/data/project-{id}/latest`
  - [ ] `save(ydoc)` - To `/data/project-{id}/{timestamp}.json`
  - [ ] `cleanupOld()` - Keep last N files

- [ ] 3.3 Update `websocket.ts`

  - [ ] Accept ProjectRoomsManager
  - [ ] Route by project_id (query param)
  - [ ] Subscribe to correct YJS doc

- [ ] 3.4 Update `main.ts`

  - [ ] Create ProjectRoomsManager
  - [ ] Initialize all projects
  - [ ] Start auto-save

- [ ] 3.5 Test Multi-Room
  - [ ] 3 projects = 3 rooms = 3 file dirs

---

### 🔑 PHASE 4: OAuthManager - 15 tasks

- [ ] 4.1 Add `@node-oauth/oauth2-server` dependency

- [ ] 4.2 Create `oauth/OAuthManager.ts`

  - [ ] Client methods (add/get/delete)
  - [ ] Code methods (save/get/delete)
  - [ ] Token methods (save/get/delete)
  - [ ] `cleanupExpired()` - Delete old codes/tokens
  - [ ] All use `gatewayState.updateData()`

- [ ] 4.3 Create `oauth/model.ts`

  - [ ] Implement OAuth2Server model interface
  - [ ] All methods delegate to oauthManager

- [ ] 4.4 Create `oauth/server.ts`

  - [ ] Initialize OAuth2Server
  - [ ] Export singleton

- [ ] 4.5 Create `routes/oauth.ts`

  - [ ] `/oauth/authorize` (GET, POST)
  - [ ] `/oauth/token` (POST)
  - [ ] `/oauth/public-key` (GET)

- [ ] 4.6 Update `main.ts`

  - [ ] Setup OAuth routes

- [ ] 4.7 Update `oas30.json`

  - [ ] Add OAuth schemas

- [ ] 4.8 Test OAuth
  - [ ] Full authorization flow
  - [ ] Token generation
  - [ ] Scope validation with permissions

---

### 📦 PHASE 5: ContainerTokenManager - 8 tasks

- [ ] 5.1 Create `containers/ContainerTokenManager.ts`

  - [ ] `generateToken()` - HMAC + save
  - [ ] `validateToken()` - Verify + lookup
  - [ ] `deleteToken()` - Remove from state

- [ ] 5.2 Create `containers/index.ts`

  - [ ] Export singleton `containerTokenManager`

- [ ] 5.3 Update `modules/user-containers` reducer

  - [ ] Use containerTokenManager for tokens
  - [ ] Use oauthManager for OAuth clients
  - [ ] Use permissionManager for checks

- [ ] 5.4 Test Container Tokens
  - [ ] Generate, validate, delete
  - [ ] Integration with reducer

---

### 🎨 PHASE 6: Wire Everything Together - 12 tasks

- [ ] 6.1 Update `main.ts` initialization

  - [ ] Create all manager instances
  - [ ] Initialize in correct order
  - [ ] Export to routes/modules

- [ ] 6.2 Update `routes/collab.ts`

  - [ ] Use permissionManager for checks
  - [ ] Update `/collab/start` for org config

- [ ] 6.3 Pass managers to modules

  - [ ] Update module context to include managers
  - [ ] Gateway module gets managers
  - [ ] User-containers gets managers

- [ ] 6.4 Add permission checks to routes

  - [ ] `/collab/event` - Check based on event
  - [ ] `/collab/vpn-config` - Require org membership

- [ ] 6.5 Test full integration
  - [ ] All managers working together
  - [ ] Permissions enforced
  - [ ] OAuth works
  - [ ] Containers work

---

### 🧹 PHASE 7: Cleanup - 10 tasks

- [ ] 7.1 Delete `app-ganymede-cmds`
- [ ] 7.2 Clean `app-ganymede/src/models/oauth.ts`
- [ ] 7.3 Update `modules/gateway` - Remove exception imports
- [ ] 7.4 Update OpenAPI specs
- [ ] 7.5 Delete old exec-pipes.json from app-collab (if exists)
- [ ] 7.6 Test all builds
- [ ] 7.7 Test end-to-end flows
- [ ] 7.8 Update documentation
- [ ] 7.9 Final file sweep
- [ ] 7.10 Verify no broken imports

---

## 📊 COMPLEXITY (REVISED)

| Phase                | Tasks | Complexity | Time |
| -------------------- | ----- | ---------- | ---- |
| 1. GatewayState      | 12    | Medium     | 2-3h |
| 2. PermissionManager | 10    | Low-Medium | 2-3h |
| 3. Multi-Rooms       | 11    | Medium     | 2-3h |
| 4. OAuthManager      | 15    | High       | 4-5h |
| 5. ContainerTokens   | 8     | Low-Medium | 2h   |
| 6. Integration       | 12    | Medium     | 2-3h |
| 7. Cleanup           | 10    | Low        | 2h   |

**Total: ~78 tasks, 16-21 hours**

---

## 🎯 IMPLEMENTATION ORDER

1. **GatewayState** - Generic storage foundation
2. **PermissionManager** - Simple string matching
3. **Multi-Project Rooms** - Separate YJS per project
4. **ContainerTokenManager** - Simple token management
5. **OAuthManager** - Complex OAuth logic
6. **Integration** - Wire everything together
7. **Cleanup** - Polish and test

---

## 🚀 READY TO START

The plan is now:

- ✅ GatewayState is generic (separation of concerns)
- ✅ Specialized managers for each domain
- ✅ Simple permissions (exact match, no hierarchy yet)
- ✅ Multi-project support
- ✅ Clear dependencies

**Shall I proceed with Phase 1: GatewayState (Generic Storage)?**
