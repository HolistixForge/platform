#!/bin/sh
#
# Terminal session wrapper for ttyd
# Creates or attaches to a named tmux session
#
# Usage: terminal-session.sh [session_name]
# - If session_name is provided, use it
# - Otherwise, use "default"
#

SESSION_NAME="${1:-default}"

# Sanitize session name (alphanumeric, dash, underscore only)
SESSION_NAME=$(echo "$SESSION_NAME" | tr -cd '[:alnum:]-_' | head -c 32)

# Default to "default" if empty after sanitization
SESSION_NAME="${SESSION_NAME:-default}"

# Create or attach to the tmux session
# -A: attach if exists, create if not
# -s: session name
exec tmux new-session -A -s "$SESSION_NAME"
