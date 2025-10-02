# Container Management Feature - Current Implementation

## Overview

The application provides a Docker container management system where users can define, start, and access containerized applications. Containers can run either locally on users' computers or on AWS EC2 instances. Container web interfaces are exposed via public URLs through a gateway reverse-proxy system.

## Architecture Components

### 1. Module System

**Location**: `packages/modules/module/src/index.ts`

Modules are the core building blocks of the application, each defining:

- **collabChunk**: Contains shared data models, reducers (event processors), and extraContext (shared utilities)
- **deps**: Dependencies on other modules (determines load order)

**Module Definition**:

```typescript
export type ModuleBackend = {
  collabChunk: TCollaborativeChunk;
};
```

**Current Modules** (`packages/app-collab/src/modules.ts`):

- `gateway` - Gateway management, VPN, nginx proxy control
- `core` - Core graph/node system
- `space` - Whiteboard/space management
- `chats` - Chat functionality
- `servers` - **Container management** (should be renamed to `containers`)
- `jupyter` - JupyterLab integration
- `tabs` - Tab management
- `notion`, `airtable`, `socials`, `excalidraw` - Various integrations

### 2. Database Schema

**Location**: `database/schema/02-schema.sql`

#### Images Table

Stores Docker image definitions:

```sql
CREATE TABLE public.images (
    image_id serial NOT NULL PRIMARY KEY,
    image_name character varying(256) NOT NULL,
    image_uri character varying(256) NOT NULL,
    image_tag character varying(256) NOT NULL,
    image_sha256 character(64),
    user_available boolean NOT NULL DEFAULT true,
    options json NOT NULL,
    CONSTRAINT uniq_name_tag UNIQUE (image_name, image_tag)
);
```

**options JSON structure**:

```json
{
  "ports": [8888],
  "oauthClients": [
    {
      "serviceName": "jupyterlab",
      "accessTokenLifetime": 31536000,
      "redirect_uris": ["DYNREDIR/oauth_callback"]
    }
  ]
}
```

**Current Images** (`database/schema/03-data.sql`):

- ID 2: jupyterlab minimal notebook
- ID 3: jupyterlab pytorch notebook
- ID 4: pgadmin4
- ID 5: ubuntu
- ID 6: n8n

**Problem**: Images are hardcoded in SQL and must be manually inserted.

#### Projects Servers Table (WILL BE REMOVED)

**Current State**: Data stored in database
**Future State**: Will be stored in module shared state (in-memory, synced via Yjs)

```sql
CREATE TABLE public.projects_servers (
    project_server_id serial NOT NULL PRIMARY KEY,
    project_id uuid NOT NULL,
    name character varying(50) NOT NULL,
    settings json NOT NULL,
    image_id integer NOT NULL,
    host_user_id uuid,  -- Set when user hosts locally
    ec2_instance_id character varying(128),  -- Set when on AWS (NOT USED ANYMORE)
    CONSTRAINT projects_servers_unique_name UNIQUE (project_id, name),
    CONSTRAINT projects_servers_host_user_or_ec2_instance
        CHECK (NOT (host_user_id IS NOT NULL AND ec2_instance_id IS NOT NULL))
);
```

**Note**: This table will be deleted. Container data will live in shared state only.

#### Images Table (WILL BE REMOVED)

**Current State**: Images defined in database
**Future State**: Images defined in module code

The `images` table will be completely removed. All image definitions will come from modules.

#### Unused Tables (WILL BE REMOVED)

The following tables are not used and will be deleted:

```sql
-- Unused features
DROP TABLE IF EXISTS public.mounts CASCADE;
DROP TABLE IF EXISTS public.volumes CASCADE;
DROP TABLE IF EXISTS public.organizations_members CASCADE;
DROP TABLE IF EXISTS public.groups_members CASCADE;
DROP TABLE IF EXISTS public.groups CASCADE;
DROP TABLE IF EXISTS public.organizations CASCADE;
DROP TABLE IF EXISTS public.images CASCADE;
DROP TABLE IF EXISTS public.projects_servers CASCADE;
```

**Tables to Delete**:

- `organizations` - Organization management not implemented
- `organizations_members` - Not used
- `groups` - Group management not implemented
- `groups_members` - Not used
- `images` - Will be replaced by module definitions
- `projects_servers` - Will be moved to shared state
- `volumes` - Volume feature not used
- `mounts` - Depends on projects_servers and volumes

#### Gateways Tables

```sql
CREATE TABLE public.gateways (
    gateway_id uuid NOT NULL PRIMARY KEY,
    hostname character varying(256) NOT NULL,
    version character varying(15) NOT NULL,
    ready boolean NOT NULL
);

CREATE TABLE public.projects_gateways (
    project_id uuid NOT NULL,
    gateway_id uuid NOT NULL,
    tmp_handshake_token uuid NOT NULL,
    started timestamp without time zone NOT NULL,
    ended timestamp without time zone
);
```

