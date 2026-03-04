#!/bin/bash

. /usr/local/bin/container-functions.sh

# Start auth guard proxy (must start before services so it can intercept traffic)
start_auth_guard

sh -c '. /usr/local/bin/container-functions.sh && vpn_loop' &

# Map jupyterlab service on its default port
# If auth guard is running, map_http_service registers with guard and reports guard port
sh -c '. /usr/local/bin/container-functions.sh && map_http_service jupyterlab 8888' &

# Start JupyterLab directly (no JupyterHub single-user)
# Auth is handled by the auth guard proxy - disable native token/password auth
jupyter lab \
    --ServerApp.token='' \
    --ServerApp.password='' \
    --ServerApp.ip='0.0.0.0' \
    --ServerApp.port=8888 \
    --ServerApp.allow_origin='*' \
    --ServerApp.disable_check_xsrf=True \
    --no-browser
