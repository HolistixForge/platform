# Local Full-Stack Development Setup

## Overview

This guide sets up a **complete local development environment** inside your development container, closely mimicking production but optimized for rapid iteration.

**Key Features:**

- ✅ Multiple isolated environments (e.g., `dev-001`, `dev-002` for different branches)
- ✅ Real HTTPS with trusted certificates
- ✅ Real domain names (`.local` TLD)
- ✅ Full stack: PostgreSQL, Nginx, Ganymede, Gateway
- ✅ User containers running in Docker (like production)
- ✅ Everything scriptable and reproducible

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Docker Host                                 │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │          Development Container (Ubuntu)                       │  │
│  │                                                               │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │                Nginx (Port 443)                         │  │  │
│  │  │  SSL Termination for all environments                  │  │  │
│  │  └────┬─────────────┬─────────────┬───────────────────────┘  │  │
│  │       │             │             │                           │  │
│  │  ┌────▼─────┐  ┌────▼─────┐  ┌───▼──────┐                   │  │
│  │  │ ENV: 001 │  │ ENV: 002 │  │ ENV: 003 │ (Multiple envs)   │  │
│  │  ├──────────┤  ├──────────┤  ├──────────┤                   │  │
│  │  │ Ganymede │  │ Ganymede │  │ Ganymede │                   │  │
│  │  │ :6000    │  │ :6010    │  │ :6020    │                   │  │
│  │  │          │  │          │  │          │                   │  │
│  │  │ Gateway  │  │ Gateway  │  │ Gateway  │                   │  │
│  │  │ :7000    │  │ :7010    │  │ :7020    │                   │  │
│  │  │          │  │          │  │          │                   │  │
│  │  │ Frontend │  │ Frontend │  │ Frontend │                   │  │
│  │  │ (static) │  │ (static) │  │ (static) │                   │  │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘                   │  │
│  │       │             │             │                           │  │
│  │       └─────────────┴─────────────┴──────────────┐            │  │
│  │                                                   │            │  │
│  │  ┌────────────────────────────────────────────┐  │            │  │
│  │  │     PostgreSQL Server (Port 5432)          │◄─┘            │  │
│  │  │                                             │               │  │
│  │  │  Databases:                                │               │  │
│  │  │  - ganymede_dev_001  (for dev-001)        │               │  │
│  │  │  - ganymede_dev_002  (for dev-002)        │               │  │
│  │  │  - ganymede_dev_003  (for dev-003)        │               │  │
│  │  └────────────────────────────────────────────┘               │  │
│  │                                                               │  │
│  │  File Structure:                                              │  │
│  │  /root/workspace/monorepo/                                   │  │
│  │  /root/.local-dev/                                           │  │
│  │    ├── dev-001/ (.env, SSL certs, JWT keys, data, logs)     │  │
│  │    ├── dev-002/                                              │  │
│  │    └── dev-003/                                              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │             User Containers (Docker)                          │  │
│  │  (Started by users, run alongside dev container)             │  │
│  │                                                               │  │
│  │  - jupyter-container-1 (env: dev-001)                        │  │
│  │  - pgadmin-container-2 (env: dev-001)                        │  │
│  │  - vscode-container-3 (env: dev-002)                         │  │
│  │                                                               │  │
│  │  Connected to gateway via VPN                                │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘

Access from host OS browser:
  https://dev-001.local              → Frontend (env 001)
  https://ganymede.dev-001.local     → Ganymede API
  https://gateway.dev-001.local      → Gateway (collab)

  https://dev-002.local              → Frontend (env 002)
  https://ganymede.dev-002.local     → Ganymede API
  https://gateway.dev-002.local      → Gateway
```

## Creating the Development Container

Before creating environments, you need a development container. This is a one-time setup.

### 1. Run Development Container

```bash
# Run Ubuntu container with required capabilities
docker run -d \
  --name demiurge-dev \
  -p 80:80 \
  -p 443:443 \
  --cap-add=NET_ADMIN \
  --device /dev/net/tun \
  -it ubuntu:24.04 \
  /bin/bash

