# Container Management Feature - Desired Implementation

## Overview

This document describes the target architecture for the container management system, addressing the main problems:

1. Module-defined container images
2. Stable container URLs independent of gateway assignment
3. Clean vocabulary and architecture

## Goals

1. **Modular Image Definition**: Allow modules to define their own container images without database changes
2. **Stable URLs**: Provide permanent URLs for containers that don't change when gateways are reassigned
3. **Clean Vocabulary**: Rename "servers", "projects_servers" to "user-containers" throughout the codebase
4. **Decoupled Architecture**: Separate concerns between image definition, container lifecycle, and networking
5. **Stateless Persistence**: Store user container data in shared state (Yjs), not database
6. **No Cloud Lock-in**: Remove AWS-specific code, support pluggable container runners later
7. **No Backward Compatibility**: Clean break, simpler implementation

## Key Implementation Decisions

### Technology Choices

| Component      | Solution                 | Rationale                                       |
| -------------- | ------------------------ | ----------------------------------------------- |
| **DNS Server** | PowerDNS + PostgreSQL    | REST API, enterprise-grade, persistent storage  |
| **Storage**    | Yjs CRDT shared state    | Real-time, no DB overhead, collaborative        |
| **SSL (dev)**  | mkcert                   | Valid trusted certificates, no browser warnings |
| **SSL (prod)** | Let's Encrypt per-domain | Standard approach, automatic renewal            |
| **Vocabulary** | user-containers          | Clear distinction from other container types    |

### What Gets Deleted

**Database Tables**:

```sql
DROP TABLE IF EXISTS public.mounts CASCADE;
DROP TABLE IF EXISTS public.volumes CASCADE;
DROP TABLE IF EXISTS public.organizations_members CASCADE;
DROP TABLE IF EXISTS public.groups_members CASCADE;
DROP TABLE IF EXISTS public.groups CASCADE;
DROP TABLE IF EXISTS public.organizations CASCADE;
DROP TABLE IF EXISTS public.images CASCADE;
DROP TABLE IF EXISTS public.projects_servers CASCADE;
```

**Features**:

- Volume management (not used)
- Mount management (not used)
- Organizations/groups (not implemented)
- AWS EC2 hosting (not used)
- DYNREDIR system (replaced by stable DNS)

**Code**:

- All EC2 management code
- Route53 integration
- Volume/mount reducers, events, components
- Old URL generation logic

### What Stays in Database

**Minimal persistence for OAuth only**:

```sql
-- Modified oauth_clients table
CREATE TABLE public.oauth_clients (
    client_id varchar(128) PRIMARY KEY,
    client_secret text NOT NULL,
    redirect_uris json NOT NULL,
    grants json NOT NULL DEFAULT '["authorization_code","refresh_token"]',
    user_container_id varchar(128),  -- No FK, string reference
    service_name varchar(50),
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_container_id, service_name)
);

-- Keep oauth_tokens, users, sessions, projects, gateways
```

## Solution 1: Module-Defined Container Images

### Architecture

#### Image Registry System

Create a new image registry managed by the `user-containers` module (renamed from `servers`):

**Module API Extension** (`packages/modules/module/src/index.ts`):

```typescript
export type ModuleBackend = {
  collabChunk: TCollaborativeChunk;
  containerImages?: TContainerImageDefinition[]; // NEW
};

export type TContainerImageDefinition = {
  imageId: string; // Unique ID: "{module_name}:{image_name}"
  imageName: string;
  imageUri: string;
  imageTag: string;
  imageSha256?: string;
  userAvailable: boolean;
  options: TContainerImageOptions;

  // Metadata
  description?: string;
  category?: string;
  icon?: string;
};

export type TContainerImageOptions = {
  ports?: number[];
  oauthClients?: {
    serviceName: string;
    accessTokenLifetime?: number;
    redirectUris?: string[];
  }[];

  // Type mapping (replaces hardcoded switch)
  containerType: string; // e.g., "jupyter", "pgadmin", "generic"

  // Runtime requirements
  capabilities?: string[]; // e.g., ["NET_ADMIN"]
  devices?: string[]; // e.g., ["/dev/net/tun"]

  // UI customization
  cardComponent?: string; // Custom React component for container card
};
```

#### Image Registration Flow

1. **Module Definition** (e.g., `packages/modules/jupyter/src/index.ts`):

