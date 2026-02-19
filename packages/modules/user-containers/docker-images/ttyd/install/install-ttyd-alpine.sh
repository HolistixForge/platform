#!/bin/sh
#
# Install ttyd and tmux on Alpine Linux
#
# Usage in Dockerfile:
#   RUN /usr/local/bin/install-ttyd-alpine.sh
#

set -e

apk add --no-cache ttyd tmux

echo "ttyd and tmux installed successfully (Alpine)"
