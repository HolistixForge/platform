#!/bin/bash

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "${HERE}/common.sh"

apt update && apt upgrade

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

# install stuffs
apt install -y \
nginx \
certbot \
python3-certbot-nginx \
docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# make nginx config

rm -f /etc/nginx/sites-enabled/default

# Check that environment variables are defined
if [[ -z "$ENV_NAME" || -z "$DOMAIN_NAME" || -z "$GW_INSTANCE_ID" || -z "$GW_COUNT" ]]; then
  echo -e "\nOne or more required environment variables are not defined."
  echo ENV_NAME=${ENV_NAME} DOMAIN_NAME=${DOMAIN_NAME} GW_INSTANCE_ID=${GW_INSTANCE_ID} GW_COUNT=${GW_COUNT}
  exit 1
fi


for (( COUNT=1; COUNT<=GW_COUNT; COUNT++ )); do
  PORT=$(get_app_port $COUNT)
  SERVER_NAME=gw-${GW_INSTANCE_ID}-${COUNT}.${ENV_NAME}.${DOMAIN_NAME}
  SERVER_CONFIG="/etc/nginx/sites-available/${SERVER_NAME}"
  cat <<EOF >"$SERVER_CONFIG"
server {
    listen 80;
    server_name ${SERVER_NAME};

    error_page 502 /502.html;
    location /502.html {
        internal;
        add_header Content-Type text/html;
        return 502 '<html><body><h1>502 Bad Gateway</h1><p>Something went wrong. Please try again later. (gws-pool-instance)</p></body></html>';
    }

    location / {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
  ln -s "$SERVER_CONFIG" "/etc/nginx/sites-enabled/"
done

systemctl start nginx
systemctl enable nginx
certbot --nginx --non-interactive --agree-tos --email admin@demiurge.co

exit 0

# allow routing

# sysctl_conf="/etc/sysctl.conf"
# parameter="net.ipv4.ip_forward=1"
# if ! grep -Fx "$parameter" "$sysctl_conf"; then
#     echo "$parameter" | tee -a "$sysctl_conf" > /dev/null
# fi
# sysctl -p
