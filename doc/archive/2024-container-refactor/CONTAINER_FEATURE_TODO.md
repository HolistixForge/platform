# Container Feature Refactoring - TODO List

This document tracks all tasks for refactoring the container management system.

**See Also**:

- [CURRENT_IMPLEMENTATION.md](./CONTAINER_FEATURE_CURRENT_IMPLEMENTATION.md) - How it works now
- [DESIRED_IMPLEMENTATION.md](./CONTAINER_FEATURE_DESIRED_IMPLEMENTATION.md) - Target architecture
- [CODE_MAP.md](./CONTAINER_FEATURE_CODE_MAP.md) - File locations

## Goals

1. Module-defined container images
2. Stable DNS-based container URLs
3. Vocabulary: servers → user-containers
4. Storage: database → Yjs shared state
5. Self-hosted DNS (PowerDNS + PostgreSQL)
6. Remove: volumes, mounts, AWS/EC2, organizations, groups

## Phase 1: Module System & Storage Migration (3-4 weeks)

### 1.1 Module System Extensions

- [ ] **Define container image types**

  - [ ] Create `packages/modules/module/src/container-image.ts`
  - [ ] Define `TContainerImageDefinition` type
  - [ ] Define `TContainerImageOptions` type
  - [ ] Export from `packages/modules/module/src/index.ts`

- [ ] **Extend ModuleBackend type**

  - [ ] Add `containerImages?: TContainerImageDefinition[]` to ModuleBackend
  - [ ] Update TypeScript types across packages

- [ ] **Update collab-engine**
  - [ ] Modify `compileChunks()` in `packages/collab-engine/src/lib/chunk.ts`
  - [ ] Add `modules` parameter to pass full module objects
  - [ ] Pass modules to `loadExtraContext()`
  - [ ] Update all callers (app-gateway, app-frontend)

### 1.2 Image Registry Implementation

- [ ] **Create Image Registry**

  - [ ] Create `packages/modules/user-containers/src/lib/image-registry.ts`
  - [ ] Implement `ContainerImageRegistry` class
    - [ ] `register(images)` - Register images from modules
    - [ ] `get(imageId)` - Get image by ID
    - [ ] `list(filter?)` - List with optional filtering
  - [ ] Add unit tests

- [ ] **Update user-containers module**
  - [ ] Add `loadExtraContext` to create registry
  - [ ] Register images from all modules at startup
  - [ ] Export `userContainers.imageRegistry` in extraContext
  - [ ] Pass modules parameter to loadExtraContext

### 1.3 Module Image Definitions

- [ ] **JupyterLab images** (`packages/modules/jupyter/`)

  - [ ] Add containerImages to moduleBackend
  - [ ] Define `jupyter:minimal` image with options
  - [ ] Define `jupyter:pytorch` image with options
  - [ ] Set `containerType: "jupyter"`
  - [ ] Update JupyterLab image to not require `/jupyterlab` endpoint

- [ ] **pgAdmin image** (create or update module)

  - [ ] Define `pgadmin:latest` image
  - [ ] Set `containerType: "pgadmin"`

- [x] **Ubuntu image** (user-containers module)

- [x] Define `ubuntu:24.04` image (registered as built-in imageId `ubuntu:terminal` in user-containers module)
-- [x] Set `containerType: "generic"` / utility (terminal-only) image

- [ ] **n8n image** (create module or add to existing)
  - [ ] Define `n8n:latest` image
  - [ ] Set `containerType: "n8n"`

### 1.4 Shared State Migration

- [ ] **Update shared data model**

  - [ ] Create `TUserContainersSharedData` type
  - [ ] Define `userContainers: Map<string, TUserContainer>`
  - [ ] Define `TUserContainer` type with all fields
  - [ ] Remove database-specific fields

- [ ] **Update container ID generation**

  - [ ] Implement `generateContainerId()` - returns string like "uc_abc123xyz"
  - [ ] Update all code using project_server_id (number) to user_container_id (string)

