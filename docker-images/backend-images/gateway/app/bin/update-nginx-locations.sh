#!/bin/bash
#
# Update Nginx for User Container Routing (Stage 2)
#
# With distinct FQDNs per container (uc-{uuid}.org-{uuid}.domain.local),
# gateway nginx needs server blocks that route each FQDN to its VPN IP:port.
#
# Input format (stdin): fqdn ip port
# Example:
#   uc-abc123.org-uuid.domain.local 172.16.1.2 8888
#   uc-def456.org-uuid.domain.local 172.16.1.3 5050
#

function success_exit {
  echo -n "{\"status\": \"ok\"}"
  exit 0
}

CONFIG_FILE="/tmp/$(basename ${NGINX_CONFIG})-update"
cp "${NGINX_CONFIG}" "${CONFIG_FILE}"

# Get the directory where the error pages are located (relative to nginx script)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ERROR_PAGES_DIR="$(cd "${SCRIPT_DIR}/../error-pages" && pwd)"

# Remove all server blocks except the base app-gateway blocks (listening on APP_GATEWAY_PORT and 80)
# Keep only the two base server blocks defined in reset-nginx.sh
awk '
BEGIN { in_base_block = 0; base_block_count = 0; }
/^server \{/ {
  # Check if this is one of the first two blocks (app-gateway blocks)
  base_block_count++;
  if (base_block_count <= 2) {
    in_base_block = 1;
    print;
    next;
  } else {
    in_base_block = 0;
    # Skip this entire server block
    brace_count = 1;
    while (brace_count > 0 && (getline > 0)) {
      if ($0 ~ /\{/) brace_count++;
      if ($0 ~ /\}/) brace_count--;
    }
    next;
  }
}
{
  if (in_base_block || base_block_count <= 2) {
    print;
    if ($0 ~ /^\}/) {
      in_base_block = 0;
    }
  }
}
' "${NGINX_CONFIG}" > "${CONFIG_FILE}"

# Read services from stdin and add server blocks for each user container FQDN
while read -r fqdn ip port; do
  if [[ -n "$fqdn" && -n "$ip" && -n "$port" ]]; then
    cat >> "${CONFIG_FILE}" <<EOF

server {
    listen 80;
    server_name ${fqdn};

    # Custom error pages
    error_page 400 401 403 404 500 502 503 504 /error.html;
    
    location = /error.html {
        ssi on;
        internal;
        root ${ERROR_PAGES_DIR};
    }

    location / {
        proxy_pass http://${ip}:${port};
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
  fi
done

# Compare and reload if changed
if ! cmp -s "$CONFIG_FILE" "$NGINX_CONFIG"; then
    sudo cp "$CONFIG_FILE" "$NGINX_CONFIG"
    sudo nginx -s reload
    echo "Configuration updated and nginx reloaded"
else
    echo "No changes in configuration, nginx reload not needed"
fi

success_exit
