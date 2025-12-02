# Local Full-Stack Development Setup

## Overview

This guide sets up a **complete local development environment** inside your development container, closely mimicking production but optimized for rapid iteration.

**Key Features:**

- ✅ Multiple isolated environments (e.g., `dev-001`, `dev-002` for different branches)
- ✅ **Multi-gateway pool architecture** - Multiple containerized gateways, dynamically allocated
- ✅ Real HTTPS with trusted certificates (wildcard `*.domain.local`)
- ✅ **PowerDNS** - Dynamic DNS management via REST API
- ✅ Real domain names with automatic DNS delegation
- ✅ Full stack: PostgreSQL, Nginx, Ganymede, Gateway Pool, PowerDNS
- ✅ User containers running in Docker (like production)
- ✅ Everything scriptable and reproducible
- ✅ Hot-reload support for rapid iteration

---

## Architecture Diagram

📊 **Complete System Architecture Diagram**

See: [../architecture/SYSTEM_ARCHITECTURE.md](../architecture/SYSTEM_ARCHITECTURE.md)

---

## Creating the Development Container

Before creating environments, you need a development container. This is a one-time setup.

### 1. Run Development Container

```bash
# Run Ubuntu container with Docker socket
docker run -d \
  --name demiurge-dev \
  -p 80:80 \
  -p 443:443 \
  -p 53:53/udp \
  -p 53:53/tcp \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -it ubuntu:24.04 \
  /bin/bash

# Attach to the container
docker exec -it demiurge-dev /bin/bash
```

**Ports and mounts explained:**

- `-p 80:80 -p 443:443` - HTTP/HTTPS for Nginx (Stage 1)
- `-p 53:53/udp -p 53:53/tcp` - PowerDNS server
- `-v /var/run/docker.sock:/var/run/docker.sock` - Docker socket (manage gateway containers)

**Note:** Gateway containers handle their own port mappings (7100-7199 for HTTP, 49100-49199/udp for OpenVPN) via `gateway-pool.sh`. The main container accesses gateway services via the Docker host's localhost (e.g., `127.0.0.1:7100`), so it doesn't need to expose these ports.

### 2. Inside Container: Install Dependencies

```bash
# Update package lists
apt update && apt upgrade -y

# Install basic tools
apt install -y git curl sudo

# Clone monorepo
mkdir -p /root/workspace
cd /root/workspace
git clone https://github.com/YourOrg/monorepo.git
```

## Quick Start (TL;DR)

**In development container:**

```bash
# One-time setup (installs PowerDNS, builds Docker images, etc.)
cd /root/workspace/monorepo
./scripts/local-dev/setup-all.sh

# Create environment with gateway pool
# WORKSPACE_PATH is optional (defaults to /root/workspace/monorepo)
./scripts/local-dev/create-env.sh dev-001 domain.local /root/workspace/monorepo
./scripts/local-dev/build-frontend.sh dev-001 /root/workspace/monorepo

# Start environment
./scripts/local-dev/envctl.sh start dev-001
```

**On host OS (ONE-TIME DNS Setup):**

Get your dev container IP:

```bash
# Inside dev container
hostname -I
# Example output: 172.17.0.2
```

Then configure DNS delegation on your host OS:

**Windows:**

```powershell
# Network Adapter → Properties → IPv4 → DNS Server
# Set to: 172.17.0.2 (your dev container IP)
```

**macOS:**

```bash
sudo mkdir -p /etc/resolver
echo 'nameserver 172.17.0.2' | sudo tee /etc/resolver/domain
```

**Linux:**

```bash
# Edit /etc/systemd/resolved.conf
sudo nano /etc/systemd/resolved.conf
# Add:
[Resolve]
DNS=172.17.0.2
Domains=~domain
# Then restart:
sudo systemctl restart systemd-resolved
```

**Access from host OS browser:**

```
https://domain.local                    → Frontend
https://ganymede.domain.local           → Ganymede API
https://org-{uuid}.domain.local         → Gateway (when allocated)
```

All DNS resolution happens automatically via PowerDNS!

## Environment and Domain Structure

### Domain Configuration

