# Production Deployment

> ⚠️ **Work in Progress** - This guide is not yet ready.

Production deployment documentation is planned but not yet written.

For now, please refer to:
- [Architecture Overview](../architecture/OVERVIEW.md) - System design
- [System Architecture](../architecture/SYSTEM_ARCHITECTURE.md) - Complete architecture diagram
- [Local Development](LOCAL_DEVELOPMENT.md) - Development environment setup

---

## DNS Configuration (Production)

**Note:** Production DNS setup is simpler than local development. The local development setup uses CoreDNS and PowerDNS on port 5300 because it needs to handle both local domains and external DNS forwarding. In production, this complexity is not needed.

### Production DNS Architecture

In production:

1. **DNS Zone Delegation** - Configured at the domain registrar level
   - Point your domain's NS (Name Server) records to your VPS IP address
   - This is done in your domain registrar's dashboard (e.g., Cloudflare, Namecheap, GoDaddy)
   - Example: If your domain is `example.com`, configure NS records to point to your VPS

2. **PowerDNS** - Listens directly on port 53
   - No CoreDNS needed (external DNS is handled by the registrar/upstream DNS)
   - PowerDNS is authoritative for your domain only
   - Port 53 is exposed directly (no port 5300)
   - Configuration: `local-port=53` in PowerDNS config

3. **No DNS Forwarding Required**
   - External DNS queries (github.com, etc.) are handled by the system's default DNS resolver
   - Only your domain queries go to PowerDNS
   - No need for CoreDNS or conditional forwarding

### Setup Steps (Planned)

1. **Configure DNS Zone Delegation**
   - In your domain registrar dashboard, set NS records to point to your VPS IP
   - Wait for DNS propagation (usually 24-48 hours)

2. **Configure PowerDNS**
   - PowerDNS listens on port 53 (standard DNS port)
   - No CoreDNS installation needed
   - PowerDNS handles only your domain's DNS queries

3. **Firewall Configuration**
   - Ensure port 53 (UDP/TCP) is open for DNS queries
   - Ensure port 443 (HTTPS) is open for web traffic

### Differences from Local Development

| Aspect | Local Development | Production |
|--------|------------------|------------|
| **DNS Forwarder** | CoreDNS (required) | Not needed |
| **PowerDNS Port** | 5300 (internal) | 53 (standard) |
| **External DNS** | Handled by CoreDNS | Handled by system DNS |
| **DNS Configuration** | Windows/macOS/Linux host setup | Domain registrar NS records |
| **Complexity** | Two-tier (CoreDNS + PowerDNS) | Single-tier (PowerDNS only) |

---

**Status:** 🚧 Not yet documented  
**Priority:** Medium  
**ETA:** TBD
