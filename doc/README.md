# Documentation Hub

Welcome to the Demiurge documentation! This hub will guide you to the right resources.

## 🎯 I Want To...

### Get Started

- 🚀 **[Set up local development](guides/LOCAL_DEVELOPMENT.md)** - Multi-environment dev setup
- 🏭 **[Deploy to production](guides/PRODUCTION_DEPLOYMENT.md)** - VPS deployment guide
- 🤝 **[Contribute](../CONTRIBUTING.md)** - Development workflow and standards

### Understand the System

- 🏗️ **[Architecture Overview](architecture/OVERVIEW.md)** - System design and components
- 📐 **[System Architecture](architecture/SYSTEM_ARCHITECTURE.md)** - Complete architecture diagram
- 📊 **[Gateway Architecture](architecture/GATEWAY_ARCHITECTURE.md)** - Multi-gateway pool architecture
- 🔒 **[Protected Services](architecture/PROTECTED_SERVICES.md)** - Module-driven protected endpoints
- 📡 **[Logging & Observability](architecture/LOGGING_AND_OBSERVABILITY.md)** - Logs, traces, error categories, and OTel stack
- 🎨 **[Layer System Architecture](../packages/modules/space/src/lib/layer.md)** - Modular whiteboard layers (Excalidraw integration)

### Learn How To

