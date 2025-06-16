#!/bin/sh

. /usr/local/bin/demiurge-functions.sh

sh -c '. /usr/local/bin/demiurge-functions.sh && vpn_loop true' &

sh -c '. /usr/local/bin/demiurge-functions.sh && map_http_service "$@"' _ n8n 8888 &

N8N_PATH=/${PROJECT_SERVER_ID}/n8n/ /docker-entrypoint.sh &

tail -f /dev/null