# Documentation Audit Report - Multi-Gateway Architecture

**Date:** 2025-11-12  
**Context:** Before implementing multi-gateway architecture (GATEWAY_ARCHITECTURE.md)  
**Purpose:** Identify overlaps, conflicts, and opportunities for consolidation

---

## Executive Summary

After reviewing all documentation, I found:

- **7 documents** need updates after implementation
- **3 documents** contain valuable information to integrate
- **4 documents** can potentially be merged
- **2 architecture diagrams** should be unified
- **1 document** (DNS comparison) is already referenced and good

---

## 1. Documents That NEED UPDATES After Implementation

### 1.1 `doc/guides/LOCAL_DEVELOPMENT.md` ⚠️ HIGH PRIORITY

**Current State:** Documents single-gateway setup in dev container (not containerized)

**Conflicts with new architecture:**

- Uses `{env}.local` domains instead of `domain.local` with `org-{uuid}` subdomains
- Gateway runs directly in dev container (not in Docker containers)
- No PowerDNS setup
- No gateway pool concept
- No Docker socket mounting
- /etc/hosts editing instead of DNS delegation

**What needs updating:**

- Complete rewrite following GATEWAY_ARCHITECTURE.md
- Add PowerDNS setup section
- Add Docker socket setup
- Add named volume setup
- Add gateway pool creation
- Update domain structure
- Add host OS DNS delegation guides (Windows/Mac/Linux)
- Remove /etc/hosts workflow
- Update architecture diagram to match new design

**Additional info in this doc:**

- ✅ Detailed host OS setup guides (Windows/Mac/Linux) - keep these
- ✅ mkcert CA installation per platform - keep and update
- ✅ envctl.sh usage examples - keep
- ✅ Port allocation explanation - keep
- ✅ Multiple workspace examples - keep

**Recommendation:** Complete rewrite, preserve useful sections (host OS guides)

---

### 1.2 `doc/guides/PRODUCTION_DEPLOYMENT.md` ⚠️ MEDIUM PRIORITY

**Current State:** Very basic, incomplete, mentions old app-account

**Conflicts:**

- References app-account (deleted, merged into ganymede)
- Manual Docker postgres setup
- Manual nginx config
- No gateway pool concept
- No PowerDNS setup
- References NFS mounting (decided to remove)

**What needs updating:**

- Remove app-account references
- Document that prod = dev (same scripts!)
- Add PowerDNS setup
- Add Let's Encrypt automation
- Add gateway pool setup
- Simplify (most info already in GATEWAY_ARCHITECTURE.md Phase 8)

**Recommendation:** Rewrite as short document saying "same as dev, use Let's Encrypt for SSL, see GATEWAY_ARCHITECTURE.md"

---

### 1.3 `docker-images/backend-images/gateway/README.md` ⚠️ HIGH PRIORITY

**Current State:** Documents gateway Docker image with NFS mounting

**Conflicts:**

- Documents NFS mounting (decided to remove)
- Uses old domain structure `gw-{instance}-{id}.{env}.{domain}`
- Missing: named volumes approach
- Missing: pool-based allocation
- Missing: no SSL in gateway

**What needs updating:**

- Remove NFS mounting sections
- Update to named volumes
- Update domain structure to `org-{uuid}.domain.local`
- Document that gateway does plain HTTP (no SSL)
- Document pool-based architecture
- Update Dockerfile to use explicit reload trigger

**Additional info:**

- ✅ host-install scripts - may still be useful for understanding
- ✅ Port calculation formulas

**Recommendation:** Significant update to match new architecture

---

### 1.4 `scripts/local-dev/README.md` ⚠️ LOW PRIORITY

**Current State:** Quick reference for local dev scripts

**What needs updating:**

- Add new scripts: `build-images.sh`, `setup-powerdns.sh`, `gateway-pool.sh`
- Update `create-env.sh` usage (add domain parameter)
- Update `envctl.sh` (add gateway pool commands)
- Update file locations (add `/org-data/`, `/gateway-pool/`)

**Recommendation:** Minor updates, add new script references

---

### 1.5 `doc/reference/API.md` ⚠️ LOW PRIORITY

**Current State:** REST API documentation

**Conflicts:**

- Gateway base URL shows old structure
- Missing new `/gateway/data/push` and `/gateway/data/pull` endpoints

**What needs updating:**

- Update Gateway base URL: `https://org-{uuid}.{domain}` (not `https://gateway.{org-id}.{env}.{domain}`)
- Add new gateway data endpoints
- Add user container domain structure: `uc-{uuid}.org-{uuid}.domain.local`

