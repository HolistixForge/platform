#!/bin/bash

. /usr/local/bin/container-functions.sh

sh -c '. /usr/local/bin/container-functions.sh && vpn_loop' &

# Map vscode service on its default port
sh -c '. /usr/local/bin/container-functions.sh && map_http_service vscode 8080' &

# Start code-server without path prefix (distinct FQDN routing)
# Disable authentication as OAuth is handled by the gateway
/usr/bin/entrypoint.sh --bind-addr 0.0.0.0:8080 --auth none &

tail -f /dev/null