Each environment uses a configurable domain (default: `domain.local`):

- **Frontend**: `{domain}` (e.g., `domain.local`)
- **Ganymede**: `ganymede.{domain}` (e.g., `ganymede.domain.local`)
- **Gateways**: `org-{uuid}.{domain}` (dynamically allocated)
- **User Containers**: `uc-{uuid}.org-{uuid}.{domain}`

### Gateway Pool

Gateway containers are named sequentially:

- `gw-pool-0` → HTTP: 7100, VPN: 49100/udp
- `gw-pool-1` → HTTP: 7101, VPN: 49101/udp
- `gw-pool-2` → HTTP: 7102, VPN: 49102/udp

Gateways are dynamically allocated to organizations:

- State managed in PostgreSQL (`gateways.ready` flag)
- DNS registered automatically when allocated
- Nginx config created dynamically
- Returned to pool after 5 minutes of inactivity

### Per-Environment Storage

- **Database**: `ganymede_{env_name}` (e.g., `ganymede_dev_001`)
- **Ganymede Port**: `6000 + (N * 10)` → 6000, 6010, 6020...
- **Data directory**: `/root/.local-dev/{env_name}/`
  - SSL certificates (wildcard `*.{domain}`)
  - JWT keys
  - Gateway pool state
  - Organization data snapshots
  - Logs

## One-Time Setup Scripts

All commands run **inside the development container** (Ubuntu).

### 1. Install System Dependencies

**Script:** [`scripts/local-dev/install-system-deps.sh`](../scripts/local-dev/install-system-deps.sh)

Installs:

- PostgreSQL server
- Nginx web server
- Utilities (jq, curl, git)

```bash
./scripts/local-dev/install-system-deps.sh
```

### 2. Install Docker CLI

**Script:** Install Docker client inside dev container to manage gateway containers

```bash
# Install Docker client (not Docker daemon - we use host's Docker via socket)
apt-get install -y docker.io

# Verify Docker access
docker ps
# Should show containers running on host
```

### 3. Install mkcert for SSL

**Script:** [`scripts/local-dev/install-mkcert.sh`](../scripts/local-dev/install-mkcert.sh)

Installs mkcert and creates a local Certificate Authority (CA).

```bash
./scripts/local-dev/install-mkcert.sh
```

After installation, copy the root CA to your host OS:

```bash
# Find CA location
mkcert -CAROOT

# Copy to workspace
cp $(mkcert -CAROOT)/rootCA.pem /root/workspace/monorepo/rootCA.pem
```

### 3. Setup PostgreSQL

**Script:** [`scripts/local-dev/setup-postgres.sh`](../scripts/local-dev/setup-postgres.sh)

Configures PostgreSQL for local development:

- Sets postgres password to `devpassword`
- Enables password authentication
- Starts the service

```bash
./scripts/local-dev/setup-postgres.sh
```

### 4. Setup PowerDNS

**Script:** [`scripts/local-dev/setup-powerdns.sh`](../scripts/local-dev/setup-powerdns.sh)

Installs and configures PowerDNS for dynamic DNS management:

- Installs `pdns-server` and `pdns-backend-pgsql`
- Uses existing PostgreSQL database
- Enables REST API on port 8081
- Applies official schema

```bash
./scripts/local-dev/setup-powerdns.sh
```

### 5. Build Docker Images

**Script:** [`scripts/local-dev/build-images.sh`](../scripts/local-dev/build-images.sh)

Builds Docker images for gateway containers:

- `gateway:latest` - Gateway image with hot-reload

```bash
./scripts/local-dev/build-images.sh
```

### 6. Master Setup Script (All-in-One)

**Script:** [`scripts/local-dev/setup-all.sh`](../scripts/local-dev/setup-all.sh)

Runs all setup scripts in sequence:

```bash
./scripts/local-dev/setup-all.sh
```

This installs everything: system deps, Docker CLI, mkcert, PostgreSQL, PowerDNS, and builds images.

## Environment Management Scripts

### Create New Environment

**Script:** [`scripts/local-dev/create-env.sh`](../scripts/local-dev/create-env.sh)

