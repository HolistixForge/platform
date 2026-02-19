#!/bin/sh
#
# Install ttyd and tmux on Debian/Ubuntu
#
# Usage in Dockerfile:
#   RUN /usr/local/bin/install-ttyd-debian.sh
#

set -e

apt-get update
apt-get install -y --no-install-recommends ttyd tmux
rm -rf /var/lib/apt/lists/*

echo "ttyd and tmux installed successfully (Debian/Ubuntu)"