**Recommendation:** Minor updates to base URLs and add new endpoints

---

### 1.6 `doc/architecture/OVERVIEW.md` ⚠️ MEDIUM PRIORITY

**Current State:** High-level architecture overview (good!)

**Conflicts:**

- Architecture diagram shows single gateway (not pool)
- Container creation flow mentions database storage (now Yjs + Ganymede API)
- Missing: PowerDNS
- Missing: Gateway pool concept
- Missing: 2-stage nginx routing

**What needs updating:**

- Update architecture diagram to show:
  - PowerDNS
  - Gateway pool
  - Ganymede handles allocation/DNS/Nginx
  - 2-stage nginx routing
- Update container creation flow (step 11-12 about DNS registration)
- Add gateway data storage section (Ganymede API)

**Additional info (valuable!):**

- ✅ Excellent data flow diagrams - keep and update
- ✅ Authentication flow - keep as-is
- ✅ Project collaboration flow - minor updates needed
- ✅ Key architectural patterns section - keep

**Recommendation:** Update diagrams and flows, preserve architectural pattern sections

---

### 1.7 `doc/internal/AI-summary.md` ⚠️ LOW PRIORITY

**Current State:** Quick AI context document

**What needs updating:**

- Update architecture diagram (simple text-based)
- Add PowerDNS
- Add gateway pool concept
- Update "Stable container URLs" to mention org-based subdomains

**Recommendation:** Minor updates to reflect new architecture

---

## 2. Documents with VALUABLE INFORMATION to Integrate

### 2.1 `doc/archive/2024-container-refactor/DNS_SERVER_COMPARISON.md` ✅ ALREADY REFERENCED

**Status:** Already referenced in GATEWAY_ARCHITECTURE.md

**Valuable info:**

- ✅ Detailed comparison of DNS solutions
- ✅ PowerDNS rationale
- ✅ Integration code examples
- ✅ API usage examples

**Recommendation:** Keep as-is, already linked from GATEWAY_ARCHITECTURE.md

---

### 2.2 `doc/archive/2024-container-refactor/CONTAINER_FEATURE_DESIRED_IMPLEMENTATION.md`

**Valuable information:**

- Module-defined container images (ImageRegistry concept)
- Detailed container lifecycle flows
- Slug generation for stable URLs
- HTTP service registration patterns
- Nginx update mechanisms

**Overlap with GATEWAY_ARCHITECTURE.md:**

- Container domain structure (updated in new arch)
- DNS registration (updated approach)
- Module image definitions (still relevant!)

**Recommendation:**

- Keep for container image registry implementation (future phase)
- Update container URL structure to match new arch: `uc-{uuid}.org-{uuid}.domain.local`
- Mark sections about DNS as "superseded by GATEWAY_ARCHITECTURE.md"

---

### 2.3 `doc/architecture/GATEWAY_IMPLEMENTATION_PLAN.md`

**Status:** Implementation plan for gateway internal architecture (GatewayState, PermissionManager, etc.)

**Valuable information:**

- ✅ Detailed task breakdown (78 tasks in 7 phases)
- ✅ Class responsibilities (GatewayState, PermissionManager, OAuthManager)
- ✅ Storage layout (`/data/gateway-state-{org_id}.json`, `/data/project-{id}/`)
- ✅ Code structure and file organization
- ✅ Implementation order and dependencies

**Overlap with GATEWAY_ARCHITECTURE.md:**

- Storage location (MULTI_GATEWAY now uses Ganymede API)
- Gateway initialization (both docs cover this)

**Conflicts:**

- GATEWAY_IMPLEMENTATION_PLAN stores data locally in `/data/`
- GATEWAY_ARCHITECTURE stores data centrally in Ganymede

**Recommendation:**

- Update storage sections to use Ganymede API approach
- Otherwise keep as complementary doc (internal gateway implementation)
- MULTI_GATEWAY = deployment architecture
- GATEWAY_IMPLEMENTATION_PLAN = internal code architecture

---

## 3. Potential Document MERGES

### 3.1 MERGE: Production + Local Development? ❌ NO

**Recommendation:** Keep separate

- LOCAL_DEVELOPMENT.md is comprehensive (794 lines)
- PRODUCTION_DEPLOYMENT.md should be simple reference
- Different audiences (developers vs DevOps)
- After implementation, PRODUCTION should just say: "Same as LOCAL_DEVELOPMENT.md, use Let's Encrypt"

---