Creates a complete isolated environment with:

1. **Domain configuration** (default: `domain.local`)
2. **Database creation** and schema deployment
3. **PowerDNS zone creation** and DNS records
4. **SSL certificates** (mkcert wildcard `*.{domain}`)
5. **JWT keys** generation
6. **Gateway pool creation** (default: 3 gateways)
7. **Nginx configuration** (Stage 1 + dynamic gateway configs)
8. **Config files** (.env.ganymede)
9. **Helper scripts** (start.sh, stop.sh, logs.sh)

**Usage:**

```bash
# Create environment with default domain (domain.local) and default workspace
./scripts/local-dev/create-env.sh dev-001

# Create environment with custom domain
./scripts/local-dev/create-env.sh dev-001 mycompany.local

# Create environment with custom workspace path (for multiple environments with different repos)
./scripts/local-dev/create-env.sh dev-001 domain.local /root/workspace-feat/monorepo

# Specify custom gateway pool size
GATEWAY_POOL_SIZE=5 ./scripts/local-dev/create-env.sh dev-001 domain.local /root/workspace/monorepo
```

**Arguments:**

1. `env-name` (required) - Environment name
2. `domain` (optional) - Domain name (default: `domain.local`)
3. `workspace-path` (optional) - Path to monorepo root (default: `/root/workspace/monorepo`)

**Note:** Gateway containers use bind mounts to access the repository. Each environment can use a different repository directory, allowing multiple environments to work with different branches or forks simultaneously.

**What it does:**

- Creates PostgreSQL database: `ganymede_{env_name}` (dashes → underscores)
- Creates PowerDNS zone for the specified domain
- Registers DNS records:
  - `{domain}` → Frontend
  - `ganymede.{domain}` → Ganymede API
  - `*.{domain}` → Wildcard for dynamic allocations
- Generates wildcard SSL certificate: `*.{domain}`
- Creates gateway pool (3 containers by default):
  - Each gateway registers with Ganymede via `app-ganymede-cmd add-gateway`
  - Assigns sequential ports (7100, 7101, 7102 for HTTP; 49100, 49101, 49102 for VPN)
  - Each gateway receives a JWT token for API access
- Creates Nginx configuration (Stage 1) with dynamic gateway includes
- Creates `org-data/` directory for centralized organization data storage

**Environment Variables:**

- `GATEWAY_POOL_SIZE` - Number of gateways to create (default: 3)
- `DOMAIN` - Domain name (default: `domain.local`)

**Multiple Domains:**

You can create multiple environments with different domains:

```bash
# Development environment
./create-env.sh dev-001 dev.local

# Testing environment
./create-env.sh test-001 test.local

# Each has its own DNS zone, gateway pool, and SSL certificate
```

### List Environments

**Script:** [`scripts/local-dev/list-envs.sh`](../scripts/local-dev/list-envs.sh)

Shows all environments with their status (running/stopped).

**Usage:**

```bash
./scripts/local-dev/list-envs.sh
```

### Delete Environment

**Script:** [`scripts/local-dev/delete-env.sh`](../scripts/local-dev/delete-env.sh)

Completely removes an environment:

- Stops Ganymede process
- Stops and removes gateway pool containers
- Drops PostgreSQL database
- Removes PowerDNS zone (optional)
- Removes Nginx config
- Deletes environment directory

**Usage:**

```bash
./scripts/local-dev/delete-env.sh dev-001
```

### Build Frontend

**Script:** [`scripts/local-dev/build-frontend.sh`](../scripts/local-dev/build-frontend.sh)

Builds frontend with environment-specific configuration.

**Usage:**

```bash
./scripts/local-dev/build-frontend.sh dev-001
```

### Manage Gateway Pool

**Script:** [`scripts/local-dev/gateway-pool.sh`](../scripts/local-dev/gateway-pool.sh)

Creates additional gateway containers in the pool:

**Usage:**

```bash
# Create 2 more gateways (workspace-path is required)
ENV_NAME=dev-001 DOMAIN=domain.local \
  ./scripts/local-dev/gateway-pool.sh 2 /root/workspace/monorepo

# Create gateways with custom workspace path
ENV_NAME=dev-001 DOMAIN=domain.local \
  ./scripts/local-dev/gateway-pool.sh 2 /root/workspace-feat/monorepo
```

