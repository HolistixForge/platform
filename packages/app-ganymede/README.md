# app-ganymede (API Server)

Central API server for user management, authentication, organizations, and projects.

## Purpose

App-ganymede is the main API server that handles:

- User authentication (OAuth providers, TOTP, magic links, local)
- Organization management (CRUD, members, roles)
- Project management (CRUD, members)
- Gateway allocation and lifecycle
- Session management

## Architecture

- **Single API instance** - All user-facing API requests
- **PostgreSQL database** - Persistent storage for users, organizations, projects
- **Express.js + TypeScript** - Standard REST API
- **Passport.js** - Authentication strategies

See [doc/architecture/OVERVIEW.md](../../doc/architecture/OVERVIEW.md) for system architecture.

## Key Features

### Authentication

Multiple authentication methods:

- OAuth providers (GitHub, GitLab, Discord, LinkedIn) - external OAuth login
- OAuth2 server for user authentication (global `demiurge-global` client) - frontend token issuance
- TOTP (2FA)
- Magic link (email)
- Local (email/password)

### Multi-Tenancy

- **Organizations** - Top-level grouping with owners and members
- **Projects** - Owned by organizations, collaborative workspaces
- **Gateway allocation** - One gateway per organization, allocated on-demand

### Database

PostgreSQL with 11 tables:

- Users & auth (5 tables)
- Organizations (2 tables)
- Projects (2 tables)
- Gateways (2 tables)

See [doc/architecture/SYSTEM_ARCHITECTURE.md](../../doc/architecture/SYSTEM_ARCHITECTURE.md) for complete system architecture.

## Development

See [doc/guides/LOCAL_DEVELOPMENT.md](../../doc/guides/LOCAL_DEVELOPMENT.md) for local setup.

**Build:**

```bash
npx nx run app-ganymede:build
```

**Run locally:**

```bash
# Ganymede runs as part of local dev environment
/root/.local-dev/dev-001/start.sh
```

## API Reference

See [doc/reference/API.md](../../doc/reference/API.md) for complete API documentation.

**Key endpoints:**

- `/auth/*` - Authentication (login, signup, OAuth providers, TOTP, magic link)
- `/oauth/*` - OAuth2 server for user authentication (global client only)
- `/organizations` - Organization management
- `/projects` - Project management
- `/gateway/*` - Gateway lifecycle
- `/users` - User search and info

## Related Documentation

- [Architecture Overview](../../doc/architecture/OVERVIEW.md)
- [System Architecture](../../doc/architecture/SYSTEM_ARCHITECTURE.md)
- [Gateway Architecture](../../doc/architecture/GATEWAY_ARCHITECTURE.md)
- [API Reference](../../doc/reference/API.md)
- [Local Development](../../doc/guides/LOCAL_DEVELOPMENT.md)