### 3.2 MERGE: GATEWAY_ARCHITECTURE + LOCAL_DEVELOPMENT? ⚠️ MAYBE LATER

**Recommendation:** Keep separate initially, consider merge after implementation stabilizes

**Rationale:**

- MULTI_GATEWAY = comprehensive design document (2100+ lines)
- LOCAL_DEVELOPMENT = user-facing setup guide (~800 lines)
- Different purposes:
  - MULTI_GATEWAY = "why and how it works" (architecture decisions)
  - LOCAL_DEVELOPMENT = "how to use it" (step-by-step guide)

**Future option:**

- After implementation, extract "Quick Start" from MULTI_GATEWAY into LOCAL_DEVELOPMENT
- Keep MULTI_GATEWAY as architecture/design doc in `doc/architecture/`
- Or rename to LOCAL_DEVELOPMENT.md and move current one to archive

---

### 3.3 MERGE: Gateway README files? ✅ YES

**Files:**

- `docker-images/backend-images/gateway/README.md` (Install Host doc)
- `packages/app-gateway/README.md` (Application README)

**Recommendation:** After implementation:

- Update `packages/app-gateway/README.md` with new architecture
- Keep `docker-images/backend-images/gateway/README.md` for Docker image specifics
- Both should reference GATEWAY_ARCHITECTURE.md for details

---

### 3.4 MERGE: scripts/local-dev/README + LOCAL_DEVELOPMENT? ❌ NO

**Recommendation:** Keep separate

- scripts/local-dev/README.md is quick reference table
- LOCAL_DEVELOPMENT.md is comprehensive guide
- Different use cases (quick lookup vs learning)

---

## 4. Architecture Diagrams to UNIFY

### 4.1 Multiple ASCII Diagrams Found

**Locations:**

1. `doc/guides/GATEWAY_ARCHITECTURE.md` - NEW comprehensive diagram with PowerDNS, gateway pool
2. `doc/guides/LOCAL_DEVELOPMENT.md` - Current dev setup diagram (single gateway)
3. `doc/architecture/OVERVIEW.md` - High-level 3-tier diagram
4. `doc/internal/AI-summary.md` - Simple text diagram
5. `README.md` (root) - Marketing/overview diagram

**Recommendation:** After implementation, create unified diagram showing:

```
┌─────────────────────────────────────────────────────────────────┐
│                          Browser                                 │
│  Frontend (React) ──HTTPS──▶ domain.local                       │
│                    ──WS────▶ org-{uuid}.domain.local            │
└──────────────────────────────────────┬──────────────────────────┘
                                       │
                         ┌─────────────┴──────────────┐
                         │    PowerDNS (DNS)          │
                         │    All *.domain.local       │
                         │    → 127.0.0.1              │
                         └─────────────┬──────────────┘
                                       │
┌──────────────────────────────────────┴──────────────────────────┐
│              Main Dev Container (demiurge-dev)                   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Nginx (Stage 1) - Port 443                               │  │
│  │  SSL Termination + Routing                                │  │
│  │  - domain.local → Frontend                                │  │
│  │  - ganymede.domain.local → Ganymede:6000                  │  │
│  │  - org-{uuid}.domain.local → Gateway pool:710X            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌─────────────┐  ┌────────────────┐  ┌──────────────────┐    │
│  │  Ganymede   │  │  PostgreSQL    │  │  PowerDNS        │    │
│  │  :6000      │─▶│  :5432         │─▶│  :53, :8081     │    │
│  │             │  │  - Ganymede DB │  │  REST API        │    │
│  │  Allocates  │  │  - pdns DB     │  └──────────────────┘    │
│  │  gateways   │  └────────────────┘                           │
│  │  Updates DNS│                                                │
│  │  Stores data│                                                │
│  └─────────────┘                                                │
│                                                                   │
│  Volumes: demiurge-workspace (named), /var/run/docker.sock     │
└───────────────────────────────────────────────────────────────┘
│
├─────────────────────────────────────────────────────────────┐
│            Gateway Pool (Docker Containers)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ gw-pool-0    │  │ gw-pool-1    │  │ gw-pool-2    │     │
│  │ HTTP:7100    │  │ HTTP:7101    │  │ HTTP:7102    │     │
│  │ VPN:49100    │  │ VPN:49101    │  │ VPN:49102    │     │
│  │              │  │              │  │              │     │
│  │ State: READY │  │ State: ALLOC │  │ State: READY │     │
│  │              │  │ Org: uuid-b  │  │              │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                 │                 │               │
│         └─────────────────┴─────────────────┘               │
│                    Volume: demiurge-workspace                │
└─────────────────────────────────────────────────────────────┘
│
└─────────────────────────────────────────────────────────────┐
              User Containers (VPN connected)                  │
  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
  │ jupyter-abc  │  │ pgadmin-def  │  │ vscode-ghi   │       │
  │ (org-uuid-b) │  │ (org-uuid-a) │  │ (org-uuid-b) │       │
  │ VPN→gw-pool-1│  │ VPN→gw-pool-0│  │ VPN→gw-pool-1│       │
  └──────────────┘  └──────────────┘  └──────────────┘       │
                                                                │
  Access: uc-{uuid}.org-{uuid}.domain.local                   │
└─────────────────────────────────────────────────────────────┘
```

