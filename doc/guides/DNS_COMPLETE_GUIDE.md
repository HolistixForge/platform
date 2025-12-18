# Local Development DNS Architecture and Setup Guide

## Table of Contents

1. [Overview](#overview)
2. [How DNS Works in This Setup](#how-dns-works-in-this-setup)
3. [Network Architecture](#network-architecture)
4. [Dev Container Setup](#dev-container-setup)
5. [Host OS Configuration](#host-os-configuration)
6. [Verification and Troubleshooting](#verification-and-troubleshooting)

---

## Overview

The local development environment uses a **simplified DNS architecture** with **CoreDNS and zone files**:

- **CoreDNS** - DNS server serving static zone files with wildcard DNS

**Important:** Each environment can use a different domain. The domain is specified when creating the environment (default: `domain.local`). For example:

- `dev-001` environment might use `domain.local`
- `test-001` environment might use `test.local`
- `prod-001` environment might use `mycompany.local`

This setup provides:

- ✅ Local domain resolution (`*.{domain}`) via CoreDNS zone files
- ✅ External domain resolution (github.com, etc.) via CoreDNS forwarding
- ✅ **Wildcard DNS** - All subdomains automatically resolve (no dynamic registration needed)
- ✅ Automatic fallback when the dev container stops (external DNS still works)
- ✅ Simplified architecture - No database, no API, just static zone files

### Why This Approach?

**Key Insight:** With wildcard DNS (`*.domain.local → IP`), all subdomains automatically resolve to the same IP address:

- `domain.local` → `127.0.0.1`
- `ganymede.domain.local` → `127.0.0.1`
- `org-abc123.domain.local` → `127.0.0.1`
- `uc-xyz.org-abc123.domain.local` → `127.0.0.1`

**No dynamic DNS operations needed!** Nginx `server_name` matching provides the routing layer.

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
│  │  - Serves zone files from /etc/coredns/zones/       │    │
│  │  - Forwards everything else → 8.8.8.8, 8.8.4.4      │    │
│  └─────────────────────────────────────────────────────┘    │
│                          │                                    │
│                          │                                    │
│                          ▼                                    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Zone File: /etc/coredns/zones/domain.local.zone     │    │
│  │  domain.local      IN  A    127.0.0.1               │    │
│  │  ganymede          IN  A    127.0.0.1               │    │
│  │  *                 IN  A    127.0.0.1  ← WILDCARD!  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Gateway Containers                                   │    │
│  │  - Use --dns 172.17.0.3                              │    │
│  │  - Query CoreDNS on port 53                          │    │
│  │  - Wildcard DNS resolves all subdomains              │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

**Note:** `{domain}` is the environment-specific domain (e.g., `domain.local`, `mycompany.local`).

### Key Components

1. **CoreDNS** (Port 53)

   - Listens on all interfaces (`0.0.0.0:53`)
   - Serves zone files from `/etc/coredns/zones/`
   - Each environment has its own zone file: `/etc/coredns/zones/{domain}.zone`
   - Forwards all other queries → `8.8.8.8`, `8.8.4.4` (upstream DNS)

2. **Zone Files** (`/etc/coredns/zones/{domain}.zone`)

   - Static DNS zone files (standard RFC 1035 format)
   - Contains apex domain, explicit records (ganymede), and wildcard (`*`)
   - **Wildcard record (`*`)** - Automatically matches ALL subdomains
   - No database, no API, just simple text files

3. **Windows DNS Fallback**
   - Primary DNS: `127.0.0.1` (CoreDNS)
   - Secondary DNS: `8.8.8.8` (fallback)
   - When container stops, Windows automatically uses `8.8.8.8` for external DNS

### Example Zone File

When you create an environment with `create-env.sh dev-001 domain.local`, the script creates:

**`/etc/coredns/zones/domain.local.zone`:**

```dns
$ORIGIN domain.local.
$TTL 60

; SOA record (required for valid zone)
@       IN  SOA  ns1.domain.local. admin.domain.local. (
            2024121800 ; Serial
            3600       ; Refresh
            1800       ; Retry
            604800     ; Expire
            60 )       ; Minimum TTL

; NS record (required)
@       IN  NS   ns1.domain.local.
ns1     IN  A    127.0.0.1

; A records for specific services
@           IN  A    127.0.0.1   ; Apex domain (domain.local)
ganymede    IN  A    127.0.0.1   ; Ganymede API

; Wildcard - catches ALL other subdomains
*           IN  A    127.0.0.1
```

**What this means:**

- `domain.local` → `127.0.0.1` (apex domain record)
- `ganymede.domain.local` → `127.0.0.1` (explicit record)
- `org-abc123.domain.local` → `127.0.0.1` (wildcard match)
- `uc-xyz.org-abc123.domain.local` → `127.0.0.1` (wildcard match)
- **ANY subdomain** → `127.0.0.1` (wildcard match)

---

## Network Architecture

### Dev Container Network Interfaces

```
Dev Container:
  - Docker bridge (eth0): 172.17.0.3
  - Localhost (lo): 127.0.0.1
```

### How Host OS Reaches Dev Container Services

```
Host OS (172.17.0.1) → Dev Container (172.17.0.3) → CoreDNS (127.0.0.1:53)
                                                  → Zone Files (/etc/coredns/zones/)
                                                  → Nginx (127.0.0.1:443)
                                                  → Ganymede (127.0.0.1:6000)
```

---

## Dev Container Setup

All DNS setup is automated by the `setup-coredns.sh` and `create-env.sh` scripts.

### What `setup-coredns.sh` Does

1. Installs CoreDNS
2. Creates `/etc/coredns/zones/` directory
3. Generates initial Corefile configuration
4. Starts CoreDNS daemon

### What `create-env.sh` Does

1. Creates zone file: `/etc/coredns/zones/{domain}.zone`
2. Updates CoreDNS Corefile to serve the new zone
3. Restarts CoreDNS to apply changes

### Zone File Management

**Creating a zone file:**

```bash
# Automated by create-env.sh
sudo tee /etc/coredns/zones/domain.local.zone > /dev/null <<EOF
$ORIGIN domain.local.
$TTL 60

@       IN  SOA  ns1.domain.local. admin.domain.local. (
            $(date +%Y%m%d%H) ; Serial (timestamp)
            3600              ; Refresh
            1800              ; Retry
            604800            ; Expire
            60 )              ; Minimum TTL

@       IN  NS   ns1.domain.local.
ns1     IN  A    127.0.0.1

@           IN  A    127.0.0.1
ganymede    IN  A    127.0.0.1
*           IN  A    127.0.0.1
EOF
```

**Deleting a zone file:**

```bash
# Automated by delete-env.sh
sudo rm -f /etc/coredns/zones/domain.local.zone
```

**CoreDNS Configuration (`/etc/coredns/Corefile`):**

```
# Serve zone files for each environment domain
domain.local. {
    file /etc/coredns/zones/domain.local.zone
    log
    errors
}

test.local. {
    file /etc/coredns/zones/test.local.zone
    log
    errors
}

# Forward everything else to upstream DNS
. {
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

---

## Host OS Configuration

### Windows 11

**Step 1: Identify Network Adapter**

```powershell
# Find your active network adapter
Get-NetAdapter | Where-Object {$_.Status -eq "Up"}
```

Look for the adapter connected to the internet (usually "Ethernet" or "Wi-Fi").

**Step 2: Configure DNS**

```powershell
# Set dev container IP as primary DNS (replace "Ethernet" with your adapter name)
Set-DnsClientServerAddress -InterfaceAlias "Ethernet" -ServerAddresses "127.0.0.1","8.8.8.8"

# Verify
Get-DnsClientServerAddress -InterfaceAlias "Ethernet"
```

**Step 3: Flush DNS Cache**

```powershell
ipconfig /flushdns
```

**Step 4: Test**

```powershell
# Test local domain (should return 127.0.0.1)
nslookup ganymede.domain.local

# Test external domain (should work via fallback)
nslookup github.com
```

**To Revert:**

```powershell
# Reset to DHCP (automatic)
Set-DnsClientServerAddress -InterfaceAlias "Ethernet" -ResetServerAddresses
```

---

### macOS

**Step 1: Configure DNS**

```bash
# Set DNS servers (System Settings → Network → Your Connection → DNS)
# Or via command line:
networksetup -setdnsservers "Wi-Fi" 127.0.0.1 8.8.8.8
```

**Step 2: Flush DNS Cache**

```bash
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder
```

**Step 3: Test**

```bash
# Test local domain
dig @127.0.0.1 ganymede.domain.local

# Test external domain
dig github.com
```

**To Revert:**

```bash
# Reset to DHCP
networksetup -setdnsservers "Wi-Fi" "Empty"
```

---

### Linux

**Step 1: Configure DNS (systemd-resolved)**

```bash
# Edit resolved.conf
sudo nano /etc/systemd/resolved.conf
```

```ini
[Resolve]
DNS=127.0.0.1 8.8.8.8
```

```bash
# Restart resolved
sudo systemctl restart systemd-resolved
```

**Step 2: Test**

```bash
# Test local domain
dig @127.0.0.1 ganymede.domain.local

# Test external domain
dig github.com
```

**To Revert:**

```bash
# Comment out DNS line in /etc/systemd/resolved.conf
sudo systemctl restart systemd-resolved
```

---

## Verification and Troubleshooting

### Test DNS Resolution

**From Host OS:**

```bash
# Windows
nslookup ganymede.domain.local
nslookup org-abc123.domain.local
nslookup github.com

# macOS/Linux
dig @127.0.0.1 ganymede.domain.local
dig @127.0.0.1 org-abc123.domain.local +short
dig github.com +short
```

**Expected results:**

- `ganymede.domain.local` → `127.0.0.1`
- `org-abc123.domain.local` → `127.0.0.1` (wildcard)
- `github.com` → Public IP (via upstream DNS)

### Check CoreDNS Status

**In dev container:**

```bash
# Check if CoreDNS is running
ps aux | grep coredns

# Check CoreDNS logs
journalctl -f | grep coredns  # If using systemd
# OR just watch the process output

# Test DNS directly
dig @127.0.0.1 ganymede.domain.local

# List zone files
ls -la /etc/coredns/zones/
```

### Common Issues

#### Issue: `nslookup domain.local` fails

**Solution:**

1. Check CoreDNS is running:

   ```bash
   ps aux | grep coredns
   ```

2. Check zone file exists:

   ```bash
   ls -la /etc/coredns/zones/domain.local.zone
   ```

3. Check CoreDNS Corefile:

   ```bash
   cat /etc/coredns/Corefile
   ```

4. Restart CoreDNS:
   ```bash
   sudo killall coredns
   cd /root/workspace/monorepo/scripts/local-dev
   ./setup-coredns.sh
   ```

#### Issue: External DNS not working

**Solution:**

1. Check CoreDNS forwarding configuration:

   ```bash
   cat /etc/coredns/Corefile
   ```

2. Ensure fallback DNS is configured:

   ```bash
   # Should forward to 8.8.8.8, 8.8.4.4
   ```

3. Check host OS DNS fallback:

   ```bash
   # Windows
   Get-DnsClientServerAddress

   # macOS
   networksetup -getdnsservers "Wi-Fi"

   # Linux
   cat /etc/resolv.conf
   ```

#### Issue: Wildcard not working

**Solution:**

1. Check zone file has wildcard record:

   ```bash
   cat /etc/coredns/zones/domain.local.zone | grep "^\\*"
   ```

2. Should see:

   ```
   *           IN  A    127.0.0.1
   ```

3. Test wildcard explicitly:
   ```bash
   dig @127.0.0.1 random-subdomain.domain.local +short
   # Should return: 127.0.0.1
   ```

#### Issue: DNS works in container but not from host OS

**Solution:**

1. Check host OS DNS configuration:

   ```bash
   # Windows
   Get-DnsClientServerAddress

   # macOS
   networksetup -getdnsservers "Wi-Fi"

   # Linux
   cat /etc/resolv.conf
   ```

2. Flush DNS cache:

   ```bash
   # Windows
   ipconfig /flushdns

   # macOS
   sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder

   # Linux
   sudo systemd-resolve --flush-caches
   ```

3. Check firewall:
   ```bash
   # Ensure port 53 (UDP/TCP) is not blocked
   sudo ss -tulnp | grep :53
   ```

---