- [ ] **Update reducers**

  - [ ] Modify `_newUserContainer()` to use shared state instead of DB
  - [ ] Remove all database queries for container CRUD
  - [ ] Update `_deleteUserContainer()` to delete from shared state
  - [ ] Update `_hostUserContainer()` to update shared state
  - [ ] Remove `_getUpToDateServerData()` (no longer needed)
  - [ ] Remove hardcoded `serverInitialInfo()` function
  - [ ] Use `imageDef.containerType` instead

- [ ] **Update event types**
  - [ ] Change `TEventNewServer` to use string imageId
  - [ ] Update all event type definitions
  - [ ] Remove volume/mount events

### 1.5 OAuth Integration

- [ ] **Update OAuth tables**

  - [ ] Drop FK constraint: `fk_oauth_clients_projects_servers_project_server_id`
  - [ ] Rename column: `project_server_id` → `user_container_id`
  - [ ] Change type: integer → varchar(128)
  - [ ] Update all procedures using this column

- [ ] **Update OAuth client creation**

  - [ ] Modify container creation to use string ID
  - [ ] Create OAuth clients in Ganymede (not gateway)
  - [ ] Link by `user_container_id` string, not FK
  - [ ] Update OAuth token validation

- [ ] **Update redirect URIs**
  - [ ] Replace `DYNREDIR` with stable URL pattern
  - [ ] Use `CONTAINER_SLUG` placeholder
  - [ ] Replace at container creation time
  - [ ] Test OAuth flows

### 1.6 Database Cleanup

- [ ] **Delete unused tables**

  - [ ] Create migration script for table deletion
  - [ ] `DROP TABLE mounts CASCADE`
  - [ ] `DROP TABLE volumes CASCADE`
  - [ ] `DROP TABLE organizations_members CASCADE`
  - [ ] `DROP TABLE groups_members CASCADE`
  - [ ] `DROP TABLE groups CASCADE`
  - [ ] `DROP TABLE organizations CASCADE`
  - [ ] `DROP TABLE images CASCADE`
  - [ ] `DROP TABLE projects_servers CASCADE`
  - [ ] Verify no remaining dependencies

- [ ] **Update Ganymede**
  - [ ] Remove all exec-pipes for volumes/mounts
  - [ ] Remove volume/mount API endpoints from oas30.json
  - [ ] Delete volume/mount related procedures/functions
  - [ ] Remove projects_servers procedures (new-project-server, etc.)

### 1.7 Frontend Updates

- [ ] **Update image selection**

  - [ ] Modify new-server form to handle string imageId
  - [ ] Update image query to call new endpoint
  - [ ] Update display logic

- [ ] **Remove volume/mount UI**

  - [ ] Delete volume node component
  - [ ] Delete volume forms
  - [ ] Delete mount/unmount UI
  - [ ] Remove from menu entries

- [ ] **Update container card**
  - [ ] Display stable URL when available
  - [ ] Remove volume-related UI
  - [ ] Test all actions

## Phase 2: DNS & Stable URLs (4-5 weeks)

### 2.1 DNS Infrastructure

- [ ] **Deploy PowerDNS with PostgreSQL**

  - [ ] Create docker-compose.yml for DNS server
  - [ ] Deploy to development environment
  - [ ] Deploy to production environment
  - [ ] Configure DNS zone: `containers.yourdomain.com`
  - [ ] Set up DNS API token
  - [ ] Test DNS resolution

- [ ] **DNS Client Implementation**

  - [ ] Create `packages/modules/gateway/src/dns-client.ts`
  - [ ] Implement `PowerDNSClient` class
    - [ ] `addRecord(slug, ip, ttl)` method
    - [ ] `deleteRecord(slug)` method
    - [ ] Error handling and retries
  - [ ] Add unit tests
  - [ ] Add integration tests

- [ ] **Gateway DNS Integration**
  - [ ] Add DNS client to gateway extraContext
  - [ ] Configure DNS server URL and token
  - [ ] Add logging for DNS operations
  - [ ] Handle DNS errors gracefully