**Use this for:**

- GATEWAY_ARCHITECTURE.md (keep current detailed diagram)
- LOCAL_DEVELOPMENT.md (use simplified version)
- OVERVIEW.md (update high-level version)

---

### 1.3 `docker-images/backend-images/gateway/README.md`

**Current content:**

- Gateway Docker image documentation
- host-install scripts documentation
- NFS mounting instructions
- Old domain structure

**Needs updating:**

- Remove NFS sections (decided against)
- Update domain structure: `org-{uuid}.domain.local`
- Add named volume mounting
- Document pool-based architecture
- Update entrypoint docs (reload trigger file)
- No SSL in gateway

---

### 1.4 `scripts/local-dev/README.md`

**Current content:**

- Quick reference table for all scripts
- envctl.sh command reference
- File locations

**Needs updating:**

- Add new scripts to table:
  - `build-images.sh` - Build Docker images
  - `setup-powerdns.sh` - Install PowerDNS
  - `gateway-pool.sh` - Manage gateway pool
- Update `create-env.sh` usage (domain parameter)
- Update file locations:
  - Add `/org-data/` - Organization data storage
  - Add `/gateway-pool/` - Gateway pool state
- Update envctl.sh commands (if we add gateway pool commands)

---

### 1.5 `doc/architecture/GATEWAY_IMPLEMENTATION_PLAN.md`

**Current content:**

- Internal gateway code implementation (GatewayState, PermissionManager, etc.)
- 78 tasks in 7 phases
- Detailed class designs

**Needs updating:**

- ⚠️ **Storage location conflict:** Currently uses `/data/gateway-state-{org_id}.json`
  - Should be updated to use Ganymede API push/pull
  - Or clarify that `/data/` is temporary, pushed to Ganymede
- Update initialization flow to include data pull from Ganymede
- Update shutdown flow to include data push to Ganymede
- Add note about pool-based allocation (gateway can serve multiple orgs sequentially)

**Recommendation:** Update storage sections, add Ganymede API integration notes

---

### 1.6 `doc/reference/API.md`

**Current content:**

- REST API endpoint reference
- Base URLs
- Authentication methods

**Needs updating:**

- Gateway base URL: Update to `org-{uuid}.domain.local` (not `gateway.{org-id}.{env}.{domain}`)
- Add new endpoints:
  - `POST /gateway/data/push`
  - `POST /gateway/data/pull`
- Update container URL examples to `uc-{uuid}.org-{uuid}.domain.local`

---

### 1.7 `doc/internal/AI-summary.md`

**Current content:**

- Quick context for AI assistants
- Simple architecture diagram
- Key files list

**Needs updating:**

- Update architecture diagram to include PowerDNS
- Add gateway pool concept
- Update container URLs
- Add gateway allocation logic (in Ganymede, not separate service)

---

## 3. Documents with ADDITIONAL INFORMATION to Integrate

### 3.1 `doc/archive/2024-container-refactor/CONTAINER_FEATURE_DESIRED_IMPLEMENTATION.md`

**Valuable sections:**

**Module-Defined Container Images:**

- Image registry system
- Module API extension for containerImages
- TContainerImageDefinition type
- Automatic image registration from modules

**This is INDEPENDENT of gateway pooling!**

- Can be implemented separately
- Complements new architecture
- Should be preserved

**Container lifecycle details:**

- Slug generation algorithm
- OAuth client creation per service
- Service registration patterns

**Recommendation:**

- Keep this document
- Mark DNS sections as "Superseded by GATEWAY_ARCHITECTURE.md"
- Reference from MULTI_GATEWAY as "Phase 9: Container Image Registry (future)"
- Update container URL structure to `uc-{uuid}.org-{uuid}.domain.local`

