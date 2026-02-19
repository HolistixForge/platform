#!/bin/sh
#
# Start ttyd web terminal with shared tmux sessions
#
# Usage: start-ttyd.sh [port]
#   port: Port to listen on (default: 7681)
#
# Features:
#   - Multiple named sessions via URL: ?arg=session_name
#   - All users with same session name share the terminal
#   - Sessions persist even if all users disconnect
#
# URL examples:
#   http://host:7681/          → "default" session
#   http://host:7681/?arg=dev  → "dev" session
#

PORT="${1:-7681}"

# -W: writable mode (allow user input)
# -a: accept URL ?arg= parameter and pass to command
exec ttyd -W -a -p "$PORT" /usr/local/bin/terminal-session.sh