**Gateway Assignment**: One gateway per project, assigned on-demand when project starts.

### 3. Gateway System

**Gateway Container**: `docker-images/backend-images/gateway/`

Each gateway is a Docker container running:

- **app-collab** (TypeScript/Node.js collaborative backend)
- **OpenVPN server** (for container-to-gateway VPN)
- **Nginx reverse proxy** (routes HTTP requests to containers)

**Gateway Hostname Format**: `gw-{instance_id}-{gw_id}.{env}.{domain}`

- Example: `gw-1-2.dev-001.demiurge.co`

**Gateway Allocation** (`database/procedures/proc_projects_start.sql`):

1. Find available gateway (not assigned to active project, ready=TRUE)
2. Create entry in `projects_gateways` with `tmp_handshake_token`
3. Set gateway ready=FALSE
4. Return gateway hostname to client
5. Client calls `/collab/start` on gateway with handshake token

**Problem**: When project changes gateway (after inactivity), container URLs change because they include gateway hostname.

### 4. Container Lifecycle

#### 4.1 Container Creation

**Frontend**: `packages/modules/servers/src/lib/form/new-server.tsx`

- User fills form with server name
- Selects image from list (fetched from `/images` API endpoint)
- Creates `servers:new` event

**API**: `POST /projects/{project_id}/servers`

- **Handler**: `packages/app-ganymede/src/exec-pipes.json` → `new-project-server`
- **Procedure**: `database/procedures/proc_projects_servers_new.sql`
  1. Validates image_id exists and is user_available
  2. Inserts into projects_servers
  3. Creates OAuth clients based on image options
  4. Returns new_project_server_id

**Reducer**: `packages/modules/servers/src/lib/servers-reducer.ts` → `_newServer()`

1. Calls API to create server
2. Fetches server data from Ganymede
3. Maps image_id to server type using hardcoded switch statement (lines 747-768)
4. Creates graph node in whiteboard
5. Stores in shared state `sd.projectServers`

**Problem**: Server type mapping is hardcoded in reducer based on image_id.

#### 4.2 Local Hosting

**UI**: Server card shows "HOST" button (`packages/modules/servers/src/lib/components/server-card.tsx`)

**Flow**:

1. User clicks "HOST" → triggers `servers:host` event
2. **API**: `POST /projects/{project_id}/server/{project_server_id}/host`
   - Sets `host_user_id` to current user
3. User clicks "COPY DOCKER CMD"
4. **API**: `GET /projects/{project_id}/server/{project_server_id}/cmd`
   - **Command Generator**: `packages/app-ganymede/src/commands/server-command.ts`
   - Creates JWT token for server (scoped to project_server_id)
   - Generates settings JSON with credentials, gateway info, oauth clients
   - Base64 encodes settings
   - Returns docker command:

```bash
docker run --restart unless-stopped \
  --name demiurge_{name}_{uuid} \
  -e SETTINGS={base64_encoded_settings} \
  --cap-add=NET_ADMIN \
  --device /dev/net/tun \
  {image_uri}:{image_tag}
```

5. User runs command locally
6. Container starts, runs startup script (`docker-images/user-images/demiurge-functions.sh`)

#### 4.3 Container Startup Sequence

**User Container Initialization** (`docker-images/user-images/demiurge-functions.sh`):

1. **Extract Settings**:

   - Decodes base64 SETTINGS env var
   - Extracts: HOST_USER_ID, GANYMEDE_FQDN, TOKEN, PROJECT_ID, PROJECT_SERVER_ID

2. **Get Gateway**:

   - Calls `GET https://{GANYMEDE_FQDN}/projects/{PROJECT_ID}`
   - Retrieves current `gateway_hostname`
   - Problem: This can change if project switches gateways!

3. **Start VPN**:

   - Calls `GET https://{gateway_hostname}/collab/vpn` with auth token
   - Receives OpenVPN certificates and config
   - Connects to gateway VPN (IP: 172.16.0.1)

4. **Configure Local Nginx**:

   - Creates nginx config for each service port
   - Listens on VPN IP (172.16.0.1) from gateway's perspective
   - Location format: `/{PROJECT_SERVER_ID}/{SERVICE_NAME}/`
   - Proxies to localhost:{PORT_TO}

5. **Watchdog Loop**:

   - Periodically sends `POST https://{gateway_hostname}/collab/event`
   - Event: `server:watchdog` with system info (CPU, RAM, disk, GPU)
   - Updates `last_watchdog_at`, `ip`, `system` in shared state

