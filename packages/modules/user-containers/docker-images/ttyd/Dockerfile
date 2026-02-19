# Holistix ttyd Tools Layer
#
# This image packages ttyd-related scripts for user containers.
# It uses 'scratch' (empty) base - it only contains files, no runtime.
#
# Usage in user container Dockerfiles:
#   FROM holistixforge/ttyd-tools:latest AS ttyd
#   FROM ubuntu:24.04
#   COPY --from=ttyd /holistix/ttyd/ /usr/local/bin/
#   RUN /usr/local/bin/install-ttyd-debian.sh
#
# Build:
#   docker build -t holistixforge/ttyd-tools:latest packages/modules/user-containers/docker-images/ttyd/
#
# Contents:
#   /holistix/ttyd/terminal-session.sh  - Shared tmux session wrapper
#   /holistix/ttyd/start-ttyd.sh        - Common ttyd startup script
#   /holistix/ttyd/install-ttyd-*.sh    - Distro-specific installers

FROM scratch

# Copy ttyd scripts
COPY terminal-session.sh /holistix/ttyd/
COPY start-ttyd.sh /holistix/ttyd/

# Copy distro-specific installers
COPY install/ /holistix/ttyd/
