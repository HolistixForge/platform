#!/bin/sh
. /usr/local/bin/demiurge-functions.sh
sh -c '. /usr/local/bin/demiurge-functions.sh && vpn_loop' &
sh -c '. /usr/local/bin/demiurge-functions.sh && map_http_service "$@"' _ webapp 8888 &
tail -f /dev/null