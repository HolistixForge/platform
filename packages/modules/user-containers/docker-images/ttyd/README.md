# ttyd Tools Layer

Reusable ttyd (web terminal) scripts for Holistix user containers.

## What's Included

| File                     | Description                              |
| ------------------------ | ---------------------------------------- |
| `terminal-session.sh`    | Creates/attaches to named tmux sessions  |
| `start-ttyd.sh`          | Common ttyd startup with session support |
| `install-ttyd-debian.sh` | Install ttyd + tmux on Debian/Ubuntu     |
| `install-ttyd-alpine.sh` | Install ttyd + tmux on Alpine            |
| `install-ttyd-rhel.sh`   | Install ttyd + tmux on RHEL/Fedora       |

## Usage in Dockerfiles

```dockerfile
# Stage 1: Get base Holistix tools
FROM holistixforge/bootstrap-tools:latest AS base

# Stage 2: Get ttyd tools
FROM holistixforge/ttyd-tools:latest AS ttyd

# Stage 3: Build your image
FROM ubuntu:24.04

# Copy bootstrap tools
COPY --from=base /holistix/ /usr/local/bin/
RUN chmod +x /usr/local/bin/*.sh

# Copy ttyd tools
COPY --from=ttyd /holistix/ttyd/ /usr/local/bin/
RUN chmod +x /usr/local/bin/*.sh

# Install ttyd (distro-specific)
RUN /usr/local/bin/install-ttyd-debian.sh
```

## Multiple Named Sessions

The terminal supports multiple named shared sessions via URL parameter:

```
https://terminal.uc-xxx.org-yyy.domain/           → "default" session
https://terminal.uc-xxx.org-yyy.domain/?arg=dev   → "dev" session
https://terminal.uc-xxx.org-yyy.domain/?arg=logs  → "logs" session
```

- Same session name = shared terminal (all users see same output)
- Different session names = separate terminals
- Sessions persist even when all users disconnect

## In Entrypoint Scripts

```bash
# Start ttyd on port 7681
/usr/local/bin/start-ttyd.sh 7681 &

# Register with gateway (creates uc-{id}--{service}.org-{org}.{domain} FQDN)
map_http_service terminal 7681 &
```

## Building the Layer

```bash
docker build -t holistixforge/ttyd-tools:latest packages/modules/user-containers/docker-images/ttyd/
```