6. **Map HTTP Services**:
   - For each exposed port/service
   - Sends `server:map-http-service` event
   - Registers service with gateway reverse proxy

#### 4.4 Gateway Reverse Proxy

**HTTP Service Registration** (`packages/modules/servers/src/lib/servers-reducer.ts`):

`_serverMapHttpService()` (lines 529-572):

1. Validates JWT is for correct server
2. Adds service to server's httpServices array:

```typescript
{
  host: gateway_hostname,  // Public gateway hostname
  name: service_name,       // e.g., "jupyterlab"
  port: container_vpn_port,
  location: `${project_server_id}/${service_name}`,  // URL path prefix
  secure: true
}
```

3. Calls `_updateNginx()`

**Nginx Update** (`_updateNginx()` lines 576-590):

1. Collects all services from all servers with IPs (VPN connected)
2. Formats as: `{location} {ip} {port}\n`
3. Calls `updateReverseProxy()` from gateway extraContext

**Gateway Script** (`docker-images/backend-images/gateway/app/bin/update-nginx-locations.sh`):

- Removes all location blocks except `/collab`
- Adds location blocks for each service:

```nginx
location /{project_server_id}/{service_name} {
    proxy_pass http://{container_vpn_ip}:{port};
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection upgrade;
    # ... other headers
}
```

- Reloads nginx if config changed

**Service Timeout**: If server doesn't send watchdog for 30 seconds, httpServices cleared (lines 594-610)

#### 4.5 Cloud Hosting (DEPRECATED - NO LONGER USED)

**Note**: AWS EC2 hosting is being removed. Future implementation will support pluggable container runners (local Docker, Kubernetes, etc.) through a module interface.

**Previous Implementation** (for reference):

- Used AWS EC2 instances
- Managed via AWS SDK
- Instance state polling
- Start/stop/terminate operations

**Future Direction**:

- Abstract container runner interface
- Modules can implement custom runners
- Support for various backends (local, cloud, k8s)

### 5. URL Structure and DYNREDIR

#### Current URL Format

**Container Service URL**: `https://{gateway_hostname}/{project_server_id}/{service_name}/`

- Example: `https://gw-1-2.dev-001.demiurge.co/42/jupyterlab/`

**Problem**: Gateway hostname changes when project switches gateways!

#### DYNREDIR Mechanism

**Purpose**: Provide stable redirect URLs for OAuth callbacks

**Problem it solves**: Services like JupyterLab require OAuth redirect_uri to be configured at container startup. Since gateway hostname can change, we can't provide a stable redirect_uri pointing directly to gateway.

**Solution** (`packages/app-account/src/models/oauth.ts` lines 80-96):

When processing OAuth tokens, `redirect_uris` containing `DYNREDIR` are expanded to:

1. Direct gateway URL: `https://{current_gateway_hostname}/{project_server_id}/{service_name}/oauth_callback`
2. Stable Ganymede URL: `https://{ganymede_fqdn}/dynredir/{project_server_id}/{service_name}/oauth_callback`

**Ganymede Dynredir Endpoint** (`/dynredir/{project_server_id}/{service_name}/{request_path}`):

- Looks up current gateway for project
- Returns 302 redirect to current gateway hostname with same path
- Allows OAuth callbacks to work even after gateway change

**Limitation**: Only solves problem for OAuth, not for direct service access URLs.

### 6. Shared State and Collaboration

**Gateway App**: `packages/app-collab/` runs on each gateway

**Shared State Structure** (`packages/modules/servers/src/lib/servers-shared-model.ts`):

```typescript
export type TServersSharedData = {
  projectServers: Map<string, TServer>;  // Key: "{project_server_id}"
}

export type TServer = {
  project_server_id: number;
  project_id: uuid;
  server_name: string;
  image_id: number;
  location: 'none' | 'hosted' | 'aws';
  type: string;  // Derived from image_id

  // Published by container
  ip?: string;  // VPN IP
  httpServices: [...];
  last_watchdog_at: string | null;
  last_activity: string | null;
  system?: ServerSystemInfo;

  // From AWS API
  ec2_instance_state: TEc2InstanceState | null;
}
```

**Event Processing**:

- Frontend sends events to gateway
- Gateway's `BackendEventProcessor` routes to reducers
- Reducers update shared state (Yjs CRDT)
- Changes sync to all clients via WebSocket

### 7. Frontend Components

**Server Node** (`packages/modules/servers/src/lib/components/node-server/`):

- Whiteboard node representing container
- Shows server card with status, controls

**Server Card** (`packages/modules/servers/src/lib/components/server-card.tsx`):

