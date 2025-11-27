#!/bin/bash

# TODO: everything like local-dev except for :
# - we don't create a main dev container, we install directly in the Ubuntu VPS.
# - we will managed SSL certificate with certbot and let's encrypt probably.

# for now, just install docker engine, certbot and python3-certbot-nginx

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "${HERE}/common.sh"

apt update

# Install Docker if not already installed
if ! command -v docker &> /dev/null; then
  # Add Docker's official GPG key:
  apt-get install ca-certificates curl
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc

  # Add the repository to Apt sources:
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
    tee /etc/apt/sources.list.d/docker.list > /dev/null
  apt-get update

  apt install -y \
  docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

# install stuffs
apt install -y \
certbot \
python3-certbot-nginx

# certbot --nginx --non-interactive --agree-tos --email admin@demiurge.co ${DOMAINS}

exit 0
