# Archived Documentation

This folder contains historical documentation that has been superseded but is preserved for reference.

## 2024 Container Feature Refactoring

**Status:** Superseded by current implementation (see [../architecture/SYSTEM_ARCHITECTURE.md](../architecture/SYSTEM_ARCHITECTURE.md) and [../architecture/GATEWAY_ARCHITECTURE.md](../architecture/GATEWAY_ARCHITECTURE.md))

The container feature went through a major architectural redesign in 2024. These documents capture the planning phase and analysis:

### Planning Documents (`2024-container-refactor/`)

- **CONTAINER_FEATURE_TODO.md** - Original task breakdown (10-14 weeks, 750+ tasks)
  - Detailed phase-by-phase implementation plan
  - Module system extensions, DNS infrastructure, vocabulary changes
- **CONTAINER_FEATURE_CURRENT_IMPLEMENTATION.md** - Pre-refactor architecture

  - How container management worked before refactoring
  - Database-centric storage, hardcoded images, unstable URLs
  - Detailed technical documentation of legacy system

- **CONTAINER_FEATURE_DESIRED_IMPLEMENTATION.md** - Target architecture

  - Module-defined container images (no database)
  - Stable DNS-based URLs (PowerDNS)
  - User-containers terminology
  - Clean separation of concerns

- **CONTAINER_FEATURE_CODE_MAP.md** - File locations and migration plan

  - 85+ files involved in refactoring
  - Rename, update, and deletion mappings
  - Database schema changes

- **DNS_SERVER_COMPARISON.md** - Technical analysis
  - Comparison: BIND9 vs PowerDNS vs CoreDNS vs Technitium
  - Why PowerDNS was selected (enterprise-grade, REST API, persistent storage)
  - Integration examples and complexity analysis

### Why Archived

- ✅ Implementation complete (merged into main codebase)
- ✅ Current architecture documented in active docs
- ✅ Design decisions finalized and implemented

### Historical Value

- 📚 Shows evolution of container management design
- 🔍 Documents technical decision rationale (e.g., why PowerDNS over alternatives)
- 🧭 Useful for understanding legacy code references
- 📖 Provides context for future architectural discussions

---

## Old Server State Documentation

- **project-server-state-and-transition.md** - Pre-refactor server lifecycle
  - Documents: server hosting flow, cloud deployment, location management
  - Status: Obsolete (servers → user-containers, database → shared state)
  - Kept for reference when reviewing old code or understanding legacy behavior

---

## How to Use Archived Docs

1. **Understanding Past Decisions:** When questioning "why did we do X?", check archived planning docs
2. **Legacy Code Review:** When reviewing old branches or commits, use archived docs for context
3. **Future Refactoring:** Use as template for documenting major architectural changes
4. **Onboarding:** Show new team members how the system evolved

**Note:** For current architecture and implementation details, see the active documentation in `doc/architecture/`, `doc/guides/`, and `doc/reference/`.
