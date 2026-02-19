# n8n - User Container Image
#
# Workflow automation platform with web terminal support.
#
# Build (from repo root):
#   docker build -t holistixforge/n8n:latest packages/modules/n8n/docker-image/
#
# Requires:
#   - holistixforge/bootstrap-tools:latest (build from user-containers/docker-images/base/)
#   - holistixforge/ttyd-tools:latest (build from user-containers/docker-images/ttyd/)

# Stage 1: Get shared Holistix bootstrap tools
FROM holistixforge/bootstrap-tools:latest AS tools

# Stage 2: Get ttyd tools layer
FROM holistixforge/ttyd-tools:latest AS ttyd

# Stage 3: Build the actual image
FROM docker.n8n.io/n8nio/n8n:1.97.1

USER root

# Install required packages (Alpine-based image)
RUN apk add --no-cache tini jq curl iputils openvpn util-linux pciutils

# Copy shared Holistix bootstrap tools from tools stage
COPY --from=tools /holistix/ /usr/local/bin/
RUN chmod +x /usr/local/bin/*.sh

# Copy ttyd tools from ttyd stage
COPY --from=ttyd /holistix/ttyd/ /usr/local/bin/
RUN chmod +x /usr/local/bin/*.sh

# Install ttyd and tmux using the distro-specific installer (Alpine)
RUN /usr/local/bin/install-ttyd-alpine.sh

# Copy container-specific entrypoint
COPY --chmod=755 ./container-entrypoint.sh /usr/local/bin/

# Use tini as init to handle signals properly
ENTRYPOINT ["tini", "-g", "--", "container-entrypoint.sh"]