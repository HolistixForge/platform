#!/bin/sh
#
# Install ttyd and tmux on RHEL/Fedora/CentOS
#
# Usage in Dockerfile:
#   RUN /usr/local/bin/install-ttyd-rhel.sh
#
# Note: ttyd may need EPEL repository on older RHEL/CentOS versions
#

set -e

# Try dnf first (Fedora, RHEL 8+), fall back to yum
if command -v dnf >/dev/null 2>&1; then
    dnf install -y ttyd tmux
    dnf clean all
elif command -v yum >/dev/null 2>&1; then
    yum install -y epel-release
    yum install -y ttyd tmux
    yum clean all
else
    echo "Error: Neither dnf nor yum found" >&2
    exit 1
fi

echo "ttyd and tmux installed successfully (RHEL/Fedora)"
