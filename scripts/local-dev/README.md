# Local Development Scripts

Quick reference for local development environment scripts. For complete setup instructions, see **[LOCAL_DEVELOPMENT.md](../../doc/LOCAL_DEVELOPMENT.md)**.

## Quick Start

```bash
cd /root/workspace/monorepo/scripts/local-dev

# 1. One-time setup (run once)
./setup-all.sh

# 2. Create environment
./create-env.sh dev-001

# 3. Build frontend
./build-frontend.sh dev-001

# 4. Start
/root/.local-dev/dev-001/start.sh

# 5. Configure host OS (see LOCAL_DEVELOPMENT.md)
# - Install SSL root CA
# - Add hosts entries
# - Access: https://dev-001.local
```

## Scripts Overview

### One-Time Setup (Development Container)

| Script                   | Purpose                                  | Run Once |
| ------------------------ | ---------------------------------------- | -------- |
| `setup-all.sh`           | Master setup - runs all one-time scripts | ✅       |
| `install-system-deps.sh` | Install PostgreSQL, Nginx, utilities     | ✅       |
| `install-mkcert.sh`      | Install mkcert for SSL certificates      | ✅       |
| `setup-postgres.sh`      | Configure PostgreSQL server              | ✅       |

### Environment Management

| Script                                        | Purpose                | Usage                         |
| --------------------------------------------- | ---------------------- | ----------------------------- |
| `create-env.sh <name> [workspace] [database]` | Create new environment | `./create-env.sh dev-001`     |
| `list-envs.sh`                                | List all environments  | `./list-envs.sh`              |
| `delete-env.sh <name>`                        | Delete environment     | `./delete-env.sh dev-001`     |
| `build-frontend.sh <name> [workspace]`        | Build frontend for env | `./build-frontend.sh dev-001` |

**Multiple workspaces example:**

```bash
# Different branches, different workspaces
./create-env.sh main /root/workspace/monorepo /root/workspace/database
./create-env.sh feat-a /root/workspace/monorepo-feat-a /root/workspace/database-feat-a
```

### Per-Environment Scripts (Auto-Created)

Located in `/root/.local-dev/<env-name>/`:

| Script                        | Purpose                  |
| ----------------------------- | ------------------------ |
| `start.sh`                    | Start Ganymede + Gateway |
| `stop.sh`                     | Stop all processes       |
| `logs.sh {ganymede\|gateway}` | View logs                |

### Host OS Helpers

| Script                  | Purpose           | OS      |
| ----------------------- | ----------------- | ------- |
| `windows-add-hosts.ps1` | Add hosts entries | Windows |

## Environment File Locations

```
/root/.local-dev/
  └── <env-name>/
      ├── .env.ganymede          # Ganymede config
      ├── .env.gateway           # Gateway config (incl. GATEWAY_ID, GATEWAY_TOKEN)
      ├── ssl-cert.pem           # Multi-domain SSL cert
      ├── ssl-key.pem            # SSL private key
      ├── jwt-key                # JWT signing key
      ├── jwt-key-public.pem     # JWT public key
      ├── start.sh               # ▶️  Start services
      ├── stop.sh                # ⏹️  Stop services
      ├── logs.sh                # 📊 View logs
      ├── data/                  # Gateway persistent data
      │   ├── gateway-state-*.json
      │   └── project-*/
      └── logs/                  # Application logs
          ├── ganymede.log
          ├── gateway.log
          └── *-access/error.log
```

## Related Documentation

- **[LOCAL_DEVELOPMENT.md](../../doc/LOCAL_DEVELOPMENT.md)** - Complete setup guide (host OS config, SSL, workflows)
- [MODULES_TESTING.md](../../doc/MODULES_TESTING.md) - Testing modules in Storybook
- [INSTALL.md](../../doc/INSTALL.md) - Production deployment guide
