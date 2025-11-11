# Gateway Implementation Guide

**Complete reference for implementing all gateway features. DO NOT CREATE SEPARATE IMPLEMENTATION FILES.**

---

## TABLE OF CONTENTS

1. [OAuth2 Server](#oauth2-server)
2. [Permission System](#permission-system)
3. [Container Management](#container-management)
4. [Gateway Initialization](#gateway-initialization)
5. [Non-Shared State Structure](#non-shared-state-structure)

---

# OAUTH2 SERVER

OAuth2 authorization server for container apps (JupyterLab, pgAdmin, n8n).

**Source:** `app-account/src/models/oauth.ts` (will be deleted)

## OAuth2 Model Interface

```typescript
interface OAuth2Model {
  getClient(clientId, clientSecret): Promise<Client | false>;
  generateAuthorizationCode(client, user, scope): Promise<string>;
  saveAuthorizationCode(code, client, user): Promise<AuthorizationCode | false>;
  getAuthorizationCode(code): Promise<AuthorizationCode | false>;
  revokeAuthorizationCode(code): Promise<boolean>;
  generateAccessToken(client, user, scope): Promise<string>;
  generateRefreshToken(client, user, scope): Promise<string>;
  saveToken(token, client, user): Promise<Token | false>;
  getRefreshToken(refreshToken): Promise<RefreshToken | false>;
  revokeToken(token): Promise<boolean>;
  validateScope(user, client, scope): Promise<string[]>;
}
```

## OAuth Implementation Details

### getClient(clientId, clientSecret)

```typescript
function getClient(clientId: string, clientSecret: string): Client | false {
  const clientData = gatewayState.oauth_clients[clientId];
  if (!clientData) return false;

  // NOTE: Don't validate client_secret (OAuth flows from frontend)

  const container = sharedState['user-containers:containers'].get(
    clientData.container_id
  );
  if (!container) return false;

  const gateway_hostname = CONFIG.GATEWAY_HOSTNAME;
  const redirectUris = clientData.redirect_uris.map((uri) =>
    uri.replace(
      'DYNREDIR',
      `https://${gateway_hostname}/${container.container_id}/${clientData.service_name}`
    )
  );

  return {
    id: clientData.client_id,
    grants: clientData.grants,
    redirectUris: [CONFIG.APP_FRONTEND_URL, ...redirectUris],
    accessTokenLifetime: 3600,
    refreshTokenLifetime: 604800,
  };
}
```

### generateAuthorizationCode()

```typescript
function generateAuthorizationCode(): string {
  return `code_${makeUuid()}`;
}
```

### saveAuthorizationCode(code, client, user)

```typescript
function saveAuthorizationCode(code, client, user): AuthorizationCode {
  gatewayState.oauth_authorization_codes[code.authorizationCode] = {
    code: code.authorizationCode,
    client_id: client.id,
    user_id: user.id,
    scope: code.scope,
    redirect_uri: code.redirectUri,
    expires_at: code.expiresAt.toISOString(),
    created_at: new Date().toISOString(),
  };
  gatewayState.markDirty();
  return { ...code, client, user };
}
```

### saveToken(token, client, user)

```typescript
function saveToken(token, client, user): Token {
  const tokenId = makeUuid();
  gatewayState.oauth_tokens[tokenId] = {
    token_id: tokenId,
    client_id: client.id,
    user_id: user.id,
    scope: token.scope,
    access_token: token.accessToken,
    access_token_expires_at: token.accessTokenExpiresAt.toISOString(),
    refresh_token: token.refreshToken,
    refresh_token_expires_at: token.refreshTokenExpiresAt.toISOString(),
  };
  gatewayState.markDirty();
  return { ...token, client, user };
}
```

### validateScope(user, client, scope)

```typescript
function validateScope(user, client, scope): string[] {
  if (user.validated_scope) return user.validated_scope;

  const userPerms = gatewayState.permissions[user.id];
  const clientData = gatewayState.oauth_clients[client.id];
  const container = sharedState['user-containers:containers'].get(
    clientData.container_id
  );

  // Check if user can access this container
  if (
    checkPermission(
      user.id,
      { type: 'container', id: container.container_id },
      'access'
    )
  ) {
    return [`container:${container.container_id}:access`];
  }

  return [];
}
```

## OAuth Routes

### GET/POST /oauth/authorize

```typescript
router.post('/oauth/authorize', async (req, res, next) => {
  if (!req.query.scope) req.query.scope = 'none';

  if (!isAuthenticated(req)) {
    return res.redirect(
      `${GANYMEDE_URL}/login?redirect=${req.path}&client_id=${req.query.client_id}`
    );
  }

  const request = new OAuth2Server.Request(req);
  const response = new OAuth2Server.Response(res);
  const code = await server.authorize(request, response);

  res.redirect(
    `${code.redirectUri}?code=${code.authorizationCode}&state=${req.query.state}`
  );
});
```

### POST /oauth/token

```typescript
router.post('/oauth/token', async (req, res, next) => {
  const request = new OAuth2Server.Request(req);
  const response = new OAuth2Server.Response(res);
  await server.token(request, response);
  res.json(response.body);
});
```

---

# PERMISSION SYSTEM

Hierarchical permission checking for all gateway operations.

**Source:** `app-account/src/models/oauth.ts` § validateScope, deleted procedures

## Permission Structure

```typescript
interface TPermissions {
  [user_id: string]: {
    organization: string[]; // ['org:owner', 'org:admin', 'org:member']
    projects: {
      [project_id: string]: string[]; // ['project:admin', 'container:create', ...]
    };
    containers: {
      [container_id: string]: string[]; // ['container:access', 'container:delete']
    };
  };
}
```

## Permission Hierarchy

```
org:owner → ALL permissions
  ↓
org:admin → project:*, container:*
  ↓
project:admin → container:* in this project
  ↓
project:member → container:access in this project
  ↓
container:access → Access specific container only
```

## Core Permission Function

```typescript
function checkPermission(
  user_id: string,
  resource: { type: 'organization' | 'project' | 'container'; id?: string },
  action: string
): boolean {
  const perms = gatewayState.permissions[user_id];
  if (!perms) return false;

  // Org owners have all permissions
  if (perms.organization.includes('org:owner')) return true;

  // Check by resource type
  if (resource.type === 'organization') {
    return perms.organization.includes(`org:${action}`);
  }

  if (resource.type === 'project' && resource.id) {
    if (
      perms.organization.includes('org:admin') &&
      ['admin', 'delete'].includes(action)
    ) {
      return true;
    }
    return (perms.projects[resource.id] || []).includes(`project:${action}`);
  }

  if (resource.type === 'container' && resource.id) {
    if (perms.organization.includes('org:admin')) return true;

    const container = sharedState['user-containers:containers'].get(
      resource.id
    );
    if (container) {
      const projectPerms = perms.projects[container.project_id] || [];
      if (projectPerms.includes(`container:${action}`)) return true;
    }

    return (perms.containers[resource.id] || []).includes(
      `container:${action}`
    );
  }

  return false;
}
```

## Permission Middleware

```typescript
export const requireOrgPermission = (action: string) => (req, res, next) => {
  if (!checkPermission(req.user.id, { type: 'organization' }, action)) {
    return res.status(403).json({ error: `Need org:${action}` });
  }
  next();
};

export const requireProjectPermission =
  (action: string) => (req, res, next) => {
    const project_id = req.params.project_id || req.body.project_id;
    if (
      !checkPermission(req.user.id, { type: 'project', id: project_id }, action)
    ) {
      return res.status(403).json({ error: `Need project:${action}` });
    }
    next();
  };
```

## Permission Initialization

```typescript
async function initializePermissions(config: TGatewayConfig) {
  // Initialize from org members
  for (const member of config.members) {
    gatewayState.permissions[member.user_id] = {
      organization: [roleToPermission(member.role)],
      projects: {},
      containers: {},
    };
  }

  // Load project memberships from ganymede
  for (const project_id of config.projects) {
    const members = await callGanymede(
      'GET',
      `/projects/${project_id}/members`
    );
    for (const member of members) {
      if (!gatewayState.permissions[member.user_id]) {
        gatewayState.permissions[member.user_id] = {
          organization: ['org:member'],
          projects: {},
          containers: {},
        };
      }
      gatewayState.permissions[member.user_id].projects[project_id] = [
        'project:read',
        'container:access',
        'container:create',
      ];
    }
  }
}
```

---

# CONTAINER MANAGEMENT

Container lifecycle: create, host, monitor, delete.

**Source:** `app-ganymede/src/commands/server-command.ts`, exec-pipes (will be deleted)

## Container Lifecycle

### 1. Create Container

```typescript
async function createContainer(event: TContainerCreateEvent, user: User) {
  await checkPermission(
    user.id,
    { type: 'project', id: event.project_id },
    'container:create'
  );

  const container_id = makeUuid();
  const container = {
    container_id,
    organization_id: getOrganizationId(),
    project_id: event.project_id,
    name: event.name,
    image: event.image,
    location: 'none',
    created_at: new Date().toISOString(),
    created_by_user_id: user.id,
    host_user_id: null,
    ip: null,
    services: [],
    last_watchdog_at: null,
    system: null,
  };

  sharedState['user-containers:containers'].set(container_id, container);

  // Create OAuth clients if image defines them
  const imageOptions = getImageOptions(event.image);
  if (imageOptions.oauthClients) {
    for (const oauthClient of imageOptions.oauthClients) {
      const client_id = `${container_id}-${oauthClient.serviceName}`;
      gatewayState.oauth_clients[client_id] = {
        client_id,
        client_secret: makeUuid(),
        container_id,
        service_name: oauthClient.serviceName,
        redirect_uris: oauthClient.redirect_uris || [],
        grants: ['authorization_code', 'refresh_token'],
      };
    }
    gatewayState.markDirty();
  }
}
```

### 2. Host Container (Generate Docker Command)

```typescript
async function getDockerCommand(container_id: string, user: User): string {
  await checkPermission(
    user.id,
    { type: 'container', id: container_id },
    'manage'
  );

  const container = sharedState['user-containers:containers'].get(container_id);
  if (container.host_user_id !== user.id)
    throw new ForbiddenException('Not your container');

  // Generate HMAC token
  const hmacToken = makeHmacToken(
    {
      container_id,
      organization_id: container.organization_id,
      project_id: container.project_id,
    },
    CONFIG.HMAC_SECRET
  );

  gatewayState.container_tokens[container_id] = {
    token: hmacToken,
    created_at: new Date().toISOString(),
  };

  // Build OAuth clients
  const oauth_clients = {};
  for (const [client_id, client] of Object.entries(
    gatewayState.oauth_clients
  )) {
    if (client.container_id === container_id) {
      oauth_clients[client.service_name] = {
        client_id: client.client_id,
        client_secret: client.client_secret,
      };
    }
  }

  // Build settings
  const settings = {
    container_id,
    organization_id: container.organization_id,
    project_id: container.project_id,
    gateway_hostname: CONFIG.GATEWAY_HOSTNAME,
    token: hmacToken,
    oauth_clients,
  };

  const settingsBase64 = Buffer.from(JSON.stringify(settings)).toString(
    'base64'
  );
  const containerName = `demiurge_${container.name}_${makeShortUuid()}`;

  return `docker run --restart unless-stopped --name ${containerName} -e SETTINGS=${settingsBase64} --cap-add=NET_ADMIN --device /dev/net/tun ${container.image.uri}:${container.image.tag}`;
}
```

### 3. Container Watchdog

```typescript
async function onContainerWatchdog(event: TWatchdogEvent, token: string) {
  const payload = verifyHmacToken(token, CONFIG.HMAC_SECRET);
  if (payload.container_id !== event.container_id)
    throw new ForbiddenException('Invalid token');

  const container = sharedState['user-containers:containers'].get(
    event.container_id
  );
  container.last_watchdog_at = new Date().toISOString();
  container.system = event.system;
  sharedState['user-containers:containers'].set(event.container_id, container);
}
```

### 4. Delete Container

```typescript
async function deleteContainer(event: TContainerDeleteEvent, user: User) {
  await checkPermission(
    user.id,
    { type: 'container', id: event.container_id },
    'delete'
  );

  sharedState['user-containers:containers'].delete(event.container_id);

  // Cleanup OAuth
  for (const [client_id, client] of Object.entries(
    gatewayState.oauth_clients
  )) {
    if (client.container_id === event.container_id) {
      delete gatewayState.oauth_clients[client_id];
    }
  }
  for (const [token_id, token] of Object.entries(gatewayState.oauth_tokens)) {
    const client = gatewayState.oauth_clients[token.client_id];
    if (client?.container_id === event.container_id) {
      delete gatewayState.oauth_tokens[token_id];
    }
  }
  delete gatewayState.container_tokens[event.container_id];
  gatewayState.markDirty();
}
```

## VPN IP Allocation

```typescript
function allocateVpnIp(container_id: string): string {
  const usedIps = new Set(['172.16.0.1']); // Gateway
  for (const [id, container] of sharedState['user-containers:containers']) {
    if (container.ip) usedIps.add(container.ip);
  }

  for (let i = 2; i < 65534; i++) {
    const ip = `172.16.${Math.floor(i / 256)}.${i % 256}`;
    if (!usedIps.has(ip)) return ip;
  }

  throw new Error('No VPN IPs available');
}
```

## Image Definitions (Module-Based)

```typescript
// packages/modules/jupyter/src/index.ts
export const containerImages = [
  {
    imageId: 'jupyter:minimal',
    imageName: 'jupyterlab minimal notebook',
    imageUri: 'public.ecr.aws/f3g9x7j4/demiurge-jmn',
    imageTag: 'lab-4.2.0',
    options: {
      ports: [8888],
      oauthClients: [
        {
          serviceName: 'jupyterlab',
          accessTokenLifetime: 31536000,
          redirect_uris: ['{container_id}/jupyterlab/oauth_callback'],
        },
      ],
    },
  },
];
```

---

# PERMISSION SYSTEM

## Default Permissions

```typescript
const ROLE_PERMISSIONS = {
  owner: ['org:owner'], // Implies ALL
  admin: ['org:admin'], // Implies project/container management
  member: ['org:member'], // Basic access only
};

const PROJECT_MEMBER_DEFAULT = [
  'project:read',
  'container:access',
  'container:create',
];
```

## Permission Checking with Inheritance

```typescript
function checkPermission(user_id, resource, action): boolean {
  const perms = gatewayState.permissions[user_id];
  if (!perms) return false;

  // Org owner → ALL
  if (perms.organization.includes('org:owner')) return true;

  // Org admin → Projects and containers
  if (perms.organization.includes('org:admin')) {
    if (resource.type === 'project' && ['admin', 'delete'].includes(action))
      return true;
    if (resource.type === 'container') return true;
  }

  // Project-level check
  if (resource.type === 'project' && resource.id) {
    return (perms.projects[resource.id] || []).includes(`project:${action}`);
  }

  // Container-level check (with project inheritance)
  if (resource.type === 'container' && resource.id) {
    const containerPerms = perms.containers[resource.id] || [];
    if (containerPerms.includes(`container:${action}`)) return true;

    const container = sharedState['user-containers:containers'].get(
      resource.id
    );
    if (container) {
      const projectPerms = perms.projects[container.project_id] || [];
      if (projectPerms.includes(`container:${action}`)) return true;
      if (projectPerms.includes('project:admin')) return true;
    }
  }

  return false;
}
```

## Permission Sync API (Called by Ganymede)

```typescript
// POST /permissions/sync-member
router.post('/permissions/sync-member', requireGatewayToken, (req, res) => {
  const { user_id, role } = req.body;
  gatewayState.permissions[user_id] = {
    organization: [roleToPermission(role)],
    projects: {},
    containers: {},
  };
  gatewayState.markDirty();
  res.json({ success: true });
});
```

---

# CONTAINER MANAGEMENT

## Container Shared State Structure

```typescript
{
  'user-containers:containers': Map<container_id, {
    container_id: string,
    organization_id: string,
    project_id: string,
    name: string,
    image: { name, uri, tag, sha256 },
    location: 'none' | 'hosted' | 'aws',
    created_at: string,
    created_by_user_id: string,

    // Runtime (when running)
    host_user_id?: string,
    ip?: string,
    services: Array<{ name, port, location }>,
    last_watchdog_at?: string,
    system?: { cpu_percent, memory_percent, disk_percent }
  }>
}
```

## Container Routes

```typescript
// POST /containers - Create
router.post(
  '/containers',
  authenticateJwt,
  requireProjectPermission('container:create'),
  async (req, res) => {
    const result = await eventProcessor.process(
      {
        type: 'container:create',
        project_id: req.body.project_id,
        name: req.body.name,
        image: req.body.image,
        user_id: req.user.id,
      },
      req.user
    );
    res.json(result);
  }
);

// POST /containers/:id/host - Mark for local hosting
router.post(
  '/containers/:container_id/host',
  authenticateJwt,
  requireContainerPermission('manage'),
  async (req, res) => {
    await eventProcessor.process(
      {
        type: 'container:host',
        container_id: req.params.container_id,
        user_id: req.user.id,
      },
      req.user
    );
    res.json({ success: true });
  }
);

// GET /containers/:id/cmd - Get docker command
router.get(
  '/containers/:container_id/cmd',
  authenticateJwt,
  requireContainerPermission('manage'),
  async (req, res) => {
    const command = await getDockerCommand(req.params.container_id, req.user);
    res.json({ command });
  }
);

// DELETE /containers/:id - Delete
router.delete(
  '/containers/:container_id',
  authenticateJwt,
  requireContainerPermission('delete'),
  async (req, res) => {
    await eventProcessor.process(
      {
        type: 'container:delete',
        container_id: req.params.container_id,
        user_id: req.user.id,
      },
      req.user
    );
    res.json({ success: true });
  }
);
```

## Nginx Proxy Update

```typescript
async function updateNginxConfig() {
  const locations = [];
  for (const [id, container] of sharedState['user-containers:containers']) {
    if (!container.ip) continue;
    for (const service of container.services) {
      locations.push(`${service.location} ${container.ip} ${service.port}`);
    }
  }
  fs.writeFileSync('/tmp/nginx-locations.txt', locations.join('\n'));
  execSync('/scripts/update-nginx-locations.sh');
}
```

---

# GATEWAY INITIALIZATION

## Startup Sequence

```typescript
async function main() {
  const eventProcessor = new BackendEventProcessor();
  const servers = await startEventsReducerServer(eventProcessor, bindings);

  if (CONFIG.ORGANIZATION_ID) {
    // Restart with existing org
    const config = await loadOrgConfigFromDisk(CONFIG.ORGANIZATION_ID);
    await startOrganizationGateway(config);
  } else {
    // New gateway, register as ready
    await registerGatewayAsReady();
  }
}
```

## Handshake Endpoint

```typescript
// POST /collab/start
router.post('/collab/start', async (req, res) => {
  const { tmp_handshake_token } = req.body;

  // Call ganymede to get org config
  const config = await fetch(`${GANYMEDE_URL}/gateway/config`, {
    method: 'POST',
    headers: { Authorization: CONFIG.GATEWAY_TOKEN },
    body: JSON.stringify({ tmp_handshake_token }),
  }).then((r) => r.json());

  await startOrganizationGateway(config);
  res.json({ success: true });
});
```

## Start Organization Gateway

```typescript
async function startOrganizationGateway(config: TGatewayConfig) {
  setGatewayConfig(config);

  // Load states from disk
  await loadYjsState(config.organization_id);
  await loadNonSharedState(config.organization_id);

  // Initialize permissions
  await initializePermissions(config);

  // Initialize modules
  await initializeModules(eventProcessor, config);

  // Start WebSocket
  const roomId = makeUuid();
  graftYjsWebsocket(servers, roomId);

  // Signal ready
  await callGanymede('POST', '/gateway/ready', {
    gateway_id: CONFIG.GATEWAY_ID,
  });
}
```

## State Persistence

```typescript
class GatewayState {
  startAutoSave() {
    setInterval(() => {
      this.saveYjsState();
      if (this.dirty) this.saveNonSharedState();
    }, 30000);
  }

  saveYjsState() {
    const stateBuffer = Y.encodeStateAsUpdate(yjsDoc);
    atomicWrite(`/data/yjs-state-${this.organization_id}.bin`, stateBuffer);
  }

  saveNonSharedState() {
    const data = {
      organization_id: this.organization_id,
      permissions: this.permissions,
      oauth_clients: this.oauth_clients,
      oauth_tokens: this.oauth_tokens,
      oauth_authorization_codes: this.oauth_authorization_codes,
      container_tokens: this.container_tokens,
      saved_at: new Date().toISOString(),
    };
    atomicWrite(
      `/data/gateway-state-${this.organization_id}.json`,
      JSON.stringify(data, null, 2)
    );
    this.dirty = false;
  }
}

function atomicWrite(filepath: string, data: Buffer | string) {
  const tmp = `${filepath}.tmp`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, filepath);
}
```

## Shutdown

```typescript
async function shutdown() {
  await Promise.all(servers.map((s) => new Promise((r) => s.close(r))));
  gatewayState.saveYjsState();
  gatewayState.saveNonSharedState();
  await callGanymede('POST', '/gateway/stop', {
    gateway_id: CONFIG.GATEWAY_ID,
  });
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
```

---

# NON-SHARED STATE STRUCTURE

Complete structure for `/data/gateway-state-{org_id}.json`:

```typescript
interface TGatewayNonSharedState {
  organization_id: string;

  permissions: {
    [user_id: string]: {
      organization: string[];
      projects: { [project_id: string]: string[] };
      containers: { [container_id: string]: string[] };
    };
  };

  oauth_clients: {
    [client_id: string]: {
      client_id: string;
      client_secret: string;
      container_id: string;
      service_name: string;
      redirect_uris: string[];
      grants: string[];
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

  container_tokens: {
    [container_id: string]: {
      token: string; // HMAC
      created_at: string;
    };
  };

  saved_at: string;
}
```

---

# QUICK REFERENCE

## Check Permission

```typescript
checkPermission(user_id, { type: 'container', id: container_id }, 'delete');
```

## Validate OAuth Scope

```typescript
validateScope(user, client, ['container:123:access']);
```

## Generate Docker Command

```typescript
const cmd = await getDockerCommand(container_id, user);
```

## Update Permissions

```typescript
gatewayState.permissions[user_id].projects[project_id] = [
  'project:read',
  'container:access',
];
gatewayState.markDirty();
```

## Save State

```typescript
gatewayState.saveNonSharedState(); // Manual save
// Or wait for auto-save (every 30s)
```

---

# IMPLEMENTATION ORDER

1. Create `GatewayState` class (non-shared state management)
2. Implement permission checking functions
3. Implement OAuth2Model class
4. Implement container lifecycle events
5. Wire everything together
6. Test end-to-end

---

**All implementation details are in this single file. Reference sections as needed.**