---

### 3.2 `doc/architecture/REFACTORING.md`

**Valuable sections:**

- Database schema documentation
- Key architectural decisions
- Organization-centric model explanation
- Gateway per organization rationale

**Status:** Mostly about database and app structure, not deployment

**Overlap:** Gateway allocation per org (covered in GATEWAY_ARCHITECTURE)

**Recommendation:**

- Keep as-is (complementary)
- Cross-reference with GATEWAY_ARCHITECTURE.md
- Add note in "Gateway Per Organization" section about pool-based allocation

---

### 3.3 `doc/guides/MODULES_TESTING.md`

**Status:** Module development and testing guide

**Overlap:** None (different topic)

**Recommendation:** No changes needed (orthogonal concern)

---

## 4. Current Domain/URL Structure INCONSISTENCIES

### Issue: Multiple Domain Structures in Docs

**Current documented structures:**

1. **LOCAL_DEVELOPMENT.md:** `{env}.local`, `ganymede.{env}.local`, `gateway.{env}.local`
2. **PRODUCTION_DEPLOYMENT.md:** `ganymede.dev-002.demiurge.co`, `account.dev-002.demiurge.co`
3. **docker-images/backend-images/gateway/README.md:** `gw-{instance}-{id}.{env}.{domain}`
4. **OVERVIEW.md:** `{slug}.containers.domain.com`
5. **GATEWAY_ARCHITECTURE.md (NEW):** `domain.local`, `org-{uuid}.domain.local`, `uc-{uuid}.org-{uuid}.domain.local`

**Resolution needed:** After implementation, update all docs to use new structure

---

## 5. Obsolete/Archive Documents

### 5.1 `doc/archive/2024-container-refactor/`

**Files:**

- CONTAINER_FEATURE_CODE_MAP.md
- CONTAINER_FEATURE_CURRENT_IMPLEMENTATION.md
- CONTAINER_FEATURE_DESIRED_IMPLEMENTATION.md
- CONTAINER_FEATURE_TODO.md
- DNS_SERVER_COMPARISON.md ✅ (referenced, keep)

**Status:** Archive - historical context

**Action:**

- Keep DNS_SERVER_COMPARISON.md (referenced)
- Mark others as "Historical - see GATEWAY_ARCHITECTURE.md for current approach"
- Add README in this directory explaining status

---

### 5.2 `doc/archive/project-server-state-and-transition.md`

**Status:** Legacy document about old state machine

**Action:** Keep as archive (no updates needed)

---

## 6. Missing Documentation (To Add)

### 6.1 Host OS Setup Guides (Platform-Specific)

**Currently:** Scattered across LOCAL_DEVELOPMENT.md

**After implementation:** Should be comprehensive sections in LOCAL_DEVELOPMENT.md:

- Windows DNS delegation (Network Adapter settings)
- macOS DNS delegation (/etc/resolver/)
- Linux DNS delegation (systemd-resolved)
- mkcert CA installation per platform (already exists, keep)

---

### 6.2 Troubleshooting Guide

**Currently:** Missing

**Should include:**

- PowerDNS not starting
- Gateway pool empty
- DNS resolution failing
- SSL certificate errors
- Docker socket permission issues
- Gateway allocation failures

**Recommendation:** Add after implementation based on real issues

---

### 6.3 Migration Guide (Current → New Architecture)

**Currently:** Missing

**Should include:**

- How to migrate existing environments
- Backward compatibility notes
- What breaks
- How to run both architectures side-by-side during transition

**Recommendation:** Add before implementation rollout

---

## 7. Documentation Structure PROPOSAL

### Current Structure:

```
doc/
├── guides/
│   ├── LOCAL_DEVELOPMENT.md (needs major update)
│   ├── PRODUCTION_DEPLOYMENT.md (needs rewrite)
│   ├── GATEWAY_ARCHITECTURE.md (NEW - comprehensive)
│   ├── MODULES_TESTING.md (keep as-is)
│   └── NX_WORKSPACE.md (keep as-is)
├── architecture/
│   ├── OVERVIEW.md (needs diagram update)
│   ├── REFACTORING.md (minor update needed)
│   └── GATEWAY_IMPLEMENTATION_PLAN.md (storage update needed)
└── reference/
    ├── API.md (minor update)
    └── CHEATSHEET.md (keep as-is)
```

### Proposed After Implementation:

**Option A: Keep Separate (Recommended)**

