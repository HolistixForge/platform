# pgAdmin 4 - User Container Image
#
# PostgreSQL administration tool with web terminal support.
#
# Build (from repo root):
#   docker build -t holistixforge/pgadmin4:latest packages/modules/pgadmin4/docker-image/
#
# Requires:
#   - holistixforge/bootstrap-tools:latest (build from user-containers/docker-images/base/)
#   - holistixforge/ttyd-tools:latest (build from user-containers/docker-images/ttyd/)
#
# Reference: https://github.com/pgadmin-org/pgadmin4/blob/master/Dockerfile

# Stage 1: Get shared Holistix bootstrap tools
FROM holistixforge/bootstrap-tools:latest AS tools

# Stage 2: Get ttyd tools layer
FROM holistixforge/ttyd-tools:latest AS ttyd

# Stage 3: Build the actual image
FROM dpage/pgadmin4:8.12.0

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

# Copy container-specific scripts
COPY --chmod=755 ./start-pgadmin4.sh ./container-entrypoint.sh /usr/local/bin/

# Setup pgAdmin config
RUN touch /pgadmin4/config_local.py && \
    chown 5050:5050 /pgadmin4/config_local.py

# Use tini as init to handle signals properly
ENTRYPOINT ["tini", "-g", "--", "container-entrypoint.sh"]