```typescript
export const moduleBackend: ModuleBackend = {
  collabChunk: { ... },
  containerImages: [
    {
      imageId: "jupyter:minimal",
      imageName: "JupyterLab Minimal Notebook",
      imageUri: "public.ecr.aws/f3g9x7j4/demiurge-jmn",
      imageTag: "lab-4.2.0",
      imageSha256: "210a80d14fe0175c0fefc2b3c9b6ce25f28b58badb7bf80ce7ce2512d7d2f98b",
      userAvailable: true,
      containerType: "jupyter",
      options: {
        ports: [8888],
        oauthClients: [{
          serviceName: "jupyterlab",
          accessTokenLifetime: 31536000,
          redirectUris: ["https://CONTAINER_SLUG.containers.yourdomain.com/oauth_callback"]
        }],
        capabilities: ["NET_ADMIN"],
        devices: ["/dev/net/tun"]
      }
    }
  ]
}
```

2. **Image Registry** (`packages/modules/user-containers/src/lib/image-registry.ts`):

```typescript
export class ContainerImageRegistry {
  private images: Map<string, TContainerImageDefinition> = new Map();

  register(images: TContainerImageDefinition[]): void {
    images.forEach((img) => {
      if (this.images.has(img.imageId)) {
        throw new Error(`Image ${img.imageId} already registered`);
      }
      this.images.set(img.imageId, img);
    });
  }

  get(imageId: string): TContainerImageDefinition | undefined {
    return this.images.get(imageId);
  }

  list(filter?: {
    userAvailable?: boolean;
    category?: string;
  }): TContainerImageDefinition[] {
    let images = Array.from(this.images.values());
    if (filter?.userAvailable !== undefined) {
      images = images.filter(
        (img) => img.userAvailable === filter.userAvailable
      );
    }
    if (filter?.category) {
      images = images.filter((img) => img.category === filter.category);
    }
    return images;
  }
}
```

3. **User-Containers Module** (`packages/modules/user-containers/src/index.ts`):

```typescript
export const moduleBackend: ModuleBackend = {
  collabChunk: {
    name: 'user-containers',
    loadExtraContext: ({ modules }): TUserContainersExtraContext => {
      const registry = new ContainerImageRegistry();

      // Register images from all modules
      modules.forEach((module) => {
        if (module.containerImages) {
          registry.register(module.containerImages);
        }
      });

      return {
        userContainers: {
          imageRegistry: registry,
          // Other utilities...
        },
      };
    },
    // ...
  },
};
```

#### Container Data in Shared State

**No database storage for container data!**

```typescript
// packages/modules/user-containers/src/lib/shared-model.ts
export type TUserContainersSharedData = {
  userContainers: Map<string, TUserContainer>; // Key: container_id (string)
};

export type TUserContainer = {
  id: string; // e.g., "uc_abc123xyz"
  projectId: string;
  name: string;
  imageId: string; // Reference to registry
  slug: string; // For DNS

  // Runtime state
  hostUserId?: string;
  ip?: string; // VPN IP
  httpServices: THttpService[];
  lastWatchdogAt: string | null;
  lastActivity: string | null;
  system?: SystemInfo;

  // Metadata
  createdAt: string;
};
```

#### Container Creation Flow

```typescript
async _newUserContainer(g: Ra<TEventNewUserContainer>) {
  const containerId = generateContainerId(); // e.g., "uc_abc123xyz"
  const imageDef = g.extraContext.userContainers.imageRegistry.get(g.event.imageId);

  if (!imageDef) {
    throw new NotFoundException(`Image ${g.event.imageId} not found`);
  }

  // Generate slug
  const slug = generateSlug(g.event.name, containerId);

  // 1. Create in shared state (ephemeral)
  const container: TUserContainer = {
    id: containerId,
    projectId: g.sd.projectId,
    name: g.event.name,
    imageId: g.event.imageId,
    slug,
    httpServices: [],
    lastWatchdogAt: null,
    lastActivity: null,
    createdAt: new Date().toISOString()
  };

  g.sd.userContainers.set(containerId, container);

  // 2. Create OAuth clients in database (persistent)
  if (imageDef.options.oauthClients) {
    await createOAuthClients(containerId, imageDef.options.oauthClients);
  }

  // 3. Create graph node
  g.bep.process({
    type: 'core:new-node',
    nodeData: {
      id: `user-container:${containerId}`,
      name: g.event.name,
      type: 'user-container',
      data: { user_container_id: containerId }
    }
  });
}
```

