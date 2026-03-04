#!/bin/sh

. /usr/local/bin/container-functions.sh

# Start auth guard proxy (must start before services so it can intercept traffic)
start_auth_guard

sh -c '. /usr/local/bin/container-functions.sh && vpn_loop' &

# Map n8n service on its default port
# If auth guard is running, map_http_service registers with guard and reports guard port
sh -c '. /usr/local/bin/container-functions.sh && map_http_service n8n 5678' &

# Disable n8n built-in authentication (auth guard handles it)
export N8N_AUTH_ENABLED=false

# Start n8n without path prefix (distinct FQDN routing)
/docker-entrypoint.sh &

tail -f /dev/null