# Attach to the container
docker exec -it demiurge-dev /bin/bash
```

**Capabilities explained:**

- `-p 80:80 -p 443:443` - Expose HTTP/HTTPS ports for Nginx
- `--cap-add=NET_ADMIN --device /dev/net/tun` - For OpenVPN (gateway VPN)

### 2. Inside Container: Install Dependencies

```bash
# Update package lists
apt update && apt upgrade -y

# Install basic tools
apt install -y git curl sudo

# Clone repositories
mkdir -p /root/workspace
cd /root/workspace

# Clone main monorepo
git clone https://github.com/YourOrg/monorepo.git

# Clone database repo
cd /root/workspace
git clone https://github.com/YourOrg/database.git
```

## Quick Start (TL;DR)

**In development container:**

```bash
# One-time setup
./scripts/local-dev/setup-all.sh

# Create environment
./scripts/local-dev/create-env.sh dev-001
./scripts/local-dev/build-frontend.sh dev-001
./scripts/local-dev/envctl.sh start dev-001
```

**On host OS (Windows example):**

```powershell
# As Administrator
# 1. Install root CA (double-click rootCA.pem)
# 2. Add to hosts file
notepad C:\Windows\System32\drivers\etc\hosts
# Add: <dev-container-ip>  dev-001.local ganymede.dev-001.local gateway.dev-001.local
ipconfig /flushdns
```

**Start and access:**

```bash
# In dev container
/root/.local-dev/dev-001/start.sh

# In browser on host OS
https://dev-001.local
```

## Environment Naming Convention

Each environment has:

- **Name**: `dev-001`, `dev-002`, etc. (or `feat-xyz`, `bugfix-123`)
- **Subdomains**:
  - Frontend: `{env}.local` (e.g., `dev-001.local`)
  - Ganymede: `ganymede.{env}.local`
  - Gateway: `gateway.{env}.local`
- **Database**: `ganymede_{env_safe}` (e.g., `ganymede_dev_001`)
- **Ports**: Base port + (env_number \* 10)
  - Ganymede: `6000 + (N * 10)` → 6000, 6010, 6020...
  - Gateway: `7000 + (N * 10)` → 7000, 7010, 7020...
- **Data directory**: `/root/.local-dev/env-{number}/`

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

### 2. Install mkcert for SSL

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

### 4. Master Setup Script (All-in-One)

**Script:** [`scripts/local-dev/setup-all.sh`](../scripts/local-dev/setup-all.sh)

Runs all three setup scripts above in sequence:

```bash
./scripts/local-dev/setup-all.sh
```

## Environment Management Scripts

### Create New Environment

**Script:** [`scripts/local-dev/create-env.sh`](../scripts/local-dev/create-env.sh)

Creates a complete isolated environment with:

1. **Random port allocation** (collision-safe)
2. **Database creation** and schema deployment
3. **SSL certificates** (mkcert)
4. **JWT keys** generation
5. **Gateway registration** (via `app-ganymede-cmd`)
6. **Config files** (.env.ganymede, .env.gateway)
7. **Nginx configuration**
8. **Helper scripts** (start.sh, stop.sh, logs.sh)

**Usage:**

```bash
# Use default workspace
./scripts/local-dev/create-env.sh dev-001

# Use custom workspace (different git branch/checkout)
./scripts/local-dev/create-env.sh feat-xyz /root/workspace-feat /root/database-feat
```

**Arguments:**

1. `env-name` (required) - Environment name
2. `workspace-path` (optional) - Path to monorepo (default: `/root/workspace/monorepo`)
3. `database-path` (optional) - Path to database repo (default: `/root/workspace/database`)

**What it does:**

- Scans existing environments to find used ports
- Randomly allocates ENV_NUMBER (1-99) with collision detection
- Creates database: `ganymede_{env_name}` (dashes → underscores)
- Registers gateway in database via `app-ganymede-cmd add-gateway`
- Saves `GATEWAY_ID`, `GATEWAY_TOKEN`, and `WORKSPACE` path to `.env` files
- Generates multi-domain SSL cert for `{env}.local`, `ganymede.{env}.local`, `gateway.{env}.local`

**Multiple Workspaces:**

Each environment can use a different workspace (useful for testing different branches simultaneously):

```bash
# Create workspaces for different branches
cd /root/workspace
git clone monorepo monorepo-feat-a && cd monorepo-feat-a && git checkout feat-a && npm install
git clone monorepo monorepo-feat-b && cd monorepo-feat-b && git checkout feat-b && npm install
git clone database database-feat-a && cd database-feat-a && git checkout feat-a
git clone database database-feat-b && cd database-feat-b && git checkout feat-b

