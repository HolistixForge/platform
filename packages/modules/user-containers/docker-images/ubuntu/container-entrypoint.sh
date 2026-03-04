#!/bin/sh

. /usr/local/bin/container-functions.sh

# Start auth guard proxy (must start before services so it can intercept traffic)
start_auth_guard

# Start VPN + watchdog loop in background
sh -c '. /usr/local/bin/container-functions.sh && vpn_loop' &

# Start ttyd web terminal on port 7681 (default ttyd port)
# start-ttyd.sh uses -W (writable) and -a (URL arg) flags
# terminal-session.sh creates/attaches to named tmux sessions
# All users with the same session name share the terminal
sh -c '/usr/local/bin/start-ttyd.sh 7681' &

# Map terminal service to gateway (gateway routes uc-{uuid}.org-{uuid}.domain.local directly to VPN IP:port)
# If auth guard is running, map_http_service registers with guard and reports guard port
sh -c '. /usr/local/bin/container-functions.sh && map_http_service terminal 7681' &

# Keep container running
tail -f /dev/null
