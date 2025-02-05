#!/bin/bash

. /usr/local/bin/demiurge-functions.sh

sh -c '. /usr/local/bin/demiurge-functions.sh && vpn_loop' &

sh -c '. /usr/local/bin/demiurge-functions.sh && map_http_service "$@"' _ jupyterlab 8888 &

tini -s -g -- start.sh start-singleuser.sh
