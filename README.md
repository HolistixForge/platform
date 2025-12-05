# Demiurge

> Real-time collaborative development platform with containerized applications

Demiurge is a collaborative workspace that combines real-time editing, whiteboard visualization, and user-managed containerized applications (JupyterLab, pgAdmin, n8n, etc.) in a single platform.

## ✨ Key Features

- **Real-time Collaboration** - Multi-user editing with YJS CRDT
- **Visual Workspace** - Interactive whiteboard with nodes, connections, and spaces
- **User Containers** - Deploy and manage containerized apps with stable URLs
- **Module System** - Extensible architecture with pluggable modules
- **Organization Management** - Multi-tenant with organization and project scoping
- **OAuth2 Provider** - Built-in authentication for container applications

## 🚀 Quick Start

**Local Development:**

```bash
# See comprehensive setup guide
👉 doc/guides/LOCAL_DEVELOPMENT.md
```

**Production Deployment:**

```bash
# See architecture documentation
👉 doc/architecture/OVERVIEW.md
```

## 📚 Documentation

**Main Hub:** [doc/README.md](doc/README.md)

Quick Links:

- 🏗️ [Architecture Overview](doc/architecture/OVERVIEW.md)
- 🚀 [Local Development](doc/guides/LOCAL_DEVELOPMENT.md)
- 🧪 [Module Testing](doc/guides/MODULES_TESTING.md)
- 📖 [Nx Workspace Guide](doc/guides/NX_WORKSPACE.md)
- ⚡ [Cheatsheet](doc/reference/CHEATSHEET.md)

## 🛠️ Tech Stack

**Frontend:**

- React, TypeScript, SCSS
- React Flow (whiteboard)
- Vite (bundler)

**Backend:**

- Node.js, Express, TypeScript
- Yjs (CRDT for collaboration)
- PostgreSQL (user/org/project data)
- WebSocket (real-time sync)

**Infrastructure:**

- Docker (containerization)
- Nginx (reverse proxy, SSL termination)
- OpenVPN (container networking)
- PowerDNS (stable container URLs)
- Nx (monorepo management)

## 🏗️ Architecture

\`\`\`
┌─────────────────────────────────────────────────────────────┐
│                     Demiurge Platform                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐     ┌──────────────┐                     │
│  │   Frontend   │────▶│   Ganymede   │  (User/Org/Project) │
│  │   (React)    │     │    (API)     │                     │
│  └──────┬───────┘     └──────────────┘                     │
│         │                                                    │
│         │ WebSocket                                          │
│         ▼                                                    │
│  ┌──────────────────────────────────────┐                  │
│  │          Gateway (per org)            │                  │
│  │  ┌────────────────────────────────┐  │                  │
│  │  │  Collab Engine (Yjs + modules) │  │                  │
│  │  │  - Permissions                  │  │                  │
│  │  │  - OAuth2 provider             │  │                  │
│  │  │  - Container management        │  │                  │
│  │  └────────────────────────────────┘  │                  │
│  │  ┌────────────────────────────────┐  │                  │
│  │  │  OpenVPN + Nginx Proxy         │  │                  │
│  │  └────────────────────────────────┘  │                  │
│  └──────────────┬───────────────────────┘                  │
│                 │                                            │
│                 ▼                                            │
│  ┌──────────────────────────────────────┐                  │
│  │      User Containers (Docker)         │                  │
│  │  - JupyterLab, pgAdmin, n8n, etc.   │                  │
│  │  - Stable DNS URLs                   │                  │
│  │  - VPN connected to gateway          │                  │
│  └──────────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
\`\`\`

See [doc/architecture/OVERVIEW.md](doc/architecture/OVERVIEW.md) for detailed architecture.

## 📦 Repository Structure

\`\`\`
monorepo/
├── packages/
│   ├── app-ganymede/        # Main API server
│   ├── app-gateway/         # Gateway (per-organization)
│   ├── app-frontend/        # React frontend
│   ├── app-ganymede-cmds/   # CLI tools
│   ├── modules/             # Feature modules
│   │   ├── core/            # Core graph system
│   │   ├── user-containers/ # Container management
│   │   ├── jupyter/         # JupyterLab integration
│   │   ├── chats/           # Chat functionality
│   │   └── ...              # Other modules
│   ├── ui-*/                # UI component libraries
│   └── backend-engine/      # Express utilities
├── docker-images/           # Docker image definitions
├── scripts/                 # Utility scripts
└── doc/                     # Documentation
\`\`\`

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development workflow, coding standards, and contribution guidelines.

## 📄 License

Demiurge is licensed under the **[GNU Affero General Public License v3.0](LICENSE)** (AGPL-3.0).

This is a strong copyleft license that:
- ✅ Allows commercial use, distribution, modification, and private use
- ✅ Provides an express grant of patent rights from contributors
- ⚠️ Requires disclosure of source code when distributing the software
- ⚠️ Requires that modified versions used over a network must make source code available
- ⚠️ Requires derivative works to be licensed under the same terms

**Key Points:**
- You are free to use, modify, and distribute this software
- If you modify this software and provide it as a service over a network, you must make your modified source code available
- All derivative works must also be licensed under AGPL-3.0

For more information about the AGPL-3.0 license, see https://choosealicense.com/licenses/agpl-3.0/

## 🙋 Support

- **Documentation:** [doc/README.md](doc/README.md)
- **Issues:** [GitHub Issues](https://github.com/YourOrg/demiurge/issues)
- **Discussions:** [GitHub Discussions](https://github.com/YourOrg/demiurge/discussions)
