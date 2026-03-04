#!/bin/sh

. /usr/local/bin/container-functions.sh

# Start auth guard proxy (must start before services so it can intercept traffic)
start_auth_guard

sh -c '. /usr/local/bin/container-functions.sh && vpn_loop' &

# Map pgadmin4 service on its default port
# If auth guard is running, map_http_service registers with guard and reports guard port
sh -c '. /usr/local/bin/container-functions.sh && map_http_service pgadmin4 5050' &

# Configure pgAdmin for trusted proxy mode (auth guard injects user headers)
export AUTHENTICATION_SOURCES='["webserver"]'
export WEBSERVER_REMOTE_USER='X-Auth-User-Email'

sudo SETTINGS="${SETTINGS}" \
    AUTHENTICATION_SOURCES="${AUTHENTICATION_SOURCES}" \
    WEBSERVER_REMOTE_USER="${WEBSERVER_REMOTE_USER}" \
    -u pgadmin start-pgadmin4.sh

tail -f /dev/null
