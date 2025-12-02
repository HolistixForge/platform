#!/bin/bash

. /usr/local/bin/demiurge-functions.sh

sh -c '. /usr/local/bin/demiurge-functions.sh && vpn_loop' &

# Map jupyterlab service on its default port
sh -c '. /usr/local/bin/demiurge-functions.sh && map_http_service jupyterlab 8888' &

tini -s -g -- start.sh start-singleuser.sh
