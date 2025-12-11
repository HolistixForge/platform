# Local Development DNS Architecture and Setup Guide

## Table of Contents

1. [Overview](#overview)
2. [How DNS Works in This Setup](#how-dns-works-in-this-setup)
3. [Network Architecture](#network-architecture)
4. [Dev Container Setup](#dev-container-setup)
5. [Host OS Configuration](#host-os-configuration)
6. [Verification and Troubleshooting](#verification-and-troubleshooting)
7. [Historical Context](#historical-context)

---

## Overview

The local development environment uses a **two-tier DNS architecture**:

- **CoreDNS** - DNS forwarder that handles all DNS queries
- **PowerDNS** - Authoritative DNS server for environment-specific domains (e.g., `*.domain.local`, `*.mycompany.local`)

**Important:** Each environment can use a different domain. The domain is specified when creating the environment (default: `domain.local`). For example:

- `dev-001` environment might use `domain.local`
- `test-001` environment might use `test.local`
- `prod-001` environment might use `mycompany.local`

This setup provides:

- ✅ Local domain resolution (`*.{domain}`) via PowerDNS
- ✅ External domain resolution (github.com, etc.) via CoreDNS forwarding
- ✅ Automatic fallback when the dev container stops (external DNS still works)
- ✅ Everything in one container (simpler maintenance)

---

## How DNS Works in This Setup

### DNS Flow

**Example with `domain.local` environment:**

```
┌─────────────────────────────────────────────────────────────┐
│ Windows Host                                                 │
│  - Browser queries: ganymede.domain.local                   │
│  - DNS configured: 127.0.0.1 (primary), 8.8.8.8 (fallback) │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ Port 53 (UDP/TCP)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ Dev Container (172.17.0.3)                                   │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ CoreDNS (Port 53)                                     │    │
│  │  - Receives all DNS queries                          │    │
│  │  - Forwards *.{domain} → PowerDNS:5300              │    │
│  │  - Forwards everything else → 8.8.8.8               │    │
│  └─────────────────────────────────────────────────────┘    │
│                          │                                    │
│                          │ 127.0.0.1:5300                     │
│                          ▼                                    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ PowerDNS (Port 5300)                                 │    │
│  │  - Authoritative for *.{domain} (per environment)   │    │
│  │  - Returns 127.0.0.1 for local domains              │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Gateway Containers                                   │    │
│  │  - Use --dns 172.17.0.3                              │    │
│  │  - Query CoreDNS on port 53                          │    │
│  │  - CoreDNS forwards to PowerDNS:5300                 │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

**Note:** `{domain}` is the environment-specific domain (e.g., `domain.local`, `mycompany.local`).

### Key Components

1. **CoreDNS** (Port 53)

   - Listens on all interfaces (`0.0.0.0:53`)
   - Forwards `*.domain.local` → `127.0.0.1:5300` (PowerDNS)
   - Forwards all other queries → `8.8.8.8`, `8.8.4.4` (upstream DNS)

2. **PowerDNS** (Port 5300)

   - Internal only (not exposed to host)
   - Authoritative DNS server for `*.domain.local`
   - Returns `127.0.0.1` for local domains
   - Managed via REST API on port 8081

3. **Windows DNS Fallback**
   - Primary DNS: `127.0.0.1` (CoreDNS)
   - Secondary DNS: `8.8.8.8` (fallback)
   - When container stops, Windows automatically uses `8.8.8.8` for external DNS

---

## Network Architecture

### Network Layers

```
┌─────────────────────────────────────────────────────────────┐
│ Windows Host (192.168.x.x or similar)                       │
│  - Your browser runs here                                    │
│  - Needs to resolve ganymede.{domain}                       │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ (WSL2 bridge)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ WSL2 (172.x.x.x - different IP)                             │
│  - Linux subsystem                                           │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ (Docker bridge)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ Docker Bridge Network (172.17.0.0/16)                       │
│                                                               │
│  ┌──────────────────────┐  ┌──────────────────────┐         │
│  │ Dev Container        │  │ Gateway Containers   │         │
│  │ 172.17.0.3           │  │ 172.17.0.4, 0.5...   │         │
│  │                      │  │                      │         │
│  │ - CoreDNS (port 53) │  │ - Need to resolve   │         │
│  │ - PowerDNS (5300)    │  │   ganymede.domain...│         │
│  │ - Nginx (port 443)   │  │ - Need to connect   │         │
│  │ - Ganymede (6100)    │  │   to Ganymede API   │         │
│  └──────────────────────┘  └──────────────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

### Key Network Facts

- **Windows** can reach **WSL2** directly
- **WSL2** can reach **Docker containers** (same virtual network)
- **Docker containers** can reach each other (Docker bridge network)
- **Windows cannot directly reach** Docker container IPs (172.17.0.x)
- **Port 53** is mapped: Container port 53 → Windows host port 53 (CoreDNS)
- **Port 443** is mapped: Container port 443 → Windows host port 443 (Nginx)
- **Port 5300** is NOT exposed (PowerDNS is internal only)

---

## Dev Container Setup

### Automatic Setup

DNS is configured automatically when you run the setup script:

```bash
cd /root/workspace/monorepo
./scripts/local-dev/setup-all.sh
```

This installs and configures:

- PowerDNS (on port 5300)
- CoreDNS (on port 53)
- All necessary configurations

### Manual Setup

If you need to set up DNS manually:

#### 1. PowerDNS Configuration

PowerDNS is configured by `scripts/local-dev/setup-powerdns.sh`:

- Listens on port **5300** (internal only)
- Uses PostgreSQL backend
- REST API on port 8081

#### 2. CoreDNS Configuration

CoreDNS is configured by `scripts/local-dev/setup-coredns.sh`:

```bash
# CoreDNS is automatically downloaded and installed
# Configuration is automatically written to /etc/coredns/Corefile
```

**Configuration file (`/etc/coredns/Corefile`):**

```
.:53 {
    # Forward environment domains to PowerDNS
    forward domain.local 127.0.0.1:5300

    # Forward everything else to upstream DNS
    forward . 8.8.8.8 8.8.4.4 {
        max_concurrent 1000
    }

    # Cache responses
    cache {
        success 9984 30
        denial 9984 5
    }

    # Logging
    log
    errors
}
```

**Explanation:**

- `.:53` - Listen on port 53 for all queries
- `forward domain.local 127.0.0.1:5300` - Forward `*.domain.local` to PowerDNS (example for default domain)
- `forward . 8.8.8.8 8.8.4.4` - Forward everything else to Google DNS
- `cache` - Cache DNS responses for better performance
- `log` and `errors` - Enable logging

**Automatic Configuration Updates:**

CoreDNS configuration is automatically updated when environments are created or deleted:

- When you run `./create-env.sh dev-001 mycompany.local`, CoreDNS is automatically updated to forward `*.mycompany.local` to PowerDNS
- When you run `./delete-env.sh dev-001`, the domain is automatically removed from CoreDNS config
- The update script (`update-coredns.sh`) scans all existing environments and regenerates the configuration

**Manual Update (if needed):**

If you need to manually update CoreDNS configuration (e.g., after manual changes), run:

```bash
./scripts/local-dev/update-coredns.sh
```

This script:

1. Scans all environments in `/root/.local-dev/`
2. Extracts the `DOMAIN` from each environment's `.env.ganymede` file
3. Regenerates `/etc/coredns/Corefile` with all domains
4. Restarts CoreDNS to apply changes

**Example generated configuration (for multiple domains):**

```
.:53 {
    forward domain.local 127.0.0.1:5300
    forward mycompany.local 127.0.0.1:5300
    forward test.local 127.0.0.1:5300
    forward . 8.8.8.8 8.8.4.4 {
        max_concurrent 1000
    }
    cache {
        success 9984 30
        denial 9984 5
    }
    log
    errors
}
```

#### 3. Start Services

```bash
# Start CoreDNS (runs as daemon in containers)
sudo coredns -conf /etc/coredns/Corefile &

# Verify PowerDNS is running on port 5300
sudo ss -tulnp | grep :5300

# Verify CoreDNS is running on port 53
sudo ss -tulnp | grep :53
```

### Docker Port Mapping

When starting the dev container, ensure port 53 is exposed:

```bash
docker run -d \
  --name holistix-dev \
  -p 80:80 \
  -p 443:443 \
  -p 53:53/udp -p 53:53/tcp \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -it ubuntu:24.04 \
  /bin/bash
```

**Note:** Port 5300 does NOT need to be exposed - PowerDNS is only accessed by CoreDNS within the same container.

### Gateway Container DNS

Gateway containers are configured to use the dev container as their DNS server:

```bash
# In gateway-pool.sh
docker run -d \
  --dns "${dev_container_ip}" \
  ...
```

Gateway containers query CoreDNS on port 53, which forwards `*.{domain}` queries to PowerDNS on port 5300 (where `{domain}` is the environment-specific domain).

---

## Host OS Configuration

### Windows 11

#### Step 1: Configure DNS Settings

1. Open **Settings** → **Network & Internet** → **Properties** (for your active network)
2. Scroll to **DNS server assignment** → Click **Edit**
3. Select **Manual**
4. Enable **IPv4**
5. **Preferred DNS server:** Enter `127.0.0.1` (CoreDNS in container)
6. **Alternate DNS server:** Enter `8.8.8.8` (Google DNS - fallback)
7. Click **Save**

#### Step 2: Verify Configuration

```powershell
# Test local domain (replace {domain} with your environment's domain)
nslookup ganymede.{domain}
# Should resolve to 127.0.0.1

# Test external domain
nslookup github.com
# Should resolve to GitHub's IP

# Test with explicit DNS server
nslookup ganymede.{domain} 127.0.0.1
nslookup github.com 127.0.0.1
```

**Note:** Replace `{domain}` with your environment's actual domain (e.g., `domain.local`, `mycompany.local`).

#### How Fallback Works

- **Container running:** Windows uses `127.0.0.1` → CoreDNS → handles both local and external DNS
- **Container stopped:** Windows automatically falls back to `8.8.8.8` → external DNS still works
- **Container stopped:** Local domains (`*.{domain}`) won't work (expected - container is down)

**Alternative DNS servers for fallback:**

- `8.8.8.8` / `8.8.4.4` - Google DNS
- `1.1.1.1` / `1.0.0.1` - Cloudflare DNS
- `208.67.222.222` / `208.67.220.220` - OpenDNS

### macOS

#### Step 1: Configure DNS Resolver

```bash
# Create resolver directory
sudo mkdir -p /etc/resolver

# Create resolver file for your domain (replace {domain} with your environment's domain)
echo "nameserver 127.0.0.1" | sudo tee /etc/resolver/{domain}

# For multiple domains, create additional files:
# echo "nameserver 127.0.0.1" | sudo tee /etc/resolver/mycompany.local
```

#### Step 2: Configure System DNS (with fallback)

1. Open **System Settings** → **Network**
2. Select your active network connection
3. Click **Details...**
4. Go to **DNS** tab
5. Click **+** to add DNS servers:
   - `127.0.0.1` (primary)
   - `8.8.8.8` (fallback)
6. Click **OK**

#### Step 3: Verify Configuration

```bash
# Test local domain (replace {domain} with your environment's domain)
dig @127.0.0.1 ganymede.{domain}
# Should resolve to 127.0.0.1

# Test external domain
dig @127.0.0.1 github.com
# Should resolve to GitHub's IP

# Check resolver configuration
scutil --dns
```

**Note:** Replace `{domain}` with your environment's actual domain (e.g., `domain.local`, `mycompany.local`).

### Linux (Ubuntu/Debian with systemd-resolved)

#### Step 1: Configure systemd-resolved

```bash
sudo nano /etc/systemd/resolved.conf
```

**Add:**

```ini
[Resolve]
DNS=127.0.0.1 8.8.8.8
Domains=~{domain}
```

**Explanation:**

- `DNS=127.0.0.1 8.8.8.8` - Primary DNS (CoreDNS) and fallback
- `Domains=~{domain}` - This DNS server handles `*.{domain}` (replace `{domain}` with your environment's domain, e.g., `domain.local`, `mycompany.local`)

#### Step 2: Restart systemd-resolved

```bash
sudo systemctl restart systemd-resolved
```

#### Step 3: Verify Configuration

```bash
# Check status
resolvectl status

# Test local domain (replace {domain} with your environment's domain)
dig @127.0.0.1 ganymede.{domain}

# Test external domain
dig @127.0.0.1 github.com
```

**Note:** Replace `{domain}` with your environment's actual domain (e.g., `domain.local`, `mycompany.local`).

#### Alternative (using NetworkManager)

```bash
# Add DNS to your connection (replace {domain} with your environment's domain)
nmcli connection modify <connection-name> ipv4.dns "127.0.0.1 8.8.8.8"
nmcli connection modify <connection-name> ipv4.dns-search "{domain}"
nmcli connection up <connection-name>
```

---

## Verification and Troubleshooting

### Diagnostic Script

Run the diagnostic script to check all DNS components:

```bash
cd /root/workspace/monorepo
./scripts/local-dev/infra-diagnostic.sh
```

This checks:

- CoreDNS service status
- CoreDNS listening on port 53
- PowerDNS listening on port 5300
- DNS zone configuration
- Resolution from dev container
- Resolution from gateway containers
- HTTPS connectivity

### Common Issues

#### Port 53 Already in Use

**Problem:** CoreDNS can't bind to port 53

**Solution:**

```bash
# Check what's using port 53
sudo ss -tulnp | grep :53

# Stop the conflicting service
sudo killall coredns  # if CoreDNS is already running
sudo killall pdns_server  # if PowerDNS is still on port 53
# or
sudo systemctl stop systemd-resolved  # if systemd-resolved is using port 53
```

#### Windows Can't Resolve External Domains

**Problem:** After setting DNS to `127.0.0.1`, external domains don't work

**Solution:**

1. Check CoreDNS is running:

   ```bash
   pgrep -x coredns
   ```

2. Check CoreDNS config has upstream DNS:

   ```bash
   cat /etc/coredns/Corefile | grep "forward ."
   ```

   Should show:

   ```
   forward . 8.8.8.8 8.8.4.4 {
       max_concurrent 1000
   }
   ```

3. Restart CoreDNS:

   ```bash
   sudo killall coredns
   sudo coredns -conf /etc/coredns/Corefile &
   ```

4. Flush Windows DNS cache:
   ```powershell
   ipconfig /flushdns
   ```

#### Gateway Containers Can't Resolve

**Problem:** Gateway containers can't resolve `ganymede.{domain}`

**Solution:**

1. Check gateway uses correct DNS:

   ```bash
   docker inspect <gateway-container> | grep -A 5 Dns
   ```

   Should show the dev container IP.

2. Test DNS from gateway container (replace `{domain}` with your environment's domain):

   ```bash
   docker exec <gateway-container> nslookup ganymede.{domain}
   ```

3. Verify PowerDNS is on port 5300:

   ```bash
   sudo ss -tulnp | grep :5300
   ```

4. Check CoreDNS logs:
   ```bash
   # CoreDNS logs to stdout/stderr, check process output
   ps aux | grep coredns
   ```

#### DNS Not Working After Container Restart

**Problem:** DNS stops working after restarting the dev container

**Solution:**

1. Ensure CoreDNS starts automatically (add to startup script):

   ```bash
   sudo coredns -conf /etc/coredns/Corefile &
   ```

2. Check PowerDNS is running:

   ```bash
   sudo ss -tulnp | grep :5300
   ```

3. Restart both services:
   ```bash
   sudo killall coredns
   sudo coredns -conf /etc/coredns/Corefile &
   sudo killall pdns_server
   sudo pdns_server --daemon=yes --guardian=yes --config-dir=/etc/powerdns
   ```

---

## Historical Context

This section documents alternative approaches that were considered during development. The current setup uses **CoreDNS in Dev Container** (described above).

### Alternative 1: Direct PowerDNS

**Approach:** PowerDNS directly on port 53

**Why not used:**

- ❌ External DNS breaks (PowerDNS doesn't forward queries it doesn't manage)
- ❌ Requires workarounds for gateway containers

### Alternative 2: Windows Hosts File

**Approach:** Manual entries in `C:\Windows\System32\drivers\etc\hosts`

**Why not used:**

- ❌ No wildcard support
- ❌ Must add each subdomain manually
- ❌ Dynamic gateway domains can't be pre-added
- ❌ Not scalable

### Alternative 3: DNS Forwarder in WSL2

**Approach:** Install DNS forwarder (CoreDNS) in WSL2 instead of dev container

**Why not used:**

- ⚠️ Requires WSL2 configuration
- ⚠️ Less portable (WSL2-specific)
- ✅ Current approach (CoreDNS in container) is simpler and more portable

### Alternative 4: PowerDNS Recursor

**Approach:** Use PowerDNS Recursor for forwarding

**Why not used:**

- ⚠️ More complex setup
- ⚠️ Two PowerDNS services running
- ⚠️ Overkill for simple forwarding
- ✅ CoreDNS is simpler and sufficient

### Alternative 5: Windows DNS Conditional Forwarding

**Approach:** Use Windows DNS Server role with conditional forwarding

**Why not used:**

- ❌ Requires Windows Pro/Server
- ❌ Requires DNS Server role
- ❌ Doesn't work on Windows Home
- ✅ Current approach works on all Windows versions

### Alternative 6: Acrylic DNS Proxy

**Approach:** Third-party Windows DNS proxy

**Why not used:**

- ⚠️ Third-party software dependency
- ⚠️ Windows-only
- ✅ Current approach is cross-platform and uses standard tools

### Alternative 7: WSL2 systemd-resolved

**Approach:** Use systemd-resolved for conditional forwarding

**Why not used:**

- ❌ Doesn't work properly in WSL2
- ❌ systemd-resolved limitations in WSL2
- ✅ Current approach is more reliable

---

## Summary

The current DNS setup uses:

- **CoreDNS** on port 53 (exposed to host) - DNS forwarder
- **PowerDNS** on port 5300 (internal) - Authoritative DNS for environment-specific domains (e.g., `*.domain.local`, `*.mycompany.local`)
- **Windows DNS fallback** - Secondary DNS (`8.8.8.8`) for when container stops

**Important:** Each environment can use a different domain. The domain is specified when creating the environment:

```bash
./scripts/local-dev/create-env.sh dev-001 domain.local
./scripts/local-dev/create-env.sh test-001 mycompany.local
```

If using multiple domains, ensure CoreDNS is configured to forward all of them to PowerDNS (see [CoreDNS Configuration](#2-coredns-configuration) section).

This provides:

- ✅ Local domain resolution (`*.{domain}` - environment-specific)
- ✅ External domain resolution (github.com, etc.)
- ✅ Automatic fallback when container stops
- ✅ Works on all Windows versions
- ✅ Simple setup and maintenance

For setup instructions, see the [Dev Container Setup](#dev-container-setup) and [Host OS Configuration](#host-os-configuration) sections above.
