# VS Code Server - User Container Image
#
# A development container with VS Code (code-server) and web terminal (ttyd).
#
# Build (from repo root):
#   docker build -t holistixforge/vscode-server:latest packages/modules/vscode/docker-images/vscode-server/
#
# Requires:
#   - holistixforge/bootstrap-tools:latest (build from user-containers/docker-images/base/)
#   - holistixforge/ttyd-tools:latest (build from user-containers/docker-images/ttyd/)

# Stage 1: Get shared Holistix bootstrap tools
FROM holistixforge/bootstrap-tools:latest AS tools

# Stage 2: Get ttyd tools layer
FROM holistixforge/ttyd-tools:latest AS ttyd

# Stage 3: Build the actual image
FROM ubuntu:24.04

USER root

# Install required packages:
# - tini: init system for containers
# - jq: JSON parsing for settings extraction
# - curl: HTTP requests to gateway and code-server download
# - openvpn: VPN connection to gateway
# - iputils-ping: connectivity checks
# - git: version control
# - ca-certificates: HTTPS support
# Note: ttyd and tmux are installed via install-ttyd-debian.sh
RUN apt-get update --yes && apt-get install --yes --no-install-recommends \
    tini \
    jq \
    curl \
    openvpn \
    iputils-ping \
    git \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Copy shared Holistix bootstrap tools from tools stage
COPY --from=tools /holistix/ /usr/local/bin/
RUN chmod +x /usr/local/bin/*.sh

# Copy ttyd tools from ttyd stage
COPY --from=ttyd /holistix/ttyd/ /usr/local/bin/
RUN chmod +x /usr/local/bin/*.sh

# Install ttyd and tmux using the distro-specific installer
RUN /usr/local/bin/install-ttyd-debian.sh

# Install code-server (VS Code in browser)
# Using the official install script which handles architecture detection
RUN curl -fsSL https://code-server.dev/install.sh | sh

# Create workspace directory
RUN mkdir -p /workspace && chmod 777 /workspace

# Copy container-specific entrypoint
COPY container-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/container-entrypoint.sh

# Use tini as init to handle signals properly
ENTRYPOINT ["tini", "-g", "--", "container-entrypoint.sh"]