```
doc/
├── guides/
│   ├── LOCAL_DEVELOPMENT.md (completely rewritten based on MULTI_GATEWAY)
│   ├── PRODUCTION_DEPLOYMENT.md (short ref to LOCAL_DEVELOPMENT + Let's Encrypt)
│   ├── MODULES_TESTING.md (unchanged)
│   ├── NX_WORKSPACE.md (unchanged)
│   └── TROUBLESHOOTING.md (NEW)
├── architecture/
│   ├── OVERVIEW.md (updated diagrams)
│   ├── GATEWAY_ARCHITECTURE.md (moved here from guides/)
│   ├── GATEWAY_IMPLEMENTATION_PLAN.md (updated storage)
│   └── REFACTORING.md (minor updates)
└── reference/
    ├── API.md (updated URLs)
    ├── CHEATSHEET.md (unchanged)
    └── MIGRATION_GUIDE.md (NEW)
```

**Option B: Merge into Single Dev Guide**

```
doc/
├── guides/
│   ├── LOCAL_DEVELOPMENT.md (mega-doc: setup + architecture + troubleshooting)
│   ├── PRODUCTION_DEPLOYMENT.md (short reference)
│   ├── MODULES_TESTING.md
│   └── NX_WORKSPACE.md
├── architecture/ (kept for deep dives)
└── reference/ (unchanged)
```

---

## 8. Specific Section Comparisons

### 8.1 Gateway Allocation Flow

**GATEWAY_ARCHITECTURE.md:**

- Comprehensive 7-step flow with pool allocation, DNS, Nginx
- Includes auto-deallocation (5min inactivity)
- Ganymede handles all orchestration

**OVERVIEW.md:**

- Simplified 10-step project collaboration flow
- No pool concept
- Gateway allocation abstracted

**Recommendation:** Keep OVERVIEW simple, reference MULTI_GATEWAY for details

---

### 8.2 DNS Management

**GATEWAY_ARCHITECTURE.md:**

- PowerDNS with existing PostgreSQL
- REST API integration
- Complete setup scripts

**DNS_SERVER_COMPARISON.md:**

- Detailed comparison of 4 DNS solutions
- Integration code examples
- Decision rationale

**LOCAL_DEVELOPMENT.md:**

- Currently uses /etc/hosts
- No DNS server

**Recommendation:**

- Keep DNS_SERVER_COMPARISON.md as reference
- Update LOCAL_DEVELOPMENT.md to use PowerDNS
- MULTI_GATEWAY has the implementation

---

### 8.3 SSL Certificates

**GATEWAY_ARCHITECTURE.md:**

- Centralized SSL in stage 1 nginx
- Wildcard cert `*.domain.local`
- Let's Encrypt for production

**LOCAL_DEVELOPMENT.md:**

- Detailed mkcert installation per platform
- Per-service certificates
- Good platform-specific guides

**Recommendation:**

- Preserve platform-specific mkcert guides from LOCAL_DEVELOPMENT
- Update to use wildcard cert `*.domain.local` instead of multiple certs
- Integrate Let's Encrypt automation from MULTI_GATEWAY

---

### 8.4 Docker Setup

**GATEWAY_ARCHITECTURE.md:**

- Docker socket mounting
- Named volumes
- Gateway pool containers

**LOCAL_DEVELOPMENT.md:**

- Basic dev container creation
- No Docker socket
- No named volumes

**docker-images/backend-images/gateway/README.md:**

- Gateway container with NFS or volume mount
- Port calculations
- Environment variables

**Recommendation:** Consolidate Docker setup in LOCAL_DEVELOPMENT.md using MULTI_GATEWAY approach

---

## 9. Summary of Required Updates (Priority Order)

### Immediate (Before Implementation Rollout)

1. **LOCAL_DEVELOPMENT.md** - Complete rewrite based on GATEWAY_ARCHITECTURE.md
2. **PRODUCTION_DEPLOYMENT.md** - Simplify to reference LOCAL_DEVELOPMENT + Let's Encrypt
3. **docker-images/backend-images/gateway/README.md** - Update for pool, remove NFS

### After Implementation

4. **doc/architecture/OVERVIEW.md** - Update diagrams to show PowerDNS, gateway pool, 2-stage nginx
5. **doc/architecture/GATEWAY_IMPLEMENTATION_PLAN.md** - Update storage to use Ganymede API
6. **doc/reference/API.md** - Update base URLs and add data endpoints
7. **scripts/local-dev/README.md** - Add new scripts to table

### Low Priority