### 2.2 Slug Generation

- [ ] **Implement slug generation**

  - [ ] Create `generateSlug(name, containerId)` function
  - [ ] Sanitize name: lowercase, hyphens, remove special chars
  - [ ] Extract short hash from container ID
  - [ ] Ensure uniqueness
  - [ ] Add tests

- [ ] **Update container model**
  - [ ] Add `slug: string` to TUserContainer type
  - [ ] Generate slug in `_newUserContainer()`
  - [ ] Store in shared state
  - [ ] Display in UI

### 2.3 HTTP Service Registration with DNS

- [ ] **Update map-http-service reducer**

  - [ ] Call DNS API when first service registered
  - [ ] Pass slug and container VPN IP
  - [ ] Handle DNS errors
  - [ ] Update nginx with new format

- [ ] **Update nginx script**

  - [ ] Modify `update-nginx-locations.sh` for server blocks
  - [ ] Input format: `slug ip port service`
  - [ ] Generate full server block per container
  - [ ] Configure SSL certificate paths
  - [ ] Test nginx config validation

- [ ] **Update \_updateNginx() reducer**
  - [ ] Change data format for updateReverseProxy()
  - [ ] Pass slug instead of location prefix
  - [ ] Test with multiple containers

### 2.4 SSL Certificate Management

- [ ] **Production: Let's Encrypt**

  - [ ] Install certbot on gateway hosts
  - [ ] Configure automatic cert obtainment in nginx script
  - [ ] Test certificate generation
  - [ ] Set up renewal automation
  - [ ] Monitor certificate expiry

- [ ] **Development: mkcert**
  - [ ] Document mkcert installation
  - [ ] Generate wildcard certificate for \*.containers.local
  - [ ] Mount certificates in gateway container
  - [ ] Configure nginx to use mkcert certs
  - [ ] Test in browsers (Chrome, Firefox, Safari)

### 2.5 Gateway Cleanup

- [ ] **Implement DNS cleanup on shutdown**

  - [ ] Update `gatewayStopNotify()` function
  - [ ] Delete all DNS records for project containers
  - [ ] Log cleanup operations
  - [ ] Handle errors gracefully

- [ ] **Test cleanup scenarios**
  - [ ] Gateway normal shutdown
  - [ ] Gateway crash/force stop
  - [ ] Gateway restart
  - [ ] DNS orphan record cleanup

### 2.6 Frontend URL Updates

- [ ] **Display stable URLs**

  - [ ] Update container card to show `{slug}.containers.yourdomain.com`
  - [ ] Add copy URL button
  - [ ] Update service buttons to use stable URL
  - [ ] Remove gateway hostname from UI

- [ ] **Remove DYNREDIR**
  - [ ] Delete `/dynredir` endpoint from Ganymede
  - [ ] Remove DYNREDIR replacement logic from oauth.ts
  - [ ] Update container startup scripts (no more get_gateway call)
  - [ ] Test OAuth flows with stable URLs

### 2.7 Container Startup Changes

- [ ] **Update user container images**
  - [ ] Remove `get_gateway()` function from demiurge-functions.sh
  - [ ] Use configured DNS hostname directly
  - [ ] Update VPN connection logic
  - [ ] Update nginx configuration in containers
  - [ ] Test with all image types

### 2.8 Testing

- [ ] **Unit tests**

  - [ ] DNS client methods
  - [ ] Slug generation
  - [ ] Container creation/deletion

- [ ] **Integration tests**

  - [ ] Container creation with DNS
  - [ ] HTTP service registration
  - [ ] SSL certificate generation
  - [ ] Gateway shutdown cleanup

- [ ] **E2E tests**
  - [ ] Full container lifecycle
  - [ ] URL access and stability
  - [ ] OAuth flows
  - [ ] Multiple containers per project

## Phase 3: Vocabulary Changes (2-3 weeks)

### 3.1 Module Rename

