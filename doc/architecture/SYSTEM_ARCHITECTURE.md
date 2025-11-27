# Demiurge Platform - System Architecture

**Complete architecture diagram combining infrastructure, components, and data flow.**

---

## Complete System Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                               User's Browser                                  │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                    Frontend (React + Vite)                              │  │
│  │  - Whiteboard (React Flow)                                              │  │
│  │  - Real-time sync (WebSocket)                                           │  │
│  │  - Module system (pluggable UI components)                              │  │
│  │  - Authentication UI                                                     │  │
│  └────┬────────────────────────────────────────────┬────────────────────────┘  │
└───────┼────────────────────────────────────────────┼───────────────────────────┘
        │ HTTPS (REST API)                           │ WebSocket (Collaboration)
        │                                             │
┌───────▼─────────────────────────────────────────────▼───────────────────────┐
│                            Docker Host                                       │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │           Main Development Container (Ubuntu 24.04)                     │ │
│  │                                                                          │ │
│  │  ╔════════════════════════════════════════════════════════════════╗    │ │
│  │  ║         Nginx (Stage 1) - Ports 80/443                          ║    │ │
│  │  ║  - SSL Termination (wildcard *.domain.local cert)              ║    │ │
│  │  ║  - Routes:                                                      ║    │ │
│  │  ║    • domain.local → Frontend (static files)                    ║    │ │
│  │  ║    • ganymede.domain.local → Ganymede :6000                    ║    │ │
│  │  ║    • org-{uuid}.domain.local → Gateway pool :7100-7199         ║    │ │
│  │  ║    • *.org-{uuid}.domain.local → Gateway pool (user containers)║    │ │
│  │  ╚═══════╤════════════════════════════════════════════════════════╝    │ │
│  │          │                                                               │ │
│  │  ┌───────▼───────────┐     ┌─────────────────────────────┐             │ │
│  │  │  Frontend         │     │  Ganymede API :6000          │             │ │
│  │  │  (Static Files)   │     │  (Express.js + TypeScript)   │             │ │
│  │  │  Built with Vite  │     │                               │             │ │
│  │  └───────────────────┘     │  Responsibilities:            │             │ │
│  │                            │  • User authentication        │             │ │
│  │                            │  • Organizations/Projects     │             │ │
│  │                            │  • Gateway allocation         │             │ │
│  │                            │  • PowerDNS updates           │             │ │
│  │                            │  • Nginx config management    │             │ │
│  │                            │  • Org data storage           │             │ │
│  │                            │  ┌──────────────────┐         │             │ │
│  │                            │  │  Docker Client   │         │             │ │
│  │                            │  │  (via socket)    │         │             │ │
│  │                            │  └────────┬─────────┘         │             │ │
│  │                            └───────────┼───────────────────┘             │ │
│  │                                        │                                  │ │
│  │  ┌─────────────────────┐   ┌──────────▼──────────────────┐              │ │
│  │  │  PowerDNS :53       │   │  PostgreSQL :5432            │              │ │
│  │  │  API :8081          │   │                              │              │ │
│  │  │                     │   │  Databases:                  │              │ │
│  │  │  - DNS server       │   │  • ganymede_dev_001          │              │ │
│  │  │  - REST API         │   │    - users, passwords        │              │ │
│  │  │  - Dynamic records  │   │    - organizations           │              │ │
│  │  │                     │   │    - projects                │              │ │
│  │  │  Database: pdns ────┼───┼─▶│    - gateways              │              │ │
│  │  │  (PostgreSQL)       │   │    - sessions, oauth_*       │              │ │
│  │  └─────────────────────┘   │  • pdns (PowerDNS schema)   │              │ │
│  │                             └─────────────────────────────┘              │ │
│  │                                                                           │ │
│  │  Volumes:                                                                │ │
│  │  • /var/run/docker.sock (host Docker socket)                            │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
│                                     │                                         │
│                                     │ Bind Mount                             │
│                                     │ (parent of monorepo)                   │
│                                     │ → /home/dev/workspace                  │
│  ┌──────────────────────────────────┴──────────────────────────────────────┐ │
│  │                Gateway Pool (Docker Containers)                          │ │
│  │                Managed by Ganymede via Docker socket                     │ │
│  │                                                                           │ │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐      │ │
│  │  │   gw-pool-0      │  │   gw-pool-1      │  │   gw-pool-2      │      │ │
│  │  │   HTTP: 7100     │  │   HTTP: 7101     │  │   HTTP: 7102     │      │ │
│  │  │   VPN: 49100/udp │  │   VPN: 49101/udp │  │   VPN: 49102/udp │      │ │
│  │  ├──────────────────┤  ├──────────────────┤  ├──────────────────┤      │ │
│  │  │  State: READY    │  │  State: ALLOCATED│  │  State: READY    │      │ │
│  │  │  (idle)          │  │  (org-abc123)    │  │  (idle)          │      │ │
│  │  ├──────────────────┤  ├──────────────────┤  ├──────────────────┤      │ │
│  │  │ app-gateway      │  │ app-gateway      │  │ app-gateway      │      │ │
│  │  │ (Express + Yjs)  │  │ (Express + Yjs)  │  │ (Express + Yjs)  │      │ │
│  │  │                  │  │                  │  │                  │      │ │
│  │  │ • Collab engine  │  │ • Collab engine  │  │ • Collab engine  │      │ │
│  │  │ • Permissions    │  │ • Permissions    │  │ • Permissions    │      │ │
│  │  │ • OAuth provider │  │ • OAuth provider │  │ • OAuth provider │      │ │
│  │  │ • Container mgmt │  │ • Container mgmt │  │ • Container mgmt │      │ │
│  │  │                  │  │                  │  │                  │      │ │
│  │  │ Nginx (Stage 2)  │  │ Nginx (Stage 2)  │  │ Nginx (Stage 2)  │      │ │
│  │  │ • Proxy to user  │  │ • Proxy to user  │  │ • Proxy to user  │      │ │
│  │  │   containers     │  │   containers     │  │   containers     │      │ │
│  │  │                  │  │                  │  │                  │      │ │
│  │  │ OpenVPN Server   │  │ OpenVPN Server   │  │ OpenVPN Server   │      │ │
│  │  │ • 172.16.x.x/16  │  │ • 172.16.x.x/16  │  │ • 172.16.x.x/16  │      │ │
│  │  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘      │ │
│  │           │ VPN                  │ VPN                  │ VPN            │ │
│  │  Shared workspace via bind mount:                                        │ │
│  │  /home/dev/workspace/monorepo (from parent directory bind mount)         │ │
│  │  Hot-reload: watches .gateway-reload-trigger file                        │ │
│  │  State in PostgreSQL: gateways.ready, organizations_gateways             │ │
│  └───────────┬──────────────────────┬──────────────────────┬───────────────┘ │
│              │                      │                      │                 │
│  ┌───────────▼──────────┐  ┌────────▼─────────┐  ┌────────▼─────────┐      │
│  │  jupyter-abc         │  │  vscode-def      │  │  pgadmin-ghi     │      │
│  │  User Container      │  │  User Container  │  │  User Container  │      │
│  │                      │  │                  │  │                  │      │
│  │  VPN IP: 172.16.1.2  │  │  VPN: 172.16.1.3 │  │  VPN: 172.16.1.4 │      │
│  │  URL: uc-abc.org-*   │  │  URL: uc-def.*   │  │  URL: uc-ghi.*   │      │
│  │  .domain.local       │  │  .domain.local   │  │  .domain.local   │      │
│  │                      │  │                  │  │                  │      │
│  │  OAuth client via    │  │  OAuth client    │  │  OAuth client    │      │
│  │  gateway             │  │  via gateway     │  │  via gateway     │      │
│  └──────────────────────┘  └──────────────────┘  └──────────────────┘      │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

