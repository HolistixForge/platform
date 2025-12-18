# Production Deployment Guide

> **⚠️ FUTURE WORK REFERENCE** - This document is for **planning and reference only**
>
> **Status:** 📋 Analysis complete, implementation NOT started  
> **Purpose:** Reference material for future production deployment implementation  
> **Last Updated:** 2025-01-17
>
> **🚧 IMPORTANT NOTES:**
>
> 1. **DNS Architecture Simplified:** See [GitHub Issue #30](https://github.com/Hol

istixForge/platform/issues/30) - PowerDNS has been replaced with CoreDNS file plugin ✅ COMPLETED

> 2. **Not Production Ready:** Scripts and procedures need to be created and tested
> 3. **Architecture May Evolve:** Recommendations here based on current dev setup, may change
> 4. **Use for Planning:** Use this as a reference when implementing production deployment

---

## 📋 Table of Contents

### Quick Reference

1. [Executive Summary](#executive-summary)
2. [Key Decisions](#key-decisions)
3. [Development vs Production Comparison](#development-vs-production-comparison)
4. [Implementation Roadmap](#implementation-roadmap)

### Detailed Analysis

5. [Architecture Analysis](#architecture-analysis)
6. [Component-by-Component Breakdown](#component-by-component-breakdown)
7. [Security Considerations](#security-considerations)
8. [Deployment Procedures (Future)](#deployment-procedures-future)
9. [Operations & Maintenance](#operations--maintenance)
10. [Cost & Resource Planning](#cost--resource-planning)

---

## Executive Summary

This document provides comprehensive analysis and planning for Holistix Forge production deployment on Ubuntu VPS. The analysis shows that **85% of development scripts and 90% of architecture can be reused** for production with minimal adaptation.

### Key Findings

**Good News:**

- ✅ Development environment designed with production parity in mind
- ✅ Most scripts work with minor modifications
- ✅ Architecture is production-ready
- ✅ Main differences are **simplifications** (fewer components in production)

**Important Caveats:**

- ⚠️ DNS architecture is changing (see [Issue #30](https://github.com/HolistixForge/platform/issues/30))
- ⚠️ Production scripts need to be created
- ⚠️ Full deployment testing required
- ⚠️ Security hardening needs implementation

### Deployment Strategy

**Approach:** Maximize reuse from development setup, implement only necessary differences.

**Main Differences:**

1. ❌ No dev container - Install directly on Ubuntu VPS
2. ✅ DNS: CoreDNS with static zone files on port 53 (simplified per [#30](https://github.com/HolistixForge/platform/issues/30))
3. ✏️ SSL: Let's Encrypt with DNS-01 challenge (instead of mkcert)
4. ➕ systemd services for process management
5. ➕ Security hardening (firewall, SSH, passwords)
6. ➕ Monitoring alerts and automated backups

---

## Key Decisions

### Decision 1: Direct Install (No Dev Container) ✅

**Recommendation:** Install services directly on Ubuntu VPS

**Reasoning:**

- Dev container provides no functional benefit in production
- Simplifies operations and debugging
- Better performance (no container overhead)
- Standard Linux administration tools

**Impact:** Need to adapt scripts that assume container environment

---

### Decision 2: DNS Architecture ✅ SIMPLIFIED

> **✅ COMPLETED:** [Issue #30](https://github.com/HolistixForge/platform/issues/30) has been implemented.

**Recommendation:** CoreDNS with file plugin and wildcard DNS

**Reasoning:**

- Static zone files with wildcard DNS (`*.domain`)
- No database required for DNS
- No dynamic DNS operations needed
- Simpler architecture and easier to maintain
- Production has domain delegation (simpler than dev)

**Implementation:**

- Use CoreDNS with `file` plugin
- Create static zone file with wildcard record
- All subdomains resolve via wildcard (`*.yourdomain.com`)
- No PowerDNS, no PostgreSQL for DNS

**Impact:** Much simpler DNS setup than originally planned

---

### Decision 3: Let's Encrypt SSL ✅

**Recommendation:** Let's Encrypt with DNS-01 challenge for wildcard certificates

**Reasoning:**

- Free and fully automated
- Wildcard support (critical for dynamic gateways/containers)
- Industry standard
- Automatic renewal

**Requirements:**

- DNS provider API access (Cloudflare, Route53, etc.)
- Certbot with DNS plugin

**Impact:** Need DNS provider API credentials

---

### Decision 4: Pre-Built Artifacts ✅

**Recommendation:** Build locally or in CI/CD, deploy artifacts only

**Reasoning:**

- No source code on production server
- Faster deployments
- No build tools needed on production
- Better security

**Impact:** Need deployment pipeline or local build process

---

### Decision 5: systemd Services ✅

**Recommendation:** Use systemd for all service management

**Reasoning:**

- Auto-restart on crash
- Start on boot
- Resource limits
- Standard logging (journalctl)
- Standard operations (systemctl)

**Impact:** Need to create systemd service files

---

## Development vs Production Comparison

### Quick Reference Table

| Component            | Development            | Production      | Changes Required                       |
| -------------------- | ---------------------- | --------------- | -------------------------------------- |
| **Host Environment** | Dev Container (Ubuntu) | Ubuntu VPS      | ❌ Remove container layer              |
| **PostgreSQL**       | `apt install`          | `apt install`   | ✅ Same install<br>✏️ Harden config    |
| **Nginx**            | `apt install`          | `apt install`   | ✅ Same install<br>➕ Security headers |
| **DNS**              | CoreDNS (zone files)   | CoreDNS (same)  | ✅ Same setup, just update zone domain |
| **SSL**              | mkcert                 | Let's Encrypt   | ✏️ Change SSL automation               |
| **Services**         | Manual start           | systemd         | ➕ Create service files                |
| **Node.js**          | NodeSource 24.x        | NodeSource 24.x | ✅ Same                                |
| **Docker**           | Docker Desktop         | Docker Engine   | ✅ Same (for gateways)                 |
| **Monitoring**       | Optional               | Required        | ✅ Same stack + alerts                 |

### DNS Architecture Comparison

> **✅ NOTE:** Architecture simplified per [Issue #30](https://github.com/HolistixForge/platform/issues/30).

| Aspect          | Development          | Production           |
| --------------- | -------------------- | -------------------- |
| **Tiers**       | Single-tier          | Single-tier          |
| **DNS Servers** | CoreDNS (zone files) | CoreDNS (zone files) |
| **Port**        | 53 (CoreDNS)         | 53 (CoreDNS)         |
| **Database**    | None for DNS         | None for DNS         |
| **Dynamic DNS** | No (wildcard)        | No (wildcard)        |
| **Complexity**  | Very Low             | Very Low             |

**Why Same?**

- Both use CoreDNS with static zone files
- Both use wildcard DNS (`*.domain`)
- No database or dynamic operations needed
- Production just uses real domain instead of `.local`

### SSL/TLS Comparison

| Aspect               | Development         | Production                  |
| -------------------- | ------------------- | --------------------------- |
| **Tool**             | mkcert              | Let's Encrypt (certbot)     |
| **Certificate Type** | Self-signed         | Trusted CA                  |
| **Wildcard**         | ✅ `*.domain.local` | ✅ `*.your-domain.com`      |
| **Challenge**        | N/A                 | DNS-01 (for wildcard)       |
| **Renewal**          | Never expires       | Auto-renew every 90 days    |
| **Client Trust**     | Manual CA install   | Automatic (browser trusted) |
| **Cost**             | Free                | Free                        |

### Service Management Comparison

| Aspect               | Development             | Production         |
| -------------------- | ----------------------- | ------------------ |
| **Ganymede**         | Manual `node main.js &` | systemd service    |
| **DNS**              | Manual start            | systemd service    |
| **Nginx**            | System service          | systemd service    |
| **Auto-start**       | ❌ Manual               | ✅ On boot         |
| **Restart on Crash** | ❌ No                   | ✅ Yes             |
| **Resource Limits**  | ❌ None                 | ✅ systemd limits  |
| **Logging**          | Files                   | journalctl + files |

### Security Comparison

| Aspect               | Development        | Production                      |
| -------------------- | ------------------ | ------------------------------- |
| **Firewall**         | ❌ Not configured  | ✅ ufw with strict rules        |
| **SSH**              | Default            | ✅ Hardened (no root, key-only) |
| **DB Password**      | `devpassword`      | Strong random (32 chars)        |
| **DB User**          | postgres superuser | ✅ Limited app user             |
| **SSL/TLS**          | Self-signed        | Trusted CA                      |
| **Rate Limiting**    | ❌ None            | ✅ Nginx limits                 |
| **Security Headers** | ❌ None            | ✅ X-Frame, CSP, etc.           |
| **Auto Updates**     | Manual             | ✅ unattended-upgrades          |

---

## Implementation Roadmap

### Phase 1: Core Infrastructure (Week 1)

**Goal:** Get VPS ready with basic services

**Tasks:**

- [ ] Provision Ubuntu 24.04 VPS
- [ ] Configure SSH hardening
- [ ] Setup firewall (ufw)
- [ ] Configure DNS at domain registrar
- [ ] Install Node.js, PostgreSQL, Nginx, Docker
- [ ] Setup Let's Encrypt SSL

**Deliverables:**

- Accessible VPS with hardened SSH
- Domain pointing to VPS
- SSL certificate working
- Core dependencies installed

**Estimated Time:** 8 hours (+ 24-48h DNS propagation wait)

---

### Phase 2: Script Adaptation (Week 2)

**Goal:** Create production-specific scripts

**Tasks:**

- [x] ✅ DNS architecture simplified ([Issue #30](https://github.com/HolistixForge/platform/issues/30) completed)
- [ ] Create `scripts/production/setup-production.sh`
- [ ] Create systemd service files
- [ ] Adapt `create-env.sh` for production
- [ ] Create `scripts/production/deploy.sh`
- [ ] Create backup scripts
- [ ] Document all procedures

**Deliverables:**

- Production setup script
- Production environment creation script
- Deployment automation
- Backup automation
- systemd service templates

**Estimated Time:** 16 hours

---

### Phase 3: Deployment & Testing (Week 3)

**Goal:** Deploy and verify full stack

**Tasks:**

- [ ] Build application artifacts
- [ ] Run production setup
- [ ] Create production environment
- [ ] Deploy artifacts
- [ ] Start services
- [ ] Test all functionality
- [ ] Fix issues
- [ ] Security audit

**Deliverables:**

- Working production deployment
- Test results documentation
- Issue tracking for bugs

**Estimated Time:** 24 hours

---

### Phase 4: Operations Setup (Week 4)

**Goal:** Production-ready operations

**Tasks:**

- [ ] Configure Grafana alerts
- [ ] Setup external uptime monitoring
- [ ] Test backup/restore procedures
- [ ] Create runbooks
- [ ] Load testing
- [ ] Disaster recovery plan
- [ ] CI/CD integration

**Deliverables:**

- Monitoring and alerting configured
- Tested backup/restore procedures
- Operational runbooks
- CI/CD pipeline

**Estimated Time:** 24 hours

**Total Timeline:** ~4 weeks

---

## Architecture Analysis

### What We Have (Development)

**Components:**

- Main dev container (Ubuntu 24.04)
- PostgreSQL database
- CoreDNS (port 53) with static zone files
- Nginx for SSL and routing
- Ganymede API (Express.js)
- Gateway pool (Docker containers)
- User containers (Docker)
- Monitoring stack (Grafana, Loki, Tempo)

**Strengths:**

- ✅ Complete local development environment
- ✅ Production parity in architecture
- ✅ Comprehensive automation scripts
- ✅ Well-documented setup

**Production Gaps:**

- ⚠️ mkcert SSL (need Let's Encrypt)
- ⚠️ Manual process management (need systemd)
- ⚠️ Weak security defaults
- ⚠️ No monitoring alerts
- ⚠️ No automated backups

### Component Reusability Matrix

| Component        | Reusability | Notes                         |
| ---------------- | ----------- | ----------------------------- |
| PostgreSQL setup | 85%         | Add hardening steps           |
| DNS (CoreDNS)    | 95%         | Just update zone domain       |
| Nginx config     | 85%         | Change SSL paths, add headers |
| Ganymede app     | 95%         | No code changes               |
| Gateway pool     | 100%        | Works as-is                   |
| Frontend build   | 100%        | No changes                    |
| Monitoring       | 100%        | Add alerts                    |

**Overall Reusability: 85%**

---

## Component-by-Component Breakdown

### PostgreSQL

**Development:**

- Installed via `apt install postgresql`
- Default configuration
- Weak password (`devpassword`)
- Superuser used directly

**Production Adaptations:**

1. ✅ Keep `apt install postgresql` (same)
2. ✏️ Generate strong random password
3. ✏️ Create limited application user (already in `create-env.sh`!)
4. ➕ Configure connection limits
5. ➕ Enable SSL/TLS for connections
6. ➕ Setup automated backups
7. ➕ Add monitoring

**Script Impact:**

- `setup-postgres.sh` - Add hardening (85% reusable)
- `create-env.sh` - Already creates app user ✅

---

### DNS (✅ Simplified)

> **✅ COMPLETED:** [Issue #30](https://github.com/HolistixForge/platform/issues/30) has been implemented.

**Current Architecture:**

- CoreDNS with file plugin on port 53
- Static zone files with wildcard DNS (`*.yourdomain.com`)
- No PowerDNS, no database for DNS
- Simple and maintainable

**Production Setup:**

1. Configure DNS zone delegation at your registrar (point NS records to VPS)
2. Install CoreDNS on VPS
3. Create zone file with wildcard record
4. All subdomains automatically resolve via wildcard

---

### Nginx

**Development:**

- SSL termination with mkcert
- Proxy to Ganymede and gateways
- Basic configuration

**Production Adaptations:**

1. ✏️ Use Let's Encrypt SSL certificates
2. ➕ Add security headers (X-Frame-Options, CSP, etc.)
3. ➕ Add rate limiting
4. ➕ Add gzip compression
5. ✅ Keep proxy configuration (same)
6. ✅ Keep dynamic gateway configs (same)

**Security Headers:**

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline';" always;
```

**Reusability: 85%**

---

### Ganymede (API Server)

**Development:**

- Runs manually via `node main.js &`
- Logs to file
- No restart on crash

**Production Adaptations:**

1. ✏️ Run via systemd service
2. ✏️ Use production environment variables
3. ➕ Add resource limits (systemd MemoryMax, CPUQuota)
4. ➕ Add security sandboxing (systemd directives)
5. ✅ Keep application code (no changes needed)
6. ✅ Keep database schema (no changes)

**systemd Service Example:**

```ini
[Service]
Type=simple
User=holistix
WorkingDirectory=/opt/holistix/prod
EnvironmentFile=/opt/holistix/prod/.env.ganymede

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true

# Resources
MemoryMax=2G
CPUQuota=200%

# Restart
Restart=on-failure
RestartSec=5s

ExecStart=/usr/bin/node dist/packages/app-ganymede/main.js
```

**Reusability: 95%**

---

### Gateway Pool

**Development:**

- Docker containers
- HTTP build distribution
- Dynamic allocation

**Production Adaptations:**

1. ✅ Keep Docker containers (same)
2. ✅ Keep allocation logic (same)
3. ✏️ Use pre-built artifacts instead of HTTP distribution
4. ➕ Add container health checks
5. ➕ Add resource limits (Docker `--memory`, `--cpus`)
6. ✅ Keep lifecycle management (same)

**Reusability: 95%**

---

### Frontend

**Development:**

- Built with Vite
- Served by Nginx
- Hot reload in dev mode

**Production Adaptations:**

1. ✅ Keep Vite build process (same)
2. ✏️ Build with `--configuration=production`
3. ➕ Add cache headers in Nginx
4. ➕ Add CDN integration (optional)
5. ✅ Keep Nginx serving (same)

**Reusability: 95%**

---

## Security Considerations

### Firewall Configuration

**Required Ports:**

```bash
# SSH
ufw allow 22/tcp

# HTTP/HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# DNS
ufw allow 53/tcp
ufw allow 53/udp

# Block everything else
ufw default deny incoming
ufw default allow outgoing

ufw enable
```

### SSH Hardening

```bash
# /etc/ssh/sshd_config
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3
LoginGraceTime 20
```

### Database Security

**Strong Passwords:**

```bash
# Generate 32-character random password
DB_PASSWORD=$(openssl rand -base64 32)
```

**Limited Privileges:**

```sql
-- App user has only necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES TO app_user;
-- No CREATE, DROP, or user management
```

**SSL Enforcement:**

```conf
# PostgreSQL: require SSL for all connections
ssl = on
```

### Secrets Management

**DO NOT:**

- ❌ Commit secrets to git
- ❌ Store in plain text

**DO:**

- ✅ Use environment files with 0600 permissions
- ✅ Store in `/etc/holistix/secrets/`
- ✅ Consider secret management tools (Vault, AWS Secrets Manager)

### Rate Limiting

```nginx
# Nginx rate limiting
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

location / {
    limit_req zone=api burst=20;
}
```

---

## Deployment Procedures (Future)

> **⚠️ NOTE:** These procedures are for reference only. They need to be tested and refined before use.

### Prerequisites

**VPS Requirements:**

- Ubuntu 24.04 LTS
- 4 vCPU, 8GB RAM, 100GB SSD (minimum)
- Static public IP
- Cost: ~$40-50/month

**Domain Requirements:**

- Owned domain name (e.g., `example.com`)
- DNS registrar access (Cloudflare, Namecheap, GoDaddy, etc.)
- Ability to configure NS (Name Server) records or A records for delegation
- Note: You'll configure NS records to point to your VPS, making it the authoritative DNS server for your domain

**DNS Provider API:**

- Cloudflare (recommended)
- Route 53 (AWS)
- Or other certbot-supported provider

### Deployment Steps (High-Level)

1. **VPS Provisioning**

   - Create VPS instance
   - Configure SSH hardening
   - Setup firewall

2. **DNS Configuration**

   - **DNS Zone Delegation** - Configure at domain registrar level
     - Point your domain's NS (Name Server) records to your VPS IP address
     - Done in your domain registrar's dashboard (e.g., Cloudflare, Namecheap, GoDaddy)
     - Example: If your domain is `example.com`, create an A record for `ns.example.com` pointing to your VPS IP, then set `ns.example.com` as the nameserver
     - Alternative: Some registrars allow direct IP-based delegation
   - Wait for DNS propagation (24-48 hours typical)

3. **Application Setup**

   - Install dependencies
   - Setup PostgreSQL
   - Setup CoreDNS with zone files
   - Setup Let's Encrypt

4. **Environment Creation**

   - Build applications
   - Create production environment
   - Configure systemd services

5. **Verification**

   - Test DNS resolution
   - Test HTTPS
   - Test API
   - Test frontend

6. **Operations Setup**
   - Configure monitoring
   - Setup backups
   - Configure alerts

**Detailed procedures:** Create after testing deployment.

---

## Operations & Maintenance

### Monitoring

**Components to Monitor:**

- System metrics (CPU, RAM, disk, network)
- Application metrics (API requests, response times)
- Database metrics (connections, queries)
- Gateway pool status
- Container metrics

**Tools:**

- Grafana (dashboards)
- Loki (logs)
- Tempo (traces)
- OTLP Collector
- UptimeRobot (external uptime)

**Alert Rules:**

- Gateway pool exhausted
- Disk usage > 80%
- High memory usage
- SSL certificate expiring (< 30 days)
- API errors > threshold

### Backups

**What to Backup:**

- PostgreSQL databases (all `ganymede_*`)
- Organization data (`org-data/` directory)
- Nginx configurations
- Environment files (`.env.*`)
- SSL certificates (auto-renewed, but backup for safety)

**Backup Schedule:**

- Daily backups at 2 AM
- Keep last 7 days
- Weekly backups kept for 4 weeks
- Monthly backups kept for 12 months

**Backup Script (Example):**

```bash
#!/bin/bash
BACKUP_DIR="/opt/holistix/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Backup PostgreSQL
pg_dump ganymede_prod | gzip > "$BACKUP_DIR/postgres/ganymede_prod_${DATE}.sql.gz"

# Backup org-data
tar -czf "$BACKUP_DIR/org-data/org-data_${DATE}.tar.gz" /opt/holistix/prod/org-data/

# Cleanup old backups
find "$BACKUP_DIR" -mtime +7 -delete
```

### Common Operations

**Deploy Updates:**

```bash
# Build locally
npx nx run-many --target=build --all --configuration=production
tar -czf holistix-$(git rev-parse --short HEAD).tar.gz dist/

# Deploy to VPS
scp holistix-*.tar.gz holistix@VPS:/tmp/
ssh holistix@VPS "cd /opt/holistix/prod && tar -xzf /tmp/holistix-*.tar.gz"
ssh holistix@VPS "systemctl restart ganymede@prod"
```

**Scale Gateway Pool:**

```bash
# Add 5 more gateways
ENV_NAME=prod DOMAIN=your-domain.com \
  ./scripts/local-dev/gateway-pool.sh create 5 /opt/holistix/monorepo
```

**View Logs:**

```bash
# System logs
journalctl -u ganymede@prod -f

# Application logs
tail -f /opt/holistix/prod/logs/ganymede.log

# Gateway logs
docker logs -f gw-pool-0
```

---

## Cost & Resource Planning

### VPS Cost Estimates

**Minimum (testing):**

- 2 vCPU, 4GB RAM, 50GB SSD
- $15-25/month
- Suitable for: Testing, small deployment

**Recommended (production):**

- 4 vCPU, 8GB RAM, 100GB SSD
- $35-50/month
- Suitable for: Production, 10-50 users

**High Performance:**

- 8 vCPU, 16GB RAM, 200GB SSD
- $80-120/month
- Suitable for: Large deployment, 100+ users

### Resource Distribution (8GB VPS)

```
PostgreSQL:     2GB
Ganymede:       2GB
Gateway Pool:   3GB (10 gateways @ 300MB each)
User Containers: 1GB (2-4 containers)
System:         1GB (OS overhead)
```

### Storage Planning

```
Application:     500MB (dist + node_modules)
PostgreSQL:     1-5GB (depends on usage)
Logs:           1-2GB (with rotation)
Backups:        5-10GB (7 days of DB backups)
User Data:      Variable (org-data files)
Total:          ~10-20GB typical
```

### Bandwidth Estimation

**Per User Per Day:**

- Initial load: ~2MB (frontend bundle)
- WebSocket: ~1MB (collaboration)
- API requests: ~1MB

**Example: 100 active users:**

- Daily: ~400MB
- Monthly: ~12GB
- Well within typical 4TB bandwidth limits

---

## Script Reusability Summary

### Scripts That Work As-Is (100%)

- `install-node.sh` - Node.js installation
- `build-images.sh` - Gateway Docker image
- `gateway-pool.sh` - Gateway pool management
- `envctl-monitor.sh` - Environment monitoring
- `build-frontend.sh` - Frontend build

### Scripts Needing Minor Changes (85-95%)

- `setup-postgres.sh` - Add hardening steps
- `create-env.sh` - Replace mkcert with Let's Encrypt, adapt paths
- `envctl.sh` - Add systemd support
- `install-system-deps.sh` - Minor tweaks

### Scripts That Work in Production (with minor changes)

- `setup-coredns.sh` - Works for production (just update domain)
- `update-coredns.sh` - Works for production (zone file management)

### Scripts Not Needed in Production

- `install-mkcert.sh` - Using Let's Encrypt instead

### New Scripts Needed

- `scripts/production/setup-production.sh` - Main production setup
- `scripts/production/setup-letsencrypt.sh` - SSL automation
- `scripts/production/create-systemd-services.sh` - Service files
- `scripts/production/harden-system.sh` - Security hardening
- `scripts/production/deploy.sh` - Deployment automation
- `scripts/production/backup-all.sh` - Backup automation
- `scripts/production/restore.sh` - Disaster recovery
- `scripts/production/health-check.sh` - Deep health check

---

## Timeline Estimates

### Development Setup (First Time)

- Create dev container: 10 min
- Run `setup-all.sh`: 15-20 min
- Create environment: 5 min
- Build frontend: 5 min
- Configure host DNS: 10 min
- **Total: 45-50 minutes**

### Production Setup (Estimated)

- Provision VPS: 10 min
- DNS delegation: 5 min (+ 24-48h wait)
- SSH & security: 30 min
- Run production setup: 20-30 min
- SSL certificate: 5 min
- Create environment: 10 min
- Deploy artifacts: 10 min
- Testing: 30 min
- Monitoring setup: 30 min
- **Total: 2.5-3 hours** (+ DNS propagation wait)

---

## Risk Assessment

### Development Risks (Low)

- Dev container crash → Restart
- Data loss → Not production data
- Security breach → Local network only

### Production Risks (High)

| Risk                | Impact | Mitigation                       |
| ------------------- | ------ | -------------------------------- |
| VPS crash           | HIGH   | Monitoring + alerts + backups    |
| Database corruption | HIGH   | Daily backups + replication      |
| Security breach     | HIGH   | Hardening + updates + monitoring |
| SSL expiry          | MEDIUM | Auto-renewal + alerts            |
| DNS failure         | MEDIUM | Health checks                    |
| Disk full           | MEDIUM | Monitoring + log rotation        |
| Gateway exhaustion  | MEDIUM | Pool size alerts                 |

---

## Next Steps

### Before Starting Implementation

1. ✅ **Read this document** - Understand architecture and decisions
2. ✅ **DNS Simplified** - Issue #30 completed, architecture ready
3. 📋 **Create GitHub issue** - Track production deployment work
4. 🧪 **Plan testing strategy** - How to verify deployment

### Implementation Order

1. **Phase 1:** Core infrastructure (VPS, security, dependencies)
2. **Phase 2:** Script adaptation (DNS architecture ready)
3. **Phase 3:** Deployment testing (staging environment)
4. **Phase 4:** Operations setup (monitoring, backups)

### Success Criteria

- [ ] Production deployment works end-to-end
- [ ] All services auto-start on boot
- [ ] Monitoring and alerts configured
- [ ] Backups tested and working
- [ ] Security audit passed
- [ ] Load testing passed
- [ ] Documentation complete

---

## Conclusion

The Holistix Forge local development environment is **remarkably production-ready**. The main work required is:

1. **Wait for DNS simplification** (Issue #30)
2. **Remove dev container layer** (install directly)
3. **Add Let's Encrypt SSL** (instead of mkcert)
4. **Create systemd services** (proper management)
5. **Implement security hardening** (firewall, SSH, etc.)
6. **Setup operations** (monitoring, backups, alerts)

**Key Insight:** 85% of development work transfers to production. With DNS simplification complete (Issue #30), the architecture is production-ready. The main task is creating and testing the production-specific scripts and procedures.

---

## Related Documentation

- [Local Development Guide](./LOCAL_DEVELOPMENT.md) - Development environment setup
- [DNS Complete Guide](./DNS_COMPLETE_GUIDE.md) - DNS architecture details
- [Gateway Architecture](../architecture/GATEWAY_ARCHITECTURE.md) - Gateway system design
- [System Architecture](../architecture/SYSTEM_ARCHITECTURE.md) - Overall system design
- [GitHub Issue #30](https://github.com/HolistixForge/platform/issues/30) - DNS simplification

---

**Document Status:** 📋 Planning/Reference Only  
**Implementation Status:** Not started - DNS architecture ready (Issue #30 ✅)  
**Next Action:** Create GitHub issue to track implementation work  
**Maintainer:** Core team