**Note:** Gateway allocation and deallocation is managed automatically by Ganymede. This script is only for creating additional pool capacity.

## Common Tasks

### Start an Environment

**Using envctl.sh:**

```bash
./scripts/local-dev/envctl.sh start dev-001
```

This starts:

- Ganymede API server
- Gateway pool containers (if not already running)

Gateway containers start automatically when created and stay running, waiting for allocation.

### Stop an Environment

```bash
./scripts/local-dev/envctl.sh stop dev-001
```

This stops:

- Ganymede API server
- Does NOT stop gateway containers (they remain in the pool)

### View Logs

```bash
# Ganymede logs
tail -f /root/.local-dev/dev-001/logs/ganymede.log

# Gateway pool logs (via Docker)
docker logs gw-pool-0
docker logs gw-pool-1
docker logs -f gw-pool-2  # Follow

# PowerDNS logs
sudo tail -f /var/log/pdns.log
```

### Rebuild and Restart

```bash
cd /root/workspace/monorepo

# Rebuild Ganymede
npx nx run app-ganymede:build
./scripts/local-dev/envctl.sh restart dev-001 ganymede

# Rebuild and hot-reload ALL gateways
npx nx run app-gateway:build
./scripts/local-dev/envctl.sh restart dev-001 gateway

# Rebuild Frontend
./scripts/local-dev/build-frontend.sh dev-001
```

**Hot-Reload:** When you restart gateways, all containers in the pool reload simultaneously without losing their state.

### Access Database

```bash
# Get database name from env
ENV_NAME=dev-001
DB_NAME="ganymede_${ENV_NAME//-/_}"

# Connect
PGPASSWORD=devpassword psql -U postgres -h localhost -d ${DB_NAME}
```

## User Container Testing

User containers work exactly like production:

1. **Build images** (if needed):

```bash
cd /root/workspace/monorepo/packages/modules/jupyter/docker-image
docker build -t jupyterlab:local -f Dockerfile-minimal .
```

2. **Start container from UI**:

   - Access: `https://domain.local` (or your custom domain)
   - Create new container (Jupyter, pgAdmin, etc.)
   - Container starts via Docker
   - Automatically allocated gateway from pool
   - Container connects to gateway via VPN
   - Accessible via: `https://uc-{uuid}.org-{org-uuid}.domain.local`

3. **View container logs**:

```bash
docker logs <container-id>
```

## Developer Workstation Setup

These steps are performed **on your host OS** (Windows, macOS, or Linux), not in the development container.

### Step 1: Get Development Container IP

**In development container:**

```bash
hostname -I
# Example output: 172.17.0.2
```

Or if using Docker Desktop with port forwarding, you can use `127.0.0.1`.

---

### Step 2: Configure DNS Delegation

**PowerDNS runs inside your dev container** and manages all domain records automatically. You only need to configure your host OS to delegate DNS queries to the dev container.

#### Windows 11

**Network Adapter Settings:**

1. Open **Settings** → **Network & Internet** → **Properties** (for your active network)
2. Scroll to **DNS server assignment** → Click **Edit**
3. Select **Manual**
4. Enable **IPv4**
5. Enter your dev container IP (e.g., `172.17.0.2`)
6. Click **Save**

**Verify:**

```powershell
nslookup domain.local
```

#### macOS

**DNS Resolver Configuration:**

```bash
# Create resolver directory
sudo mkdir -p /etc/resolver

# Create resolver file for your domain
echo "nameserver <dev-container-ip>" | sudo tee /etc/resolver/domain

# For custom domains, create additional files:
# echo "nameserver <dev-container-ip>" | sudo tee /etc/resolver/mycompany
```

**Verify:**

```bash
dig @<dev-container-ip> domain.local
scutil --dns  # Check resolver configuration
```

#### Linux (Ubuntu/Debian with systemd-resolved)

**Edit systemd-resolved configuration:**

```bash
sudo nano /etc/systemd/resolved.conf
```