Access URLs (from host OS browser via DNS delegation):
  https://domain.local                          → Frontend
  https://ganymede.domain.local                 → Ganymede API
  https://org-{org-uuid}.domain.local           → Gateway (allocated)
  https://uc-{container-uuid}.org-{org-uuid}.domain.local → User container
```

---

## Diagram Breakdown

### Layer 1: User's Browser

- **Frontend (React + Vite)** - Single-page application
  - Whiteboard using React Flow
  - WebSocket connection to Gateway for real-time collaboration
  - HTTPS REST API calls to Ganymede
  - Module system for extensibility

### Layer 2: Main Development Container

- **Nginx (Stage 1)** - SSL termination and routing
  - Wildcard SSL cert (`*.domain.local`) handles all subdomains
  - Routes to Frontend (static), Ganymede (API), Gateway pool (dynamic)
- **Ganymede API** - Central orchestrator
  - User/org/project management
  - Gateway allocation from pool
  - PowerDNS updates (DNS records)
  - Nginx config management (dynamic server blocks)
  - Centralized data storage for organizations
- **PowerDNS** - Dynamic DNS server
  - Installed via apt, uses PostgreSQL backend
  - REST API on port 8081
  - Manages all domain records programmatically
- **PostgreSQL** - Two databases
  - `ganymede_{env}` - Application data
  - `pdns` - PowerDNS records
- **Docker Client** - Manages gateway containers via mounted socket

### Layer 3: Gateway Pool (Containers)

- **Multiple gateway containers** (`gw-pool-0`, `gw-pool-1`, ...)
  - Allocated to organizations on-demand
  - State managed in PostgreSQL (`ready` flag)
  - Shared workspace via bind mount (hot-reload, supports multiple repos)
- **Each Gateway Contains:**
  - **app-gateway** (Express.js + Yjs)
    - Real-time collaboration engine (CRDT)
    - Event processing (reducer pattern)
    - Permission validation
    - OAuth2 provider for container apps
    - Container lifecycle management
  - **Nginx (Stage 2)** - Proxy to user containers
  - **OpenVPN Server** - VPN for user containers (172.16.x.x/16)

### Layer 4: User Containers

- **Docker containers** started by users
  - JupyterLab, pgAdmin, VSCode, n8n, custom images
  - Connected to gateway via VPN (private IPs)
  - Accessible via stable DNS URLs
  - Authenticate via gateway OAuth2 provider

---