- [ ] **Rename module directory**
  - [ ] `packages/modules/servers/` → `packages/modules/user-containers/`
  - [ ] Update package.json name
  - [ ] Update nx project configuration
  - [ ] Update module registration in app-gateway and app-frontend

### 3.2 File Renames

- [ ] **Backend files**

  - [ ] `servers-reducer.ts` → `user-containers-reducer.ts`
  - [ ] `servers-events.ts` → `user-containers-events.ts`
  - [ ] `servers-types.ts` → `user-containers-types.ts`
  - [ ] `servers-shared-model.ts` → `user-containers-shared-model.ts`
  - [ ] `servers-menu.tsx` → `user-containers-menu.tsx`

- [ ] **Frontend files**

  - [ ] `node-server/` → `node-user-container/`
  - [ ] `node-server.tsx` → `node-user-container.tsx`
  - [ ] `server-card.tsx` → `user-container-card.tsx`
  - [ ] `new-server.tsx` → `new-user-container.tsx`

- [ ] **Ganymede files**
  - [ ] `server-command.ts` → `user-container-command.ts`
  - [ ] Remove `ec2-instance.ts` (not used)

### 3.3 Type Renames

- [ ] **Core types**

  - [ ] `TServer` → `TUserContainer`
  - [ ] `TG_Server` → `TG_UserContainer`
  - [ ] `TD_Server` → `TD_UserContainer`
  - [ ] `TSSS_Server` → `TSSS_UserContainer`

- [ ] **Component types**

  - [ ] `TServerComponentProps` → `TUserContainerComponentProps`
  - [ ] `TServerComponentCallbacks` → `TUserContainerComponentCallbacks`
  - [ ] `TServerPublishedInfo` → `TUserContainerPublishedInfo`

- [ ] **Shared data types**

  - [ ] `TServersSharedData` → `TUserContainersSharedData`
  - [ ] `TServersExtraContext` → `TUserContainersExtraContext`

- [ ] **Remove volume types**
  - [ ] Delete `TApi_Volume`, `TApi_Mount`
  - [ ] Remove volume-related type exports

### 3.4 Event Name Changes

- [ ] **Update event types**

  - [ ] `servers:new` → `user-containers:new`
  - [ ] `servers:delete` → `user-containers:delete`
  - [ ] `servers:host` → `user-containers:host`
  - [ ] `server:watchdog` → `user-container:watchdog`
  - [ ] `server:map-http-service` → `user-container:map-http-service`
  - [ ] `servers:activity` → `user-containers:activity`

- [ ] **Delete volume events**

  - [ ] Remove `servers:new-volume`
  - [ ] Remove `servers:mount-volume`
  - [ ] Remove `servers:unmount-volume`
  - [ ] Remove `servers:delete-volume`

- [ ] **Delete cloud events**

  - [ ] Remove `servers:to-cloud`
  - [ ] Remove `servers:cloud-pause`
  - [ ] Remove `servers:cloud-start`
  - [ ] Remove `servers:cloud-delete`
  - [ ] Remove `servers:_update-instance-state`

- [ ] **Update event handlers**
  - [ ] Update switch cases in reducers
  - [ ] Update event dispatchers in frontend
  - [ ] Remove deleted event handlers

### 3.5 API Endpoint Changes

- [ ] **Update paths**

  - [ ] `/projects/{id}/servers` → `/projects/{id}/user-containers`
  - [ ] `/projects/{id}/server/{id}` → `/projects/{id}/user-container/{id}`
  - [ ] Update OpenAPI spec (oas30.json)

- [ ] **Delete endpoints**

  - [ ] Remove `/projects/{id}/volume*` endpoints
  - [ ] Remove `/projects/{id}/server/{id}/mount` endpoints
  - [ ] Remove `/projects/{id}/server/{id}/mounts` endpoints
  - [ ] Remove `/projects/{id}/server/{id}/to-cloud` endpoints
  - [ ] Remove `/projects/{id}/server/{id}/instance-state` endpoints
  - [ ] Remove `/projects/{id}/server/{id}/start` endpoints (cloud)
  - [ ] Remove `/projects/{id}/server/{id}/stop` endpoints (cloud)
  - [ ] Remove `/projects/{id}/server/{id}/delete-cloud` endpoints

