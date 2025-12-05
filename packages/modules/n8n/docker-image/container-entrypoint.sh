#!/bin/sh

. /usr/local/bin/container-functions.sh

sh -c '. /usr/local/bin/container-functions.sh && vpn_loop' &

# Map n8n service on its default port
sh -c '. /usr/local/bin/container-functions.sh && map_http_service n8n 5678' &

# Start n8n without path prefix (distinct FQDN routing)
/docker-entrypoint.sh &

tail -f /dev/null