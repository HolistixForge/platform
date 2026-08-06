FROM ubuntu:24.04

USER root 

# Install Node.js 24.x
RUN apt-get update && apt-get install -y ca-certificates curl gnupg && \
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg && \
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_24.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list && \
  apt-get update && apt-get install -y nodejs

# Install gateway dependencies
RUN apt-get update && apt-get install -y \
  openvpn \
  easy-rsa \
  nginx \
  inotify-tools \
  sudo \
  inetutils-ping \
  curl \
  # start-vpn.sh installs a default-deny FORWARD rule between VPN clients.
  # Without this package the rule silently does not exist: the script warns on
  # stderr and nobody reads it, so the VPN looks isolated and is not.
  iptables \
  # `ip route` in entrypoint-dev.sh. It has a /proc/net/route fallback and does
  # not need this — but it was only ever present because openvpn happened to
  # pull it in, and a transitive dependency is not a dependency. Named here so
  # a change upstream cannot quietly take it away.
  iproute2

# Copy app directory (contains scripts needed for startup)
COPY ./app/ /app/

# Copy and set entrypoint (avoid BuildKit-specific --chmod flag)
COPY ./app/entrypoint-dev.sh /entrypoint.sh
RUN chmod 755 /entrypoint.sh

# Entrypoint will handle hot-reloading via trigger file
ENTRYPOINT ["/entrypoint.sh"]