8. **doc/internal/AI-summary.md** - Minor architecture diagram update
9. **doc/archive/2024-container-refactor/CONTAINER_FEATURE_DESIRED_IMPLEMENTATION.md** - Mark DNS sections as superseded

---

## 10. Information to PRESERVE

These sections contain valuable information that must be preserved during updates:

### From LOCAL_DEVELOPMENT.md:

- ✅ mkcert CA installation guides (Windows/Mac/Linux) - platform-specific steps
- ✅ envctl.sh usage examples
- ✅ Multiple workspace examples
- ✅ Port allocation explanation
- ✅ Environment file structure
- ✅ Troubleshooting tips (if any)

### From GATEWAY_IMPLEMENTATION_PLAN.md:

- ✅ GatewayState class design
- ✅ PermissionManager design
- ✅ OAuthManager design
- ✅ ProjectRoomsManager design
- ✅ 78-task implementation checklist
- ✅ Class responsibilities
- ✅ File structure plan

### From DNS_SERVER_COMPARISON.md:

- ✅ All content (already perfect, keep as-is)

### From OVERVIEW.md:

- ✅ Authentication flow (unchanged)
- ✅ Key architectural patterns (organization-centric, event-driven, etc.)
- ✅ Technology choices table
- ✅ Security model section

---

## 11. Documentation Consolidation Proposal

### After Implementation is Stable:

**Move GATEWAY_ARCHITECTURE.md to architecture/**

```
doc/architecture/GATEWAY_ARCHITECTURE.md (comprehensive design doc)
```

**Rewrite LOCAL_DEVELOPMENT.md as user-facing guide:**

- Quick start
- Prerequisites
- Step-by-step setup
- Host OS configuration (DNS delegation per platform)
- Using the system
- Troubleshooting
- Reference MULTI_GATEWAY for deep dives

**Simplify PRODUCTION_DEPLOYMENT.md:**

- "Follow LOCAL_DEVELOPMENT.md setup"
- "Use Let's Encrypt instead of mkcert"
- "Configure firewall rules"
- Done!

**Update cross-references:**

- Update doc/README.md hub to reference new structure
- Add GATEWAY_ARCHITECTURE to "Understand the System" section
- Update all internal doc links

---

## 12. Potential Issues / Conflicts

### 12.1 Gateway Data Storage Location

**Conflict:**

- GATEWAY_IMPLEMENTATION_PLAN.md: `/data/gateway-state-{org_id}.json` (local storage)
- GATEWAY_ARCHITECTURE.md: Ganymede API at `/root/.local-dev/{env}/org-data/{org-uuid}.json`

**Resolution:** Update GATEWAY_IMPLEMENTATION_PLAN to clarify:

- Gateway still uses `/data/` internally (temporary)
- But pushes to Ganymede API on autosave/shutdown
- Ganymede stores at `/root/.local-dev/{env}/org-data/{org-uuid}.json`

---

### 12.2 Gateway Hostname/FQDN

**Conflict:**

- Old docs: `gw-{instance}-{id}.{env}.{domain}` or `gateway.{env}.local`
- New arch: `org-{uuid}.domain.local`

**Resolution:** Global find-replace after implementation

---

### 12.3 Container URLs

**Conflict:**

- OVERVIEW.md: `{slug}.containers.domain.com`
- CONTAINER_FEATURE_DESIRED: `{slug}.containers.yourdomain.com`
- New arch: `uc-{uuid}.org-{uuid}.domain.local`

**Resolution:** Update all references to new structure

---

## 13. Documentation Quality Assessment

| Document                       | Completeness  | Accuracy            | Needs Update         |
| ------------------------------ | ------------- | ------------------- | -------------------- |
| GATEWAY_ARCHITECTURE.md        | ✅ Excellent  | ✅ Current          | ❌ No (just created) |
| LOCAL_DEVELOPMENT.md           | ✅ Good       | ⚠️ Outdated         | ✅ Major rewrite     |
| PRODUCTION_DEPLOYMENT.md       | ⚠️ Incomplete | ⚠️ Outdated         | ✅ Rewrite           |
| OVERVIEW.md                    | ✅ Good       | ✅ Mostly current   | ⚠️ Minor updates     |
| REFACTORING.md                 | ✅ Excellent  | ✅ Current          | ⚠️ Minor updates     |
| GATEWAY_IMPLEMENTATION_PLAN.md | ✅ Excellent  | ⚠️ Storage conflict | ⚠️ Update storage    |
| API.md                         | ✅ Good       | ⚠️ URLs outdated    | ⚠️ Minor updates     |
| DNS_SERVER_COMPARISON.md       | ✅ Excellent  | ✅ Current          | ❌ No                |
| scripts/local-dev/README.md    | ✅ Good       | ✅ Mostly current   | ⚠️ Add new scripts   |
| gateway/README.md              | ✅ Good       | ⚠️ NFS references   | ⚠️ Update for pool   |

---

## 14. Recommended Documentation Workflow

### Phase 1: Pre-Implementation

- [x] Create GATEWAY_ARCHITECTURE.md ✅ DONE
- [ ] Add note to LOCAL_DEVELOPMENT.md: "⚠️ This doc will be updated for multi-gateway architecture soon"

### Phase 2: During Implementation

- [ ] Update code comments to reference new architecture
- [ ] Keep GATEWAY_ARCHITECTURE.md updated with implementation learnings
- [ ] Document any deviations from the plan

### Phase 3: Post-Implementation

1. **Rewrite LOCAL_DEVELOPMENT.md** (top priority)
   - Use GATEWAY_ARCHITECTURE.md as source
   - Extract user-facing workflows
   - Preserve platform-specific guides
2. **Update PRODUCTION_DEPLOYMENT.md** (short doc)
   - Reference LOCAL_DEVELOPMENT.md
   - Add Let's Encrypt automation
3. **Update OVERVIEW.md** (update diagrams)
   - Add PowerDNS
   - Show gateway pool
   - Update container URLs
4. **Update GATEWAY_IMPLEMENTATION_PLAN.md** (storage)
   - Add Ganymede API push/pull
   - Clarify storage locations
5. **Update API.md** (URLs + endpoints)
   - New base URLs
   - New data endpoints
6. **Update docker-images/backend-images/gateway/README.md**
   - Remove NFS
   - Add pool architecture
7. **Update scripts/local-dev/README.md**
   - Add new scripts

### Phase 4: Polish

- [ ] Create TROUBLESHOOTING.md
- [ ] Create MIGRATION_GUIDE.md
- [ ] Update doc/README.md hub
- [ ] Add cross-references
- [ ] Review all diagrams for consistency

---

## 15. Final Recommendations

### Critical (Must Do)

1. ✅ **Keep GATEWAY_ARCHITECTURE.md** as the authoritative design document
2. ✅ **Rewrite LOCAL_DEVELOPMENT.md** after implementation (user-facing guide)
3. ✅ **Update all domain/URL references** to new structure
4. ✅ **Update architecture diagrams** consistently across all docs

### Important (Should Do)

5. ✅ **Update GATEWAY_IMPLEMENTATION_PLAN.md** storage sections
6. ✅ **Simplify PRODUCTION_DEPLOYMENT.md** (reference LOCAL_DEVELOPMENT)
7. ✅ **Add TROUBLESHOOTING.md** after implementation
8. ✅ **Update API.md** with new URLs and endpoints

### Nice to Have

9. ⚠️ **Create unified architecture diagram** template
10. ⚠️ **Add MIGRATION_GUIDE.md**
11. ⚠️ **Update archive docs** with "superseded" notices
12. ⚠️ **Cross-reference all related docs**

---

## 16. Questions for Consideration

1. **Should GATEWAY_ARCHITECTURE.md stay in guides/ or move to architecture/?**

   - Pros for architecture/: Design doc, comprehensive, technical
   - Pros for guides/: Includes implementation guide, practical

2. **Should we merge MULTI_GATEWAY into LOCAL_DEVELOPMENT after stabilization?**

   - Pros: Single source of truth
   - Cons: Very long document (2100+ lines + 800 lines = 2900 lines)

3. **What to do with gateway/README.md installation instructions?**

   - Still useful for understanding
   - But conflicts with pool approach
   - Keep updated or archive?

4. **How to handle GATEWAY_IMPLEMENTATION_PLAN.md storage conflict?**
   - Update to add Ganymede API layer
   - Or mark as "internal implementation detail"
   - Keep both approaches documented?

---

## Conclusion

**Total documents requiring updates: 7**
**Total documents to preserve: 4**
**Total new documents to create: 2-3**

**Estimated documentation update effort:** 8-12 hours (after implementation complete)

**The GATEWAY_ARCHITECTURE.md document is excellent and comprehensive.** It should become the authoritative source for the new architecture, with other docs updated to reference it and provide user-facing/platform-specific details.

**Key insight:** Most existing docs just need URL/domain updates and references to MULTI_GATEWAY. Only LOCAL_DEVELOPMENT.md needs a complete rewrite.
