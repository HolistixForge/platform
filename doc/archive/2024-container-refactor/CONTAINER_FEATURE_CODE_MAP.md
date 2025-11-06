# Container Feature - Code Map

Quick reference for files involved in the container management refactoring.

## Current vs Future Architecture

| Component         | Current Location              | Future Location                     | Storage             |
| ----------------- | ----------------------------- | ----------------------------------- | ------------------- |
| Module definition | `packages/modules/servers/`   | `packages/modules/user-containers/` | -                   |
| Container data    | Database (`projects_servers`) | **Yjs shared state**                | In-memory           |
| Image definitions | Database (`images` table)     | **Module code**                     | In-memory registry  |
| OAuth clients     | Database (with FK)            | Database (string reference)         | PostgreSQL          |
| DNS records       | Not managed                   | **PowerDNS + PostgreSQL**           | PostgreSQL database |

## Files to CREATE

```
packages/modules/module/src/container-image.ts           - Image types
packages/modules/user-containers/src/lib/image-registry.ts  - Registry class
packages/modules/gateway/src/dns-client.ts               - PowerDNS client
docker-compose.dns.yml                                   - DNS deployment
docs/DNS_SERVER_COMPARISON.md                            - DNS analysis
```

## Files to RENAME

```
packages/modules/servers/ → user-containers/

servers-reducer.ts → user-containers-reducer.ts
servers-events.ts → user-containers-events.ts
servers-types.ts → user-containers-types.ts
servers-shared-model.ts → user-containers-shared-model.ts
servers-menu.tsx → user-containers-menu.tsx
server-card.tsx → user-container-card.tsx
node-server/ → node-user-container/
new-server.tsx → new-user-container.tsx

app-ganymede/src/commands/server-command.ts → user-container-command.ts
```

## Files to DELETE

### Volume/Mount Feature

```
packages/modules/servers/src/lib/components/node-volume/
packages/modules/servers/src/lib/form/*volume*.tsx
Volume reducer methods in servers-reducer.ts
Volume events in servers-events.ts
```

### AWS/EC2 Feature

```
packages/app-ganymede/src/commands/ec2-instance.ts
Cloud methods in servers-reducer.ts (_serverToCloud, _pollCloudInstanceState, etc.)
Cloud events in servers-events.ts
EC2 exec-pipes in exec-pipes.json
```

### DYNREDIR System

```
/dynredir endpoint in oas30.json
DYNREDIR replacement logic in app-account/src/models/oauth.ts (lines 80-96)
```

### Database

```
All volume procedures/functions
All projects_servers procedures/functions
All images procedures/functions
Table schemas in 02-schema.sql
```

## Files to UPDATE

### Major Changes

**`packages/modules/user-containers/src/lib/user-containers-reducer.ts`**:

- Remove: `_getUpToDateServerData()`, `serverInitialInfo()`, all volume methods, all cloud methods
- Update: `_newUserContainer()` - use shared state, no DB, use registry
- Update: `_deleteUserContainer()` - delete from shared state
- Update: `_userContainerMapHttpService()` - call DNS API
- Update: `_updateNginx()` - new format with slug

**`packages/modules/gateway/src/index.ts`**:

- Add: PowerDNS client initialization
- Export: `extraContext.dns`
- Update: `gatewayStopNotify()` - cleanup DNS records

**`docker-images/backend-images/gateway/app/bin/update-nginx-locations.sh`**:

- Change from location blocks to server blocks
- Add Let's Encrypt cert obtainment
- Input format: `slug ip port service`

**`docker-images/user-images/demiurge-functions.sh`**:

- Remove: `get_gateway()` function
- Update: Use stable DNS from environment

**`packages/app-ganymede/src/oas30.json`**:

- Delete: ~15 endpoints (volumes, mounts, cloud, images, jupyterlab, dynredir)
- Rename: 5 endpoints (servers → user-containers)

**`database/schema/02-schema.sql`**:

- Delete: 8 tables
- Keep: 10 tables (users, sessions, oauth, projects, gateways)
- Modify: oauth_clients (remove FK, use string user_container_id)

## Database Migration

### Tables to DROP

```sql
DROP TABLE IF EXISTS public.mounts CASCADE;
DROP TABLE IF EXISTS public.volumes CASCADE;
DROP TABLE IF EXISTS public.images CASCADE;
DROP TABLE IF EXISTS public.projects_servers CASCADE;
DROP TABLE IF EXISTS public.organizations_members CASCADE;
DROP TABLE IF EXISTS public.groups_members CASCADE;
DROP TABLE IF EXISTS public.groups CASCADE;
DROP TABLE IF EXISTS public.organizations CASCADE;
```

### Tables to MODIFY

```sql
-- OAuth clients
ALTER TABLE oauth_clients
  DROP CONSTRAINT IF EXISTS fk_oauth_clients_projects_servers_project_server_id;

ALTER TABLE oauth_clients
  RENAME COLUMN project_server_id TO user_container_id;

ALTER TABLE oauth_clients
  ALTER COLUMN user_container_id TYPE varchar(128);
```

### Tables to KEEP (Unchanged)

```sql
users, sessions, passwords, totp, magic_links
oauth_clients (modified), oauth_tokens
projects, gateways, projects_gateways
```

## API Endpoints Changes

### Deleted Endpoints (~15)

```
DELETE /projects/{id}/volume
DELETE /projects/{id}/volume/{id}
DELETE /projects/{id}/server/{id}/mount
DELETE /projects/{id}/server/{id}/unmount
DELETE /projects/{id}/server/{id}/mounts
DELETE /projects/{id}/server/{id}/to-cloud
DELETE /projects/{id}/server/{id}/instance-state
DELETE /projects/{id}/server/{id}/start
DELETE /projects/{id}/server/{id}/stop
DELETE /projects/{id}/server/{id}/delete-cloud
DELETE /images
DELETE /jupyterlab
DELETE /dynredir/{psid}/{service}/{path}
```

### Renamed Endpoints (~5)

```
/projects/{id}/servers → /projects/{id}/user-containers
/projects/{id}/server/{id} → /projects/{id}/user-container/{id}
/projects/{id}/server/{id}/host → /projects/{id}/user-container/{id}/host
/projects/{id}/server/{id}/cmd → /projects/{id}/user-container/{id}/cmd
```

### Kept Endpoints

```
/projects (GET, POST, DELETE)
/projects/{id}/start
/gateway-config
/gateway-ready
/gateway-stop
/oauth/* (all OAuth endpoints)
/me/projects
/user-by-id
/users-search
/scope
```

## Key Type Changes

```typescript
// Rename these types everywhere
TServer → TUserContainer
TG_Server → TG_UserContainer
TD_Server → TUserContainer  // No longer database type
TSSS_Server → TUserContainer
TServerComponentProps → TUserContainerComponentProps
TServersSharedData → TUserContainersSharedData

// Delete these types
TApi_Volume, TApi_Mount
TEc2InstanceState
TEventNewVolume, TEventMountVolume, etc.
TEventServerToCloud, TEventServerCloudPause, etc.

// Change field types
project_server_id: number → user_container_id: string
image_id: number → imageId: string
```

## Summary Statistics

- **Total files in feature**: ~85 files
- **Files to create**: ~10 new files
- **Files to rename**: ~15 files
- **Files to delete**: ~30 files
- **Files to update**: ~40 files
- **Database tables deleted**: 8 tables
- **Database procedures deleted**: ~20 procedures/functions
- **API endpoints deleted**: ~15 endpoints

This is a significant refactoring but results in a much cleaner, more maintainable architecture.