**Add:**

```ini
[Resolve]
DNS=<dev-container-ip>
Domains=~domain.local  # '~' means this server handles this domain
```

**Restart:**

```bash
sudo systemctl restart systemd-resolved
```

**Verify:**

```bash
resolvectl status
dig @<dev-container-ip> domain.local
```

**Alternative (using NetworkManager):**

```bash
# Add DNS to your connection
nmcli connection modify <connection-name> ipv4.dns "<dev-container-ip>"
nmcli connection modify <connection-name> ipv4.dns-search "domain.local"
nmcli connection up <connection-name>
```

---

### Step 3: Install SSL Root Certificate

You need to install the mkcert root CA certificate **once** to trust all local development certificates.

#### Get the Root CA from Dev Container

**In development container:**

```bash
# Find where mkcert stores the root CA
mkcert -CAROOT
# Example output: /root/.local/share/mkcert

# Display the certificate path
ls -la $(mkcert -CAROOT)/rootCA.pem

# Copy to a shared location (if needed)
cp $(mkcert -CAROOT)/rootCA.pem /root/workspace/monorepo/rootCA.pem
```

Now transfer `rootCA.pem` to your host OS (via shared volume, copy-paste, etc.)

---

#### Windows 11 - Install Root CA

**Method 1: GUI (Easiest)**

1. **Locate the `rootCA.pem` file** on Windows (in your mounted workspace)

2. **Right-click** the file → **Install Certificate**

3. **Store Location:** Select "Local Machine" (requires admin)

4. **Certificate Store:**

   - Select "Place all certificates in the following store"
   - Click "Browse"
   - Select **"Trusted Root Certification Authorities"**

5. **Finish** the wizard

6. **Restart browsers** (Chrome, Edge)

**Method 2: Command Line (PowerShell as Admin)**

```powershell
# Import certificate
Import-Certificate -FilePath "C:\path\to\rootCA.pem" -CertStoreLocation Cert:\LocalMachine\Root

# Verify
Get-ChildItem -Path Cert:\LocalMachine\Root | Where-Object {$_.Subject -like "*mkcert*"}
```

**Firefox (Separate Certificate Store)**

Firefox doesn't use Windows certificate store, so you need to import separately:

1. Open Firefox
2. Settings → Privacy & Security → Certificates → **View Certificates**
3. **Authorities** tab → **Import**
4. Select `rootCA.pem`
5. Check "Trust this CA to identify websites"
6. OK

---

#### macOS - Install Root CA

**Method 1: GUI (Easiest)**

1. **Double-click** `rootCA.pem` in Finder

2. **Keychain Access** opens → Select **System** keychain

3. **Add** the certificate

4. **Find the certificate** in the list (search for "mkcert")

5. **Double-click** the mkcert certificate

6. **Trust** section → Set "When using this certificate" to **"Always Trust"**

