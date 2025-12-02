#!/bin/sh

. /usr/local/bin/demiurge-functions.sh

sh -c '. /usr/local/bin/demiurge-functions.sh && vpn_loop' &

# Map pgadmin4 service on its default port
sh -c '. /usr/local/bin/demiurge-functions.sh && map_http_service pgadmin4 5050' &

sudo SETTINGS="${SETTINGS}" -u pgadmin start-pgadmin4.sh

tail -f /dev/null