# Create environments pointing to different workspaces
./create-env.sh dev-001 /root/workspace/monorepo /root/workspace/database
./create-env.sh feat-a /root/workspace/monorepo-feat-a /root/workspace/database-feat-a
./create-env.sh feat-b /root/workspace/monorepo-feat-b /root/workspace/database-feat-b

# Each environment is fully isolated!
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

- Stops processes
- Drops database
- Removes Nginx config
- Cleans /etc/hosts
- Deletes directory

**Usage:**

```bash
./scripts/local-dev/delete-env.sh dev-001
```

### Build Frontend

**Script:** [`scripts/local-dev/build-frontend.sh`](../scripts/local-dev/build-frontend.sh)

Builds frontend with environment-specific configuration.

**Usage:**

```bash
# Use default workspace
./scripts/local-dev/build-frontend.sh dev-001

# Use custom workspace
./scripts/local-dev/build-frontend.sh feat-xyz /root/workspace-feat
```

## Common Tasks

### Start an Environment

**Per-environment script** (auto-created):

```bash
/root/.local-dev/dev-001/start.sh
```

Starts Ganymede + Gateway, builds apps if needed, signals gateway ready.

### Stop an Environment

```bash
/root/.local-dev/dev-001/stop.sh
```

Gracefully stops all processes.

### View Logs

```bash
# Follow Ganymede logs
/root/.local-dev/dev-001/logs.sh ganymede

# Follow Gateway logs
/root/.local-dev/dev-001/logs.sh gateway

# Or directly:
tail -f /root/.local-dev/dev-001/logs/ganymede.log
tail -f /root/.local-dev/dev-001/logs/gateway.log
```

### Rebuild Apps

```bash
cd /root/workspace/monorepo

# Rebuild Ganymede
npx nx run app-ganymede:build

# Rebuild Gateway
npx nx run app-gateway:build

# Rebuild Frontend
./scripts/local-dev/build-frontend.sh dev-001

# Then restart
/root/.local-dev/dev-001/stop.sh
/root/.local-dev/dev-001/start.sh
```

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
cd /root/workspace/monorepo/docker-images/user-images/jupyterlab
docker build -t jupyterlab:local -f Dockerfile-minimal .
```

2. **Start container from UI**:

   - Access: `https://dev-001.local`
   - Create new container (Jupyter, pgAdmin, etc.)
   - Container starts via Docker
   - Connects to gateway via VPN
   - Accessible via gateway proxy

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

### Step 2: Add DNS Entries to Hosts File

#### Windows 11

1. **Open hosts file as Administrator:**

   - Press `Win + X`, select "Terminal (Admin)" or "PowerShell (Admin)"
   - Run: `notepad C:\Windows\System32\drivers\etc\hosts`
   - Or use any text editor run as Administrator

2. **Add entries:**

   ```
   # Demiurge Local Dev - Environment dev-001
   <dev-container-ip>  dev-001.local
   <dev-container-ip>  ganymede.dev-001.local
   <dev-container-ip>  gateway.dev-001.local

   # Demiurge Local Dev - Environment dev-002
   <dev-container-ip>  dev-002.local
   <dev-container-ip>  ganymede.dev-002.local
   <dev-container-ip>  gateway.dev-002.local
   ```

3. **Save and close**

4. **Flush DNS cache:**

   ```powershell
   ipconfig /flushdns
   ```

5. **Verify:**
   ```powershell
   ping dev-001.local
   ```

#### macOS

1. **Open hosts file:**

   ```bash
   sudo nano /etc/hosts
   ```