7. **Close** (you'll be prompted for password)

8. **Restart browsers**

**Method 2: Command Line**

```bash
# Add to system keychain
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ~/path/to/rootCA.pem

# Verify
security find-certificate -c "mkcert" -a -Z | grep -A 5 "mkcert"
```

**Firefox on macOS**

Same as Windows - Firefox has its own certificate store:

1. Firefox → Settings → Privacy & Security → Certificates → View Certificates
2. Authorities → Import → Select `rootCA.pem`
3. Trust for websites → OK

---

#### Linux (Ubuntu) - Install Root CA

**Method 1: Using certutil (Recommended for browsers)**

```bash
# Install certutil
sudo apt install libnss3-tools

# For Chrome/Chromium
certutil -d sql:$HOME/.pki/nssdb -A -t "C,," -n "mkcert-dev" -i ~/path/to/rootCA.pem

# For Firefox (if using)
# Find Firefox profile directory
FIREFOX_PROFILE=$(find ~/.mozilla/firefox -name "*.default-release" | head -1)
certutil -d sql:${FIREFOX_PROFILE} -A -t "C,," -n "mkcert-dev" -i ~/path/to/rootCA.pem
```

**Method 2: System-wide (for all applications)**

```bash
# Copy to system CA directory
sudo cp ~/path/to/rootCA.pem /usr/local/share/ca-certificates/mkcert-dev.crt

# Update CA certificates
sudo update-ca-certificates

# Verify
ls -la /etc/ssl/certs | grep mkcert
```

**Restart browsers** after installation.

---

---

## Quick Reference

### File Locations

```
/root/workspace/monorepo/              - Main codebase
/root/.local-dev/                      - All environments
  ├── dev-001/                         - Environment "dev-001"
  │   ├── .env.ganymede               - Ganymede config
  │   ├── ssl-cert.pem                - SSL certificate (wildcard *.domain.local)
  │   ├── ssl-key.pem                 - SSL private key
  │   ├── jwt-key                     - JWT private key
  │   ├── jwt-key-public.pem          - JWT public key
  │   ├── nginx-gateways.d/           - Dynamic gateway Nginx configs
  │   ├── org-data/                   - Organization data snapshots
  │   └── logs/                       - Ganymede logs
  └── dev-002/                         - Another environment
```

### Gateway Containers

Gateway pool containers are managed by Docker:

```bash
# List gateway containers
docker ps --filter label=environment=dev-001

# View gateway logs
docker logs gw-pool-0

# Check gateway status in database
PGPASSWORD=devpassword psql -U postgres -d ganymede_dev_001 -c \
  "SELECT gateway_id, ready, container_name, http_port FROM gateways;"
```

### Port Allocation

**Main Services:**

- **Nginx (Stage 1):** 80, 443
- **PowerDNS:** 53/udp, 53/tcp, 8081 (API)
- **PostgreSQL:** 5432
- **Ganymede:** 6000

**Gateway Pool (per container):**

- **HTTP:** 7100-7199 (sequential: gw-pool-0 → 7100, gw-pool-1 → 7101, etc.)
- **OpenVPN:** 49100-49199/udp (sequential: gw-pool-0 → 49100, gw-pool-1 → 49101, etc.)

**Example Pool:**

```
Gateway       HTTP Port  VPN Port   Status
-----------   ---------  --------   --------
gw-pool-0     7100       49100/udp  READY
gw-pool-1     7101       49101/udp  ALLOCATED (org-abc123)
gw-pool-2     7102       49102/udp  READY
```

### URLs

**With default domain (domain.local):**

```
Frontend:         https://domain.local
Ganymede API:     https://ganymede.domain.local
Gateway (org):    https://org-{organization-uuid}.domain.local
User Container:   https://uc-{container-uuid}.org-{org-uuid}.domain.local
```

**With custom domain (e.g., mycompany.local):**

```
Frontend:         https://mycompany.local
Ganymede API:     https://ganymede.mycompany.local
Gateway (org):    https://org-{uuid}.mycompany.local
User Container:   https://uc-{uuid}.org-{uuid}.mycompany.local
```

**Note:** Gateway and user container URLs are created dynamically when organizations start projects. DNS records are registered automatically by Ganymede.

**User Container Routing:**

Each container gets a distinct FQDN that routes directly to its VPN IP:
- Stage 1 Nginx terminates SSL and routes to gateway
- Gateway Nginx routes FQDN to container VPN IP:port
- No path prefixes or internal nginx needed in containers

**Accessing Container Services:**

- Main service: `https://uc-{uuid}.org-{uuid}.domain.local/`
- Terminal (if ttyd enabled): Same URL (ttyd serves at root path)
- Gateway internal paths:
  - `/collab/*` - Collaboration, events, VPN config (used by containers over VPN)
  - `/svc/*` - Protected services (JWT-protected module endpoints)
  - `/oauth/*` - OAuth2 provider for container apps

---

## Related Documentation

- [Modules Testing](MODULES_TESTING.md) - Testing modules in Storybook
- [System Architecture](../architecture/SYSTEM_ARCHITECTURE.md) - Complete system diagram
- [Gateway Architecture](../architecture/GATEWAY_ARCHITECTURE.md) - Multi-gateway architecture
- [Protected Services](../architecture/PROTECTED_SERVICES.md) - Terminal access and protected endpoints
