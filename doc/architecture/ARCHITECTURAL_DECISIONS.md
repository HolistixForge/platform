# Architectural Decisions

## 🏗️ ARCHITECTURE

### Process 1: app-ganymede (Orchestrator)

**Role:** Lightweight, always-on API for users, orgs, projects

**Database (PostgreSQL):**

```
users, passwords, totp, magic_links, sessions (5)
organizations, organizations_members (2)
projects, projects_members (2)
gateways, organizations_gateways (2)
Total: 11 tables
```

**Endpoints (~30 routes):**

- Auth: signup, login, logout, OAuth providers (github, gitlab, etc.)
- Users: search, by-id, me
- Organizations: CRUD, members
- Projects: CRUD, members
- Gateway: start, config, ready, stop

**Stack:** Express.js, Passport.js, PostgreSQL

---

### Process 2: app-gateway (Gateway, per-org)

**Role:** Heavyweight, per-organization collaborative backend

**State Management:**

1. **Shared State (Yjs CRDT)** - Synced via WebSocket

   - Containers (runtime data: IP, services, status)
   - Graph nodes/edges (whiteboard)
   - Chat messages
   - Tabs, spaces, etc.

2. **Non-Shared State (JSON)** - Not synced, local only
   - Permissions (org, project, container levels)
   - OAuth clients (for container apps)
   - OAuth tokens (access + refresh)

**Features:**

- OAuth2 server (for JupyterLab, pgAdmin, etc.)
- Permission validation (all events)
- Container management (create, host, delete)
- VPN server (org-wide 172.16.0.0/16)
- Nginx reverse proxy
- Collaborative editing

**Stack:** Express.js, Yjs, y-websocket, OpenVPN, Nginx

---

## 🗄️ DATA STORAGE STRATEGY

**Key Principle:** If users need to browse it without gateway running → ganymede Database

| Data                  | Storage                  | Why                     |
| --------------------- | ------------------------ | ----------------------- |
| Users, Orgs, Projects | Database                 | Browse without gateway  |
| Org/Project Members   | Database                 | Manage access offline   |
| Containers            | Gateway Shared State     | Runtime data, real-time |
| Permissions           | Gateway Non-Shared State | Frequent checks, cached |
| OAuth                 | Gateway Non-Shared State | Container lifecycle     |

**Example Flow:**

```
User opens app
  ↓
Lists organizations (DB) ✅ No gateway needed
  ↓
Lists org projects (DB) ✅ No gateway needed
  ↓
Opens project → Starts gateway if not running
  ↓
Gateway loads → Shows containers (Shared State)
  ↓
Real-time collaboration active
```

---

## 🔑 KEY ARCHITECTURAL DECISIONS

### 1. Gateway Per Organization (Not Per Project)

**Reason:** Stable URLs, org-wide VPN, resource efficiency

**Benefits:**

- Containers can communicate across projects (same VPN)
- One gateway process serves multiple projects

**Implications:**

- WebSocket clients specify project_id for scoping

### 2. Projects in Database (Not Gateway State)

**Reason:** Users need to browse projects even when gateway is offline

**Benefits:**

- Can list projects without starting gateway
- Can manage project members without gateway

**Trade-off:**

- Project metadata in DB, container runtime data in gateway

### 3. Permissions in Gateway Non-Shared State

**Reason:** Checked on every event, need fast access, no DB bottleneck

**Benefits:**

- Real-time permission checks
- No database queries per event

### 5. No Personal Projects

**Reason:** Simplify architecture, every project in an org

**Implementation:**

- Auto-create default org on user signup
- Org name: `{username}-org`
- User is owner of default org