## Solution 2: Stable Container URLs with DNS

### Architecture

#### DNS: PowerDNS + PostgreSQL

**Why PowerDNS**:

- Enterprise-grade, battle-tested (20+ years)
- Full REST API for dynamic record management
- Persistent storage with PostgreSQL
- High performance (150k+ queries/sec)
- Large community, extensive documentation
- Used by major DNS providers

**Docker Setup**:

```yaml
version: '3.8'
services:
  pdns-db:
    image: postgres:15
    container_name: pdns-db
    environment:
      POSTGRES_DB: pdns
      POSTGRES_USER: pdns
      POSTGRES_PASSWORD: pdns_password
    volumes:
      - pdns-db-data:/var/lib/postgresql/data
    restart: unless-stopped

  pdns:
    image: pschiffe/pdns-pgsql:latest
    container_name: pdns
    ports:
      - '53:53/udp'
      - '53:53/tcp'
      - '8081:8081' # API port
    environment:
      PDNS_AUTH_API_KEY: your-secret-api-key
      POSTGRES_HOST: pdns-db
      POSTGRES_DB: pdns
      POSTGRES_USER: pdns
      POSTGRES_PASSWORD: pdns_password
    depends_on:
      - pdns-db
    restart: unless-stopped

  pdns-admin: # Optional web UI
    image: powerdnsadmin/pda-legacy:latest
    container_name: pdns-admin
    ports:
      - '9191:80'
    environment:
      SQLALCHEMY_DATABASE_URI: postgresql://pdns:pdns_password@pdns-db:5432/pdns
      SECRET_KEY: your-secret-key
    depends_on:
      - pdns-db
    restart: unless-stopped

volumes:
  pdns-db-data:
```

**API Integration** (`packages/modules/gateway/src/dns-client.ts`):

```typescript
export class TechnitiumDNSClient {
  constructor(
    private baseUrl: string,
    private apiToken: string,
    private zone: string = 'containers.yourdomain.com'
  ) {}

  async addRecord(
    subdomain: string,
    ip: string,
    ttl: number = 60
  ): Promise<void> {
    const fqdn = `${subdomain}.${this.zone}`;
    const params = new URLSearchParams({
      token: this.apiToken,
      domain: fqdn,
      zone: this.zone,
      type: 'A',
      ipAddress: ip,
      ttl: ttl.toString(),
    });

    await fetch(`${this.baseUrl}/api/zones/records/add`, {
      method: 'POST',
      body: params,
    });
  }

  async deleteRecord(subdomain: string): Promise<void> {
    const fqdn = `${subdomain}.${this.zone}`;
    const params = new URLSearchParams({
      token: this.apiToken,
      domain: fqdn,
      zone: this.zone,
      type: 'A',
    });

    await fetch(`${this.baseUrl}/api/zones/records/delete`, {
      method: 'POST',
      body: params,
    });
  }
}
```

#### Container Slug Generation

```typescript
function generateSlug(name: string, containerId: string): string {
  // Sanitize name: lowercase, replace non-alphanumeric with hyphens
  const sanitized = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  // Generate short hash from container ID
  const hash = containerId.substring(3, 11); // "uc_abc123xyz" -> "abc123xy"

  return `${sanitized}-${hash}`;
}

// Example: "My JupyterLab" + "uc_abc123xyz" -> "my-jupyterlab-abc123xy"
```

#### HTTP Service Registration with DNS

```typescript
async _userContainerMapHttpService(g: Ra<TEventUserContainerMapHttpService>) {
  const containerId = g.event.user_container_id;
  const container = g.sd.userContainers.get(containerId);

  if (!container) throw new NotFoundException();

  // Add to httpServices
  container.httpServices.push({
    name: g.event.name,
    port: g.event.port,
  });

  // Register DNS (once per container)
  if (container.httpServices.length === 1 && container.ip) {
    const fqdn = `${container.slug}.containers.yourdomain.com`;
    await g.extraContext.dns.addRecord(container.slug, container.ip);
    log(6, 'DNS', `Registered ${fqdn} -> ${container.ip}`);
  }

  // Update nginx
  await g.extraContext.gateway.updateReverseProxy(getAllHttpServices(g.sd));
}
```