- [ ] **Update path parameters**
  - [ ] `project_server_id` → `user_container_id`
  - [ ] Update parameter definitions in oas30.json
  - [ ] Update validation schemas

### 3.6 Shared State Changes

- [ ] **Update keys**

  - [ ] `sd['user-containers:containers']` → `sd.userContainers`
  - [ ] Update all Map operations
  - [ ] Update Yjs document structure

- [ ] **Update JWT claims**
  - [ ] `jwt.project_server_id` → `jwt.user_container_id`
  - [ ] Update token generation in server-command.ts
  - [ ] Update token validation in reducers

### 3.7 UI Text Changes

- [ ] **Component labels**

  - [ ] "Server" → "Container"
  - [ ] "New Server" → "New Container"
  - [ ] "Server Name" → "Container Name"
  - [ ] "Delete Server" → "Delete Container"

- [ ] **Remove volume UI**
  - [ ] Remove "New Volume" menu entry
  - [ ] Remove volume node component
  - [ ] Remove mount/unmount actions
  - [ ] Remove volume-related tooltips

### 3.8 Testing

- [ ] **Update test files**

  - [ ] Rename test files
  - [ ] Update test descriptions
  - [ ] Update mocks and fixtures
  - [ ] Remove volume/mount tests

- [ ] **Run full test suite**
  - [ ] Fix any failures
  - [ ] Verify coverage maintained
  - [ ] Add new tests for changed behavior

## Phase 4: DNS & Stable URLs (4-5 weeks)

### 4.1 PowerDNS Deployment

- [ ] **Development environment**

  - [ ] Create docker-compose.dns.yml
  - [ ] Configure PowerDNS + PostgreSQL containers
  - [ ] Set up DNS zone: `containers.local`
  - [ ] Create API token
  - [ ] Test DNS queries
  - [ ] Document setup process

- [ ] **Production environment**
  - [ ] Deploy PowerDNS server with PostgreSQL
  - [ ] Configure DNS zone: `containers.yourdomain.com`
  - [ ] Set up API token
  - [ ] Configure firewall (port 53, 8081)
  - [ ] Test external DNS resolution

### 4.2 DNS Client Implementation

- [ ] **Create DNS client**

  - [ ] Create `packages/modules/gateway/src/dns-client.ts`
  - [ ] Implement `PowerDNSClient` class
  - [ ] `addRecord(slug, ip, ttl)` method
  - [ ] `deleteRecord(slug)` method
  - [ ] Error handling and retry logic
  - [ ] Add comprehensive logging

- [ ] **Add to gateway extraContext**
  - [ ] Initialize DNS client in gateway module
  - [ ] Export as `extraContext.dns`
  - [ ] Configure from environment variables
  - [ ] Test DNS operations

### 4.3 Slug Generation

- [ ] **Implement slug logic**

  - [ ] Create `generateSlug(name, containerId)` function
  - [ ] Sanitize container name (lowercase, hyphens)
  - [ ] Extract short hash from container ID
  - [ ] Format: `{sanitized-name}-{short-hash}`
  - [ ] Add tests for edge cases

- [ ] **Update container creation**
  - [ ] Generate slug when creating container
  - [ ] Store in shared state
  - [ ] Pass to frontend
  - [ ] Display in UI

### 4.4 HTTP Service Registration

- [ ] **Update map-http-service event handler**

  - [ ] Get container from shared state
  - [ ] Call DNS API to register A record
  - [ ] Handle DNS errors
  - [ ] Log DNS operations
  - [ ] Update nginx

- [ ] **Test HTTP service mapping**
  - [ ] Test with single service
  - [ ] Test with multiple services per container
  - [ ] Test DNS propagation
  - [ ] Test nginx configuration

