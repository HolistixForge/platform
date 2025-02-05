#!/bin/sh

. /usr/local/bin/demiurge-functions.sh

sh -c '. /usr/local/bin/demiurge-functions.sh && vpn_loop' &

sh -c '. /usr/local/bin/demiurge-functions.sh && map_http_service "$@"' _ pgadmin4 8888 &

sudo SETTINGS="${SETTINGS}" -u pgadmin start-pgadmin4.sh

tail -f /dev/null