#### Gateway Shutdown Cleanup

```typescript
async gatewayStopNotify() {
  const containers = Array.from(sd.userContainers.values());

  // Delete all DNS records for this project's containers
  for (const container of containers) {
    if (container.slug) {
      try {
        await dnsClient.deleteRecord(container.slug);
        log(6, 'DNS', `Deleted ${container.slug}.containers.yourdomain.com`);
      } catch (err) {
        error('DNS', `Failed to delete DNS for ${container.slug}: ${err}`);
      }
    }
  }
}
```

#### Nginx Configuration

**Update Script** (`update-nginx-locations.sh`):

```bash
#!/bin/bash
# Input format: slug vpn_ip port service_name

# Remove all server blocks except collab
sed -i '/^server {/,/^}/!b; /location \/collab/!d' "$CONFIG_FILE"

# Read services from stdin and add server blocks
while read -r slug ip port service; do
  [ -z "$slug" ] && continue

  fqdn="${slug}.containers.yourdomain.com"

  # Obtain Let's Encrypt certificate if doesn't exist
  if [ ! -f "/etc/letsencrypt/live/${fqdn}/fullchain.pem" ]; then
    certbot certonly --standalone \
      -d "${fqdn}" \
      --non-interactive \
      --agree-tos \
      --email admin@yourdomain.com
  fi

  # Add nginx server block
  cat >> "$CONFIG_FILE" <<EOF
server {
    listen 443 ssl http2;
    server_name ${fqdn};

    ssl_certificate /etc/letsencrypt/live/${fqdn}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${fqdn}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    location / {
        proxy_pass http://${ip}:${port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection upgrade;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
EOF
done

# Reload nginx if config changed
nginx -t && nginx -s reload
```

### Local Development Setup

#### DNS Configuration

**Option 1: Hosts file**

```
# /etc/hosts (Linux/Mac) or C:\Windows\System32\drivers\etc\hosts (Windows)
127.0.0.1 gateway.containers.local
127.0.0.1 dns.containers.local
127.0.0.1 my-jupyter-abc123.containers.local
127.0.0.1 my-pgadmin-def456.containers.local
```

**Option 2: Local Technitium**

```yaml
# docker-compose.dev.yml
services:
  dns-server:
    image: technitium/dns-server:latest
    ports:
      - '53:53/udp'
      - '5380:5380'
    environment:
      - DNS_SERVER_DOMAIN=dns.containers.local
# Configure system DNS to use 127.0.0.1
```

#### SSL Certificates with mkcert

**One-time setup**:

```bash
# Install mkcert
# macOS: brew install mkcert nss
# Linux: apt install libnss3-tools && wget mkcert binary
# Windows: choco install mkcert

# Install local CA
mkcert -install

# Generate wildcard certificate
cd monorepo/docker-images/backend-images/gateway/certs
mkcert "*.containers.local" "localhost" "127.0.0.1"

# This creates:
# - _wildcard.containers.local+2.pem (certificate)
# - _wildcard.containers.local+2-key.pem (private key)
```

**Gateway nginx config**:

```nginx
server {
    listen 443 ssl http2;
    server_name *.containers.local;

    ssl_certificate /etc/nginx/certs/_wildcard.containers.local+2.pem;
    ssl_certificate_key /etc/nginx/certs/_wildcard.containers.local+2-key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    location / {
        proxy_pass http://172.16.0.1:$proxy_port;
        # ... proxy config
    }
}
```

**Benefits**:

- ✅ Valid certificates trusted by all browsers
- ✅ No security warnings
- ✅ Works with service workers, OAuth, WebSockets
- ✅ Same HTTPS experience as production

## Solution 3: Vocabulary Changes

### Naming Conventions

| Old               | New                   | Reason                                      |
| ----------------- | --------------------- | ------------------------------------------- |
| servers           | user-containers       | Distinguish from gateway/service containers |
| project_servers   | user_containers       | Consistency                                 |
| TServer           | TUserContainer        | Consistency                                 |
| project_server_id | user_container_id     | Consistency                                 |
| ServersReducer    | UserContainersReducer | Consistency                                 |

### Files to Rename

**Module**:

- `packages/modules/servers/` → `packages/modules/user-containers/`

**Files**:

- `servers-reducer.ts` → `user-containers-reducer.ts`
- `servers-events.ts` → `user-containers-events.ts`
- `servers-types.ts` → `user-containers-types.ts`
- `servers-shared-model.ts` → `user-containers-shared-model.ts`
- `server-card.tsx` → `user-container-card.tsx`
- `node-server/` → `node-user-container/`

**Events**:

- `servers:new` → `user-containers:new`
- `servers:delete` → `user-containers:delete`
- `servers:host` → `user-containers:host`
- `server:watchdog` → `user-container:watchdog`
- `server:map-http-service` → `user-container:map-http-service`

**API Endpoints**:

- `/projects/{id}/servers` → `/projects/{id}/user-containers`
- `/projects/{id}/server/{id}` → `/projects/{id}/user-container/{id}`

## Implementation Phases

### Phase 1: Module System & Storage (3-4 weeks)

**Tasks**:

1. Add `containerImages` to `ModuleBackend` type
2. Implement `ContainerImageRegistry` class
3. Update user-containers module to create registry
4. Move container data to Yjs shared state
5. Update reducers to use shared state (no DB queries)
6. Modify OAuth tables (remove FK, add string user_container_id)
7. Delete unused database tables (images, projects_servers, volumes, mounts, organizations, groups)
8. Update container creation flow
9. Update all CRUD operations to use shared state

**Deliverables**:

- Container data in Yjs, not database
- Module-defined images working
- OAuth clients persist with string reference
- Cleaner database schema

### Phase 2: DNS & Stable URLs (4-5 weeks)

**Tasks**:

1. Deploy PowerDNS server with PostgreSQL (dev + prod)
2. Implement `PowerDNSClient` in gateway module
3. Implement slug generation logic
4. Update HTTP service registration to call DNS API
5. Update nginx script for server blocks
6. Implement Let's Encrypt automation for production
7. Set up mkcert for local development
8. Update gateway shutdown to clean DNS records
9. Test DNS propagation and failover

**Deliverables**:

- Stable URLs working (`{slug}.containers.yourdomain.com`)
- DNS auto-management
- SSL certificates automated (Let's Encrypt + mkcert)
- Local dev environment with valid HTTPS

### Phase 3: Vocabulary Changes (2-3 weeks)

**Tasks**:

1. Rename module directory
2. Rename all files (reducers, events, types, etc.)
3. Update all type names
4. Update event names
5. Update API endpoint paths
6. Update shared state keys
7. Update UI text and labels
8. Update all imports
9. Run comprehensive tests

**Deliverables**:

- Consistent "user-containers" terminology
- All references updated
- Tests passing

### Phase 4: Cleanup (1-2 weeks)

**Tasks**:

1. Delete unused code (EC2, DYNREDIR, volumes, mounts)
2. Remove old nginx location blocks logic
3. Clean up unused imports and types
4. Update all documentation
5. Final testing pass
6. Performance benchmarking

**Deliverables**:

- No legacy code
- Clean, maintainable codebase
- Complete, current documentation

**Total Timeline**: 10-14 weeks (2.5-3.5 months)

## Benefits

### For Developers

- ✅ Fast iteration (no database migrations for containers)
- ✅ Module-defined images (easy to add new containers)
- ✅ Clear architecture (shared state for ephemeral, DB for persistent)
- ✅ No cloud dependencies (self-hosted)

### For Users

- ✅ Stable URLs that never change
- ✅ Bookmarkable container services
- ✅ Shareable links that always work
- ✅ Fast, real-time collaboration

### For System

- ✅ Better performance (no DB queries for container operations)
- ✅ Simpler architecture (fewer moving parts)
- ✅ Self-hosted DNS (no external dependencies)
- ✅ Standard SSL approach (Let's Encrypt)

## Success Criteria

Implementation is complete when:

- [ ] All container images defined in modules (no database)
- [ ] Stable URLs working (survive gateway changes)
- [ ] Container data in Yjs shared state
- [ ] Local dev with valid HTTPS (mkcert)
- [ ] Production with Let's Encrypt automation
- [ ] All tests passing
- [ ] Documentation complete
- [ ] Zero AWS dependencies
- [ ] Clean "user-containers" terminology throughout
- [ ] No volumes/mounts code remaining
- [ ] Performance equal or better than current system
