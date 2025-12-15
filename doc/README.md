# Documentation Hub

Welcome to the Holistix Forge documentation! This hub will guide you to the right resources.

## 🎯 I Want To...

### Get Started

- 🚀 **[Set up local development](guides/LOCAL_DEVELOPMENT.md)** - Multi-environment dev setup
- 🤝 **[Contribute](../CONTRIBUTING.md)** - Development workflow and standards

### Understand the System

- 🏗️ **[Architecture Overview](architecture/OVERVIEW.md)** - System design and components
- 📐 **[System Architecture](architecture/SYSTEM_ARCHITECTURE.md)** - Complete architecture diagram
- 📊 **[Gateway Architecture](architecture/GATEWAY_ARCHITECTURE.md)** - Multi-gateway pool architecture
- 🔒 **[Protected Services](architecture/PROTECTED_SERVICES.md)** - Module-driven protected endpoints
- 📡 **[Logging & Observability](architecture/LOGGING_AND_OBSERVABILITY.md)** - Logs, traces, error categories, and OTel stack
- 🎨 **[Layer System Architecture](../packages/modules/space/src/lib/layer.md)** - Modular whiteboard layers (Excalidraw integration)

### Learn How To

- 🧪 **[Testing Guide](guides/TESTING_GUIDE.md)** - Comprehensive testing strategies for frontend, backend, and components
- 🧪 **[Test Modules](guides/MODULES_TESTING.md)** - Module stories and fake collab
- 📦 **[Use Nx Workspace](guides/NX_WORKSPACE.md)** - Monorepo commands and workflows
- 🎨 **[Build UI Components](guides/MODULES_TESTING.md)** - Module development with Storybook
- 🔧 **[Package Architecture](guides/PACKAGE_ARCHITECTURE.md)** - React dependency management and package patterns
- 🚀 **[Gateway Build Distribution](guides/GATEWAY_BUILD_DISTRIBUTION.md)** - HTTP build distribution system
- 🔌 **[Module Reference](../packages/modules/README.md)** - Individual module documentation
- 🩹 **[Troubleshooting](guides/TROUBLESHOOTING.md)** - Common issues and solutions

### Quick Reference

- ⚡ **[Cheatsheet](reference/CHEATSHEET.md)** - Common commands and aliases
- 🔌 **[API Reference](reference/API.md)** - REST API endpoints
- 🖥️ **[GPU Host Setup](reference/GPU_HOST_SETUP.md)** - Configure GPU access for Docker
- 📄 **[Licensing](LICENSING.md)** - License information and commercial licensing

### Internal

- 🤖 **[AI Summary](internal/AI-summary.md)** - Context for AI tools

### Work In Progress

see github issues

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
│   ├── TESTING_GUIDE.md      - Testing strategies & examples
│   ├── MODULES_TESTING.md    - Module development & testing
│   └── NX_WORKSPACE.md       - Nx monorepo workflows
│
├── reference/                # Quick Reference
│   ├── CHEATSHEET.md         - Commands, aliases, tools
│   ├── API.md                - REST API documentation
│   └── GPU_HOST_SETUP.md     - GPU configuration
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
5. Review [Testing Guide](guides/TESTING_GUIDE.md)
6. Try [Module Testing](guides/MODULES_TESTING.md)

### Frontend Developer

1. [Local Development Setup](guides/LOCAL_DEVELOPMENT.md)
2. [Testing Guide](guides/TESTING_GUIDE.md) (React components, LocalStorage)
3. [Module Testing with Storybook](guides/MODULES_TESTING.md)
4. [Nx Workspace Guide](guides/NX_WORKSPACE.md)
5. [API Reference](reference/API.md) (for backend integration)

### Backend Developer

1. [Architecture Overview](architecture/OVERVIEW.md)
2. [Local Development Setup](guides/LOCAL_DEVELOPMENT.md)
3. [Testing Guide](guides/TESTING_GUIDE.md) (Express API testing)
4. [API Reference](reference/API.md)
5. [System Architecture](architecture/SYSTEM_ARCHITECTURE.md)
6. [Gateway Architecture](architecture/GATEWAY_ARCHITECTURE.md)
7. [Nx Workspace Guide](guides/NX_WORKSPACE.md)

### DevOps/SRE

1. [Architecture Overview](architecture/OVERVIEW.md)
2. [Local Development](guides/LOCAL_DEVELOPMENT.md)
3. [GPU Host Setup](reference/GPU_HOST_SETUP.md)
4. [Gateway Architecture](architecture/GATEWAY_ARCHITECTURE.md)

## 🔍 Finding Information

### By Topic

- **Authentication:** [Overview](architecture/OVERVIEW.md), [API Reference](reference/API.md)
- **Collaboration:** [Overview](architecture/OVERVIEW.md), [Gateway Architecture](architecture/GATEWAY_ARCHITECTURE.md), [Modules Testing](guides/MODULES_TESTING.md)
- **Containers:** [System Architecture](architecture/SYSTEM_ARCHITECTURE.md), [User Containers Module](../packages/modules/user-containers/README.md), [Docker Images](../docker-images/README.md)
- **Protected Services:** [Protected Services Architecture](architecture/PROTECTED_SERVICES.md)
- **Terminal Access:** [User Containers Module](../packages/modules/user-containers/README.md#terminal-access) (Web-based terminals)
- **Testing:** [Testing Guide](guides/TESTING_GUIDE.md), [Modules Testing](guides/MODULES_TESTING.md)
- **Database:** [Overview](architecture/OVERVIEW.md), [Gateway Architecture](architecture/GATEWAY_ARCHITECTURE.md)
- **Gateway:** [Gateway Architecture](architecture/GATEWAY_ARCHITECTURE.md), [System Architecture](architecture/SYSTEM_ARCHITECTURE.md)
- **Modules:** [Module Reference](../packages/modules/README.md), [Modules Testing](guides/MODULES_TESTING.md), [Overview](architecture/OVERVIEW.md)

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

See [CONTRIBUTING.md](../CONTRIBUTING.md#documentation-structure) for more details.

## 🙋 Need Help?

- **Something unclear?** Open an issue asking for clarification
- **Found outdated info?** Submit a PR or issue
- **Need examples?** Check [Archive](archive/) for historical context
- **Still stuck?** Ask in GitHub Discussions

---

**Last updated:** 2025-01-06  
**Maintained by:** Core team

## History and Rationale

- 📖 **[Fluid Lifecycle Whitepaper](fluid-lifecycle/README.md)** – learn why Holistix Forge began, the pain points it targets, and the original engineering rationale.
