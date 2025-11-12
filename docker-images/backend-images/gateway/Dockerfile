FROM dev-pod:latest

USER root 

RUN apt update && apt install -y \
  openvpn \
  easy-rsa \
  nginx \
  inotify-tools

# Copy and set entrypoint
COPY --chmod=755 ./app/entrypoint-dev.sh /entrypoint.sh

# Entrypoint will handle hot-reloading via trigger file
ENTRYPOINT ["/entrypoint.sh"]