### 4.5 Nginx Configuration Updates

- [ ] **Update nginx script**

  - [ ] Modify `update-nginx-locations.sh` for server blocks
  - [ ] Accept input: `slug ip port service`
  - [ ] Generate server block per container
  - [ ] Configure SSL certificate paths
  - [ ] Add HTTP→HTTPS redirect
  - [ ] Test nginx reload

- [ ] **Update gateway reverse proxy logic**
  - [ ] Change `_updateNginx()` to pass new format
  - [ ] Collect: slug, ip, port for each container
  - [ ] Update shell script invocation
  - [ ] Test with multiple containers

### 4.6 SSL Automation

- [ ] **Production: Let's Encrypt**

  - [ ] Install certbot on gateway hosts
  - [ ] Add cert obtainment to nginx script
  - [ ] Check if cert exists before obtaining
  - [ ] Configure renewal hooks
  - [ ] Test certificate generation
  - [ ] Monitor certificate expiry

- [ ] **Development: mkcert setup**
  - [ ] Create setup documentation
  - [ ] Generate wildcard cert for \*.containers.local
  - [ ] Mount certs in gateway docker container
  - [ ] Configure nginx for dev environment
  - [ ] Test in multiple browsers

### 4.7 Gateway Cleanup

- [ ] **DNS cleanup on shutdown**

  - [ ] Update `gatewayStopNotify()` in gateway module
  - [ ] Iterate all containers in shared state
  - [ ] Delete DNS record for each container slug
  - [ ] Log cleanup operations
  - [ ] Handle partial failures

- [ ] **Periodic DNS cleanup**
  - [ ] Add periodic task to verify DNS consistency
  - [ ] Remove DNS records for deleted containers
  - [ ] Add monitoring/alerting

### 4.8 Container Startup Updates

- [ ] **Update demiurge-functions.sh**

  - [ ] Remove `get_gateway()` function
  - [ ] Use stable DNS hostname directly
  - [ ] Simplify VPN connection logic
  - [ ] Update nginx configuration
  - [ ] Test with all image types

- [ ] **Update image startup scripts**
  - [ ] JupyterLab: update start-singleuser.sh
  - [ ] Remove gateway hostname retrieval
  - [ ] Use environment variable for stable URL
  - [ ] Test OAuth callbacks
  - [ ] Patch JupyterLab image to not need `/jupyterlab` endpoint

## Phase 5: Final Cleanup (1-2 weeks)

### 5.1 Remove Legacy Code

- [ ] **Delete volume/mount code**

  - [ ] Delete volume-related reducers
  - [ ] Delete volume-related components
  - [ ] Delete volume-related forms
  - [ ] Delete volume helper functions

- [ ] **Delete EC2/AWS code**

  - [ ] Delete `ec2-instance.ts`
  - [ ] Delete EC2-related exec-pipes
  - [ ] Delete instance state polling
  - [ ] Remove EC2 types and imports

- [ ] **Delete DYNREDIR**

  - [ ] Remove `/dynredir` endpoint from Ganymede
  - [ ] Remove DYNREDIR replacement in oauth.ts
  - [ ] Remove from OpenAPI spec
  - [ ] Clean up related code

- [ ] **Delete old nginx logic**
  - [ ] Remove location block code from nginx script
  - [ ] Keep only server block generation
  - [ ] Clean up reset-nginx.sh

### 5.2 Documentation

- [ ] **Update all documentation**

  - [ ] Verify CURRENT_IMPLEMENTATION accurate
  - [ ] Verify DESIRED_IMPLEMENTATION complete
  - [ ] Verify CODE_MAP current
  - [ ] Update TODO with actual progress
  - [ ] Add troubleshooting guide
  - [ ] Document local dev setup
  - [ ] Document production deployment

- [ ] **Code comments**
  - [ ] Remove outdated TODOs
  - [ ] Add comments for complex logic
  - [ ] Update function documentation
  - [ ] Remove "server" references in comments

