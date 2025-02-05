#!/bin/bash

function success_exit {
  echo -n "{\"status\": \"ok\"}"
  exit 0
}

function log {
  echo # "$1" >> /tmp/nimp
}


CONFIG_FILE="/tmp/$(basename ${NGINX_CONFIG})-"
cp "${NGINX_CONFIG}" "${CONFIG_FILE}"

log $CONFIG_FILE

# Function to remove all location blocks except 'collab' and '/502.html' in the first server block
remove_non_collab_locations() {
  local start_line=$(grep -n "server {" "$CONFIG_FILE" | head -n 1 | cut -d: -f1)
  local end_line=$(sed -n "$start_line,/}/=" "$CONFIG_FILE" | tail -n 1)

  # Loop to remove location blocks until only 'collab' and '/502.html' remain
  while true; do
    # Find the first location block that is not 'collab' or '/502.html'
    local location_line=$(sed -n "${start_line},${end_line}{/location/!b; /location \/collab/b; /location \/502.html/b; =; q}" "$CONFIG_FILE")

    # If no non-collab and non-502.html location block is found, break the loop
    if [ -z "$location_line" ]; then
      break
    fi

    # Remove the found location block
    sed -i "${location_line}{:a;N;/}/!ba;d}" "$CONFIG_FILE"
  done

  log "Removed all existing location blocks except 'collab' and '/502.html' in the first server block"
}

# Function to add a location block
add_location_block() {
  local service=$1
  local ip=$2
  local port=$3

  # Check if the service name is 'collab'
  if [[ "$service" == "collab" ]]; then
    log "Skipping 'collab' service: forbidden name"
    return
  fi

  # Find the first server block
  server_block_line=$(grep -n "server {" "$CONFIG_FILE" | head -n 1 | cut -d: -f1)

  # Prepare the new location block
  new_block="
    location /$service {
        proxy_pass http://$ip:$port;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection upgrade;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_hide_header Content-Security-Policy;
        add_header Content-Security-Policy \"frame-ancestors 'self' https://${ENV_NAME}.demiurge.co https://frontend.${ENV_NAME}.demiurge.co;\";
    }"

  # Insert the new block after the server block line
  sed -i "${server_block_line}r /dev/stdin" "$CONFIG_FILE" <<<"$new_block"
  log "Added location block for /$service"
}

# Remove all existing location blocks except 'collab'
remove_non_collab_locations

# Read services from stdin and add new location blocks
while read -r service ip port; do
  # Skip empty lines and 'collab' service
  if [[ -n "$service" && -n "$ip" && -n "$port" && "$service" != "collab" ]]; then
    add_location_block "$service" "$ip" "$port"
  fi
done

# Remove multiple new lines
sed -i '/^$/N;/^\n$/D' "$CONFIG_FILE"

log "Removed multiple new lines from the configuration file"

log "Configuration update complete"


# Compare the content of CONFIG_FILE with NGINX_CONFIG
if ! cmp -s "$CONFIG_FILE" "$NGINX_CONFIG"; then
    # If files are different, copy CONFIG_FILE to NGINX_CONFIG and reload nginx
    sudo cp "$CONFIG_FILE" "$NGINX_CONFIG"
    sudo nginx -s reload
    log "Configuration updated and nginx reloaded"
else
    log "No changes in configuration, nginx reload not needed"
fi

success_exit
