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

# Map terminal service to gateway
# If auth guard is running, map_http_service registers with guard and reports guard port
sh -c '. /usr/local/bin/container-functions.sh && map_http_service terminal 7681' &

# Start code-server on port 8080
# --auth none: disable auth (auth guard handles authentication)
# --bind-addr: listen on all interfaces
# --disable-telemetry: disable telemetry
sh -c 'code-server --auth none --bind-addr 0.0.0.0:8080 --disable-telemetry /workspace' &

# Map code-server service to gateway
sh -c '. /usr/local/bin/container-functions.sh && map_http_service vscode 8080' &

# Keep container running
tail -f /dev/null