### 5.3 Final Testing

- [ ] **Comprehensive testing**

  - [ ] Full container lifecycle test
  - [ ] DNS registration and cleanup
  - [ ] SSL certificate automation
  - [ ] OAuth flows
  - [ ] Multi-user collaboration
  - [ ] Gateway failover scenarios

- [ ] **Performance testing**

  - [ ] Measure container creation time
  - [ ] Measure DNS propagation time
  - [ ] Test with many containers
  - [ ] Profile memory usage
  - [ ] Compare with old system

- [ ] **User acceptance testing**
  - [ ] Test with real use cases
  - [ ] Verify UX improvements
  - [ ] Get feedback on stable URLs
  - [ ] Test on different devices/browsers

### 5.4 Deployment

- [ ] **Prepare deployment**

  - [ ] Create deployment checklist
  - [ ] Document rollback procedure
  - [ ] Prepare database migration scripts
  - [ ] Back up current database
  - [ ] Plan deployment window

- [ ] **Deploy**

  - [ ] Deploy DNS server
  - [ ] Deploy updated Ganymede
  - [ ] Deploy updated gateways
  - [ ] Deploy updated frontend
  - [ ] Run database migration
  - [ ] Verify all services healthy

- [ ] **Post-deployment**
  - [ ] Monitor for errors
  - [ ] Check DNS resolution
  - [ ] Verify SSL certificates
  - [ ] Test container creation
  - [ ] Monitor performance

## Cross-Cutting Tasks

### Configuration

- [ ] **Environment variables**
  - [ ] Add DNS_SERVER_URL
  - [ ] Add DNS_API_TOKEN
  - [ ] Add DNS_ZONE (containers.yourdomain.com or .local)
  - [ ] Update .env-example files
  - [ ] Document all env vars

### Security

- [ ] **Review security**
  - [ ] DNS API token security
  - [ ] SSL configuration best practices
  - [ ] JWT token scopes for containers
  - [ ] OAuth client security
  - [ ] VPN security

### Monitoring

- [ ] **Add monitoring**
  - [ ] DNS resolution metrics
  - [ ] SSL certificate expiry alerts
  - [ ] Container creation/deletion metrics
  - [ ] Gateway health checks
  - [ ] Error rate monitoring

### Documentation

- [ ] **Developer guides**

  - [ ] Local development setup
  - [ ] Adding new container images
  - [ ] Module development guide
  - [ ] DNS troubleshooting

- [ ] **User guides**
  - [ ] Creating containers
  - [ ] Accessing containers via stable URLs
  - [ ] Container lifecycle management

## Summary

### Estimated Timeline

- Phase 1: Module System & Storage - 3-4 weeks
- Phase 2: DNS & Stable URLs - 4-5 weeks
- Phase 3: Vocabulary Changes - 2-3 weeks
- Phase 4: Final Cleanup - 1-2 weeks

**Total: 10-14 weeks (2.5-3.5 months)**

### Success Criteria

- [ ] All container images defined in modules
- [ ] Stable URLs working
- [ ] Container data in shared state
- [ ] Local dev with mkcert SSL
- [ ] Production with Let's Encrypt
- [ ] Clean user-containers terminology
- [ ] No volumes/mounts code
- [ ] No AWS dependencies
- [ ] All tests passing

### Key Files to Create

- `packages/modules/module/src/container-image.ts`
- `packages/modules/user-containers/src/lib/image-registry.ts`
- `packages/modules/gateway/src/dns-client.ts`

### Key Files to Modify

- All files in `packages/modules/servers/` (rename to user-containers)
- `packages/app-ganymede/src/oas30.json` (remove endpoints)
- `docker-images/backend-images/gateway/app/bin/update-nginx-locations.sh`
- `docker-images/user-images/demiurge-functions.sh`

### Key Files to Delete

- Volume/mount components, forms, reducers
- EC2 instance management code
- DYNREDIR implementation
- Database volume/mount procedures