2. **Add entries:**

   ```
   # Demiurge Local Dev - Environment dev-001
   <dev-container-ip>  dev-001.local
   <dev-container-ip>  ganymede.dev-001.local
   <dev-container-ip>  gateway.dev-001.local

   # Demiurge Local Dev - Environment dev-002
   <dev-container-ip>  dev-002.local
   <dev-container-ip>  ganymede.dev-002.local
   <dev-container-ip>  gateway.dev-002.local
   ```

3. **Save:** `Ctrl+O`, `Enter`, `Ctrl+X`

4. **Flush DNS cache:**

   ```bash
   sudo dscacheutil -flushcache
   sudo killall -HUP mDNSResponder
   ```

5. **Verify:**
   ```bash
   ping dev-001.local
   ```

#### Linux (Ubuntu)

1. **Open hosts file:**

   ```bash
   sudo nano /etc/hosts
   ```

2. **Add entries:**

   ```
   # Demiurge Local Dev - Environment dev-001
   <dev-container-ip>  dev-001.local
   <dev-container-ip>  ganymede.dev-001.local
   <dev-container-ip>  gateway.dev-001.local

   # Demiurge Local Dev - Environment dev-002
   <dev-container-ip>  dev-002.local
   <dev-container-ip>  ganymede.dev-002.local
   <dev-container-ip>  gateway.dev-002.local
   ```

3. **Save:** `Ctrl+O`, `Enter`, `Ctrl+X`

4. **Flush DNS cache (if systemd-resolved is running):**

   ```bash
   sudo systemd-resolve --flush-caches
   # Or on newer Ubuntu:
   sudo resolvectl flush-caches
   ```

5. **Verify:**
   ```bash
   ping dev-001.local
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

### Step 4: Helper Script for Windows Hosts File

**Script:** [`scripts/local-dev/windows-add-hosts.ps1`](../scripts/local-dev/windows-add-hosts.ps1)

Automates adding hosts file entries on Windows (requires Administrator privileges).

**Usage:**

```powershell
# Run PowerShell as Administrator
.\scripts\local-dev\windows-add-hosts.ps1 <dev-container-ip> <env-name>

# Example:
.\scripts\local-dev\windows-add-hosts.ps1 172.17.0.2 dev-001
ipconfig /flushdns
```

---

## Quick Reference

### File Locations

```
/root/workspace/monorepo/              - Main codebase
/root/.local-dev/                      - All environments
  ├── dev-001/                         - Environment "dev-001"
  │   ├── .env.ganymede               - Ganymede config
  │   ├── .env.gateway                - Gateway config
  │   ├── ssl-cert.pem                - SSL certificate
  │   ├── ssl-key.pem                 - SSL private key
  │   ├── jwt-key                     - JWT private key
  │   ├── jwt-key-public.pem          - JWT public key
  │   ├── start.sh                    - Start script
  │   ├── stop.sh                     - Stop script
  │   ├── logs.sh                     - View logs
  │   ├── data/                       - Gateway data storage
  │   └── logs/                       - Application logs
  └── dev-002/                         - Another environment
```

### Port Allocation

**Method:** Random allocation with collision detection

- Scans existing environments to find used ports
- Randomly selects ENV_NUMBER (1-99)
- Checks for collisions, retries if needed
- Formula: `BASE_PORT + (ENV_NUMBER * 10)`

**Examples:**

```
Environment     ENV_NUMBER  Ganymede  Gateway
--------------  ----------  --------  -------
dev-001         (random)    6000+N*10 7000+N*10
feat-xyz        (random)    6000+N*10 7000+N*10
bugfix-123      (random)    6000+N*10 7000+N*10
```

**Base Ports:**

- Ganymede: 6000
- Gateway: 7000

### URLs

```
Environment: dev-001
  Frontend:  https://dev-001.local
  Ganymede:  https://ganymede.dev-001.local
  Gateway:   https://gateway.dev-001.local

Environment: dev-002
  Frontend:  https://dev-002.local
  Ganymede:  https://ganymede.dev-002.local
  Gateway:   https://gateway.dev-002.local
```

## Related Documentation

- [MODULES_TESTING.md](MODULES_TESTING.md) - Testing modules in Storybook
- [INSTALL.md](INSTALL.md) - Production deployment guide
- [REFACTORING.md](REFACTORING.md) - Architecture refactoring details