- Status LED (online/offline based on watchdog)
- System info (CPU, RAM, disk, GPU)
- HTTP services list with open buttons
- Control buttons:
  - HOST / COPY DOCKER CMD (local)
  - CLOUD / START / STOP / DELETE (AWS)
- Delete button

**New Server Form** (`packages/modules/servers/src/lib/form/new-server.tsx`):

- Image selection dropdown
- Fetches images from `/images` API
- Displays: `{image_name}: {image_tag}`

### 8. Key File Locations

#### Backend (Gateway)

- Module definition: `packages/modules/servers/src/index.ts`
- Reducers: `packages/modules/servers/src/lib/servers-reducer.ts`
- Events: `packages/modules/servers/src/lib/servers-events.ts`
- Types: `packages/modules/servers/src/lib/servers-types.ts`
- Shared model: `packages/modules/servers/src/lib/servers-shared-model.ts`

#### Backend (Ganymede API)

- OpenAPI spec: `packages/app-ganymede/src/oas30.json`
- Exec pipes: `packages/app-ganymede/src/exec-pipes.json`
- Server command: `packages/app-ganymede/src/commands/server-command.ts`
- EC2 management: `packages/app-ganymede/src/commands/ec2-instance.ts`

#### Frontend

- Module definition: `packages/modules/servers/src/frontend.ts`
- Server node: `packages/modules/servers/src/lib/components/node-server/`
- Server card: `packages/modules/servers/src/lib/components/server-card.tsx`
- New server form: `packages/modules/servers/src/lib/form/new-server.tsx`
- Menu entries: `packages/modules/servers/src/lib/servers-menu.tsx`

#### Database

- Schema: `database/schema/02-schema.sql`
- Sample data: `database/schema/03-data.sql`
- Procedures: `database/procedures/proc_projects_servers_*.sql`
- Functions: `database/procedures/func_projects_servers_*.sql`

#### Docker Images

- Gateway: `docker-images/backend-images/gateway/`
  - Startup: `app/lib/start-vpn.sh`
  - Nginx update: `app/bin/update-nginx-locations.sh`
  - Nginx reset: `app/lib/reset-nginx.sh`
- User containers: `docker-images/user-images/`
  - Common functions: `demiurge-functions.sh`
  - JupyterLab: `jupyterlab/start-singleuser.sh`

### 9. Current Problems

#### Problem 1: Hardcoded Images in Database

**Current**: Images manually inserted into `images` table via SQL

**Issues**:

- Module maintainers can't define their own images
- New images require database migration
- Image metadata scattered between database and module code
- Type mapping hardcoded in reducer (switch statement based on image_id)

**Example**: JupyterLab image defined in:

- Database: `03-data.sql` (image_id=2, URI, tag, options)
- Reducer: `servers-reducer.ts` line 748 (type mapping)
- Module: `jupyter` module uses this server but doesn't define it

#### Problem 2: Unstable Container URLs

**Current**: URLs include gateway hostname: `https://{gateway_hostname}/{project_server_id}/{service_name}/`

**Issues**:

- Gateway assigned randomly to projects
- Gateway reclaimed when project inactive
- New gateway assigned on project restart
- Container URL changes → bookmarks break, shared links break
- DYNREDIR partially solves for OAuth, not for user-facing URLs

**Example Flow**:

1. User creates JupyterLab server, gets URL: `https://gw-1-2.dev-001.demiurge.co/42/jupyterlab/`
2. User bookmarks URL, shares with team
3. Project goes inactive, gateway released
4. User returns, new gateway assigned: `gw-1-3.dev-001.demiurge.co`
5. Old URL broken, new URL: `https://gw-1-3.dev-001.demiurge.co/42/jupyterlab/`
6. All bookmarks and shared links invalid

### 10. Related Systems

#### VPN System

- OpenVPN server on gateway (172.16.0.0/16 network)
- Gateway IP: 172.16.0.1
- Containers get IPs from pool
- Certificates generated per-gateway
- Config provided via `/collab/vpn` endpoint

#### OAuth System

- OAuth clients created from image options
- Tokens issued by Ganymede (`app-account`)
- Authorization via `/oauth/authorize` endpoint
- Token exchange via `/oauth/token`
- Used for: JupyterLab, pgAdmin, n8n

### 11. Vocabulary Issues

**Current terminology**: "servers", "project_servers", "projects_servers"

**Should be**: "user-containers", "user_containers", "user_containers"

**Rationale**: "user-containers" distinguishes from other container types (gateway containers, service containers) and makes it clear these are user-managed application containers.

**Affected areas**:

- Database tables (will be removed, but column names in OAuth tables)
- API endpoints
- Shared state keys
- Event names
- File names
- Module name (servers → user-containers)
- UI text
- Type names
