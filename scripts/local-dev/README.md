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

# 4. Monitor environments
./envctl.sh list                # List all environments
./envctl-monitor.sh watch       # Live monitoring

# 5. Start environment
./envctl.sh start dev-001

# 6. Configure host OS (see LOCAL_DEVELOPMENT.md)
# - Install SSL root CA
# - Add hosts entries
# - Access: https://dev-001.local
```

## Scripts Overview

### One-Time Setup (Development Container)

| Script                   | Purpose                                  | Run Once |
| ------------------------ | ---------------------------------------- | -------- |
| `setup-all.sh`           | Master setup - runs all one-time scripts | ✅       |
| `install-node.sh`        | Install Node.js 24.x from NodeSource     | ✅       |
| `install-system-deps.sh` | Install PostgreSQL, Nginx, utilities     | ✅       |
| `install-mkcert.sh`      | Install mkcert for SSL certificates      | ✅       |
| `setup-postgres.sh`      | Configure PostgreSQL server              | ✅       |

### Environment Management

| Script                                        | Purpose                     | Usage                             |
| --------------------------------------------- | --------------------------- | --------------------------------- |
| `create-env.sh <name> [workspace] [database]` | Create new environment      | `./create-env.sh dev-001`         |
| `delete-env.sh <name>`                        | Delete environment          | `./delete-env.sh dev-001`         |
| `build-frontend.sh <name> [workspace]`        | Build frontend for env      | `./build-frontend.sh dev-001`     |
| **`envctl.sh <command> [args]`**              | **Main controller**         | **See Environment Control below** |
| **`envctl-monitor.sh [watch]`**               | **Monitoring (no flicker)** | `./envctl-monitor.sh watch`       |

### Environment Control (envctl.sh)

| Command                     | Purpose                                    | Example                                |
| --------------------------- | ------------------------------------------ | -------------------------------------- |
| `list, ls`                  | List all environments                      | `./envctl.sh list`                     |
| `status [env]`              | Show status                                | `./envctl.sh status dev-001`           |
| `monitor`                   | Live monitoring (2s updates)               | `./envctl.sh monitor`                  |
| `start <env> [service]`     | Start environment/service                  | `./envctl.sh start dev-001`            |
| `stop <env> [service]`      | Stop environment/service                   | `./envctl.sh stop dev-001`             |
| `restart <env> [service]`   | Restart environment/service                | `./envctl.sh restart dev-001`          |
| `logs <env> <service> [-f]` | View logs (ganymede/gateway)               | `./envctl.sh logs dev-001 ganymede -f` |
| `build <env> [target]`      | Build apps (all/ganymede/gateway/frontend) | `./envctl.sh build dev-001`            |

**Services:** `ganymede`, `gateway`, `both` (default)

**Multiple workspaces example:**

```bash
# Different branches, different workspaces
./create-env.sh main /root/workspace/monorepo /root/workspace/database
./create-env.sh feat-a /root/workspace/monorepo-feat-a /root/workspace/database-feat-a
```

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
      ├── pids/                  # 🆕 Process IDs (managed by envctl)
      │   ├── ganymede.pid
      │   └── gateway.pid
      ├── data/                  # Gateway persistent data
      │   ├── gateway-state-*.json
      │   └── project-*/
      └── logs/                  # Application logs
          ├── ganymede.log
          ├── gateway.log
          └── *-access/error.log
```

**Note:** Scripts are no longer generated in each environment. Use `envctl.sh` for all management.

## Related Documentation

- **[LOCAL_DEVELOPMENT.md](../../doc/LOCAL_DEVELOPMENT.md)** - Complete setup guide (host OS config, SSL, workflows)
- [MODULES_TESTING.md](../../doc/MODULES_TESTING.md) - Testing modules in Storybook
- [INSTALL.md](../../doc/INSTALL.md) - Production deployment guide
