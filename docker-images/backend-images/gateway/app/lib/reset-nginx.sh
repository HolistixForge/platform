#!/bin/bash
set -x
sudo rm -rf /var/log/nginx/access.log /var/log/nginx/error.log

env

# Base nginx config for gateway
# Two server blocks:
#   1. Gateway FQDN (from browser via Stage 1 nginx) - routes all to app-gateway
#   2. VPN IP (from user containers) - routes all to app-gateway
# Dynamic server blocks (added by update-nginx-locations.sh):
#   - uc-{uuid}.org-{uuid}.domain.local → container VPN IP:port
sudo tee "${NGINX_CONFIG}" >/dev/null <<EOF

server {
    listen ${APP_GATEWAY_PORT};
    server_name _;  # Accept all hostnames (org-{uuid}.domain.local routes here via Stage 1)

    error_page 502 /502.html;
    location /502.html {
        internal;
        add_header Content-Type text/html;
        return 502 '<html><body><h1>502 Bad Gateway</h1><p>Something went wrong. Please try again later.</p></body></html>';
    }

    location / {
        proxy_pass http://127.0.0.1:8888;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}

server {
    listen 80;
    server_name 172.16.0.1;

    error_page 502 /502.html;
    location /502.html {
        internal;
        add_header Content-Type text/html;
        return 502 '<html><body><h1>502 Bad Gateway</h1><p>Something went wrong. Please try again later.</p></body></html>';
    }

    location / {
        proxy_pass http://127.0.0.1:8888;
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

pgrep -fa "nginx: master process"

if ! pgrep -f "nginx: master process" >/dev/null; then
    sudo nginx
else
    sudo nginx -s reload
fi