- 🧪 **[Test Modules](guides/MODULES_TESTING.md)** - Module stories and fake collab
- 📦 **[Use Nx Workspace](guides/NX_WORKSPACE.md)** - Monorepo commands and workflows
- 🎨 **[Build UI Components](guides/MODULES_TESTING.md#frontend-components)** - React components with Storybook
- 🔌 **[Module Reference](../packages/modules/README.md)** - Individual module documentation

### Quick Reference

- ⚡ **[Cheatsheet](reference/CHEATSHEET.md)** - Common commands and aliases
- 🔌 **[API Reference](reference/API.md)** - REST API endpoints
- 🖥️ **[GPU Host Setup](reference/GPU_HOST_SETUP.md)** - Configure GPU access for Docker
- 📄 **[Licensing](LICENSING.md)** - License information and commercial licensing

### Internal/WIP

- 📝 **[TODO](internal/TODO.md)** - task list
- 🤖 **[AI Summary](internal/AI-summary.md)** - Context for AI tools

### Historical

- 📚 **[Archive](archive/README.md)** - Superseded documentation (preserved for reference)

## 📂 Documentation Structure

```
doc/
├── README.md                 ← You are here
│
├── architecture/             # System Design
│   ├── OVERVIEW.md                   - High-level architecture
│   ├── SYSTEM_ARCHITECTURE.md        - Complete system diagram
│   ├── GATEWAY_ARCHITECTURE.md       - Multi-gateway architecture
│   └── ARCHITECTURAL_DECISIONS.md    - Key design decisions
│
├── guides/                   # How-To Guides
│   ├── LOCAL_DEVELOPMENT.md  - Multi-env local setup
│   ├── PRODUCTION_DEPLOYMENT.md  - VPS deployment
│   ├── MODULES_TESTING.md    - Module development & testing
│   └── NX_WORKSPACE.md       - Nx monorepo workflows
│
├── reference/                # Quick Reference
│   ├── CHEATSHEET.md         - Commands, aliases, tools
│   ├── API.md                - REST API documentation
│   └── GPU_HOST_SETUP.md     - GPU configuration
│
├── current-works/            # Active Work & Tracking
│   ├── TODO.md               - Task tracking
│   └── TODO_ANTOINE.md       - Antoine's task list
│
├── internal/                 # Internal Notes
│   └── AI-summary.md         - AI context notes
│
└── archive/                  # Historical Docs
    ├── README.md             - Archive context
    ├── 2024-container-refactor/  - Container feature redesign
    └── project-server-state-and-transition.md  - Legacy states
```

## 🎓 Learning Paths

### New Developer

1. Read [Architecture Overview](architecture/OVERVIEW.md)
2. Set up [Local Development](guides/LOCAL_DEVELOPMENT.md)
3. Review [Contributing Guidelines](../CONTRIBUTING.md)
4. Browse [Cheatsheet](reference/CHEATSHEET.md)
5. Try [Module Testing](guides/MODULES_TESTING.md)

### Frontend Developer

1. [Local Development Setup](guides/LOCAL_DEVELOPMENT.md)
2. [Module Testing with Storybook](guides/MODULES_TESTING.md)
3. [Nx Workspace Guide](guides/NX_WORKSPACE.md)
4. [API Reference](reference/API.md) (for backend integration)

### Backend Developer

1. [Architecture Overview](architecture/OVERVIEW.md)
2. [Local Development Setup](guides/LOCAL_DEVELOPMENT.md)
3. [API Reference](reference/API.md)
4. [System Architecture](architecture/SYSTEM_ARCHITECTURE.md)
5. [Gateway Architecture](architecture/GATEWAY_ARCHITECTURE.md)
6. [Nx Workspace Guide](guides/NX_WORKSPACE.md)

### DevOps/SRE

1. [Production Deployment](guides/PRODUCTION_DEPLOYMENT.md)
2. [Architecture Overview](architecture/OVERVIEW.md)
3. [Local Development](guides/LOCAL_DEVELOPMENT.md) (for understanding)
4. [GPU Host Setup](reference/GPU_HOST_SETUP.md)

## 🔍 Finding Information

### By Topic

- **Authentication:** [Architecture](architecture/OVERVIEW.md#authentication), [API](reference/API.md#authentication)
- **Collaboration:** [Architecture](architecture/OVERVIEW.md#collaboration), [Modules Testing](guides/MODULES_TESTING.md)
- **Containers:** [System Architecture](architecture/SYSTEM_ARCHITECTURE.md#layer-4-user-containers), [User Containers Module](../packages/modules/user-containers/README.md), [Docker Images](../docker-images/README.md)
- **Protected Services:** [Protected Services Architecture](architecture/PROTECTED_SERVICES.md)
- **Terminal Access:** [User Containers Module](../packages/modules/user-containers/README.md#terminal-access)
- **Database:** [Architecture](architecture/OVERVIEW.md#database), [Schema](architecture/SYSTEM_ARCHITECTURE.md#database-schema-gateways)
- **Gateway:** [Gateway Architecture](architecture/GATEWAY_ARCHITECTURE.md), [System View](architecture/SYSTEM_ARCHITECTURE.md#layer-3-gateway-pool-containers)
- **Modules:** [Modules Testing](guides/MODULES_TESTING.md), [Architecture](architecture/OVERVIEW.md#modules), [Layer System](../packages/modules/space/src/lib/layer.md), [Module Reference](../packages/modules/README.md)

### Search Tips

- Use `Ctrl+F` / `Cmd+F` to search within a document
- Use GitHub search to search across all docs
- Check [Archive](archive/) for historical context

## 📝 Contributing to Documentation

When updating documentation:

1. **Keep it current** - Remove outdated information
2. **Be concise** - Short and clear is better than long and confusing
3. **Use examples** - Code examples clarify intent
4. **Link related docs** - Help readers navigate
5. **Update this hub** - Add links for new documents

See [CONTRIBUTING.md](../CONTRIBUTING.md#documentation) for more details.

## 🙋 Need Help?

- **Something unclear?** Open an issue asking for clarification
- **Found outdated info?** Submit a PR or issue
- **Need examples?** Check [Archive](archive/) for historical context
- **Still stuck?** Ask in GitHub Discussions

---

**Last updated:** 2025-01-06  
**Maintained by:** Core team

## History and Rationale

- 📖 **[Fluid Lifecycle Whitepaper](fluid-lifecycle/README.md)** – learn why Demiurge began, the pain points it targets, and the original engineering rationale.
