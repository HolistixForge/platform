# Ganymede Database Access Guide

This guide explains how to access and manage the PostgreSQL database for any environment in the platform.

## Overview

- PostgreSQL is installed **locally** (not in Docker)
- Each environment has its own database and user
- Credentials are stored in `/root/.local-dev/{env}/.env.ganymede`
- Database name pattern: `ganymede_{env}`
- User name pattern: `ganymede_app_{env}`

## Locating Database Credentials

Environment configurations are stored in:

```
/root/.local-dev/{env}/.env.ganymede
```

Extract credentials:

```bash
grep PG /root/.local-dev/{env}/.env.ganymede
```

## Connecting to the Database

```bash
# Source credentials then connect
PGPASSWORD=${PG_PASSWORD} psql -U ${PG_USER} -h ${PG_HOST} -d ${PG_DATABASE}

# Quick one-liner for queries
PGPASSWORD=${PG_PASSWORD} psql -U ${PG_USER} -h ${PG_HOST} -d ${PG_DATABASE} -c "SELECT * FROM users LIMIT 5;"
```

## Common Database Operations

### Clear Gateway Allocation Table

**When to use:** After restarting your computer or when you need to force gateway reallocation.

```bash
PGPASSWORD=${PG_PASSWORD} psql -U ${PG_USER} -h ${PG_HOST} -d ${PG_DATABASE} -c "DELETE FROM organizations_gateways;"
```

### View Organizations

```bash
PGPASSWORD=${PG_PASSWORD} psql -U ${PG_USER} -h ${PG_HOST} -d ${PG_DATABASE} -c "SELECT organization_id, name, created_at FROM organizations;"
```

### View Projects

```bash
PGPASSWORD=${PG_PASSWORD} psql -U ${PG_USER} -h ${PG_HOST} -d ${PG_DATABASE} -c "SELECT project_id, name, organization_id, created_at FROM projects;"
```

### View Users

```bash
PGPASSWORD=${PG_PASSWORD} psql -U ${PG_USER} -h ${PG_HOST} -d ${PG_DATABASE} -c "SELECT user_id, username, email, created_at FROM users;"
```

### Check Gateway Allocations

```bash
PGPASSWORD=${PG_PASSWORD} psql -U ${PG_USER} -h ${PG_HOST} -d ${PG_DATABASE} -c "SELECT organization_id, gateway_id, allocated_at FROM organizations_gateways;"
```

## Interactive Database Shell

```bash
PGPASSWORD=${PG_PASSWORD} psql -U ${PG_USER} -h ${PG_HOST} -d ${PG_DATABASE}
```

Useful psql commands: `\dt` (list tables), `\d table_name` (describe table), `\q` (quit), `\x` (toggle expanded display)

## Database Schema

See `packages/app-ganymede/database/schema/02-schema.sql`

## Agent Workflow for Database Operations

1. **Always read the environment's `.env.ganymede` file first** to get credentials
2. **Use the PGPASSWORD environment variable syntax** (cleaner and more secure)
3. **Use placeholders in documentation** but actual values when executing commands
4. **Verify operations** after destructive commands (DELETE, DROP, etc.)
5. **Never log or display sensitive credentials** in responses unless directly showing command execution

## Backup and Restore

```bash
# Backup
PGPASSWORD=${PG_PASSWORD} pg_dump -U ${PG_USER} -h ${PG_HOST} -d ${PG_DATABASE} -F c -f backup_$(date +%Y%m%d_%H%M%S).dump

# Restore
PGPASSWORD=${PG_PASSWORD} pg_restore -U ${PG_USER} -h ${PG_HOST} -d ${PG_DATABASE} -c backup_file.dump
```

## Security Best Practices

- Use environment variables, not hardcoded passwords
- The `ganymede_app_{env}` user has limited privileges (no superuser access)
- For administrative tasks, use the PostgreSQL superuser account
