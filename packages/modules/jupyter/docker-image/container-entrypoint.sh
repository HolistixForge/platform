#!/bin/bash

. /usr/local/bin/container-functions.sh

# Start auth guard proxy (must start before services so it can intercept traffic)
start_auth_guard

sh -c '. /usr/local/bin/container-functions.sh && vpn_loop' &

# Map jupyterlab service on its default port
# If auth guard is running, map_http_service registers with guard and reports guard port
sh -c '. /usr/local/bin/container-functions.sh && map_http_service jupyterlab 8888' &

# --- Hub OAuth Proxy ---
# Generate a shared API token for server-to-server communication
HUB_API_TOKEN=$(python3 -c "import secrets; print(secrets.token_hex(32))")

# Start the hub OAuth proxy on localhost:15000
python3 /usr/local/bin/hub-oauth-proxy.py --port 15000 --api-token "$HUB_API_TOKEN" &

# Wait for hub proxy to become healthy
for i in $(seq 1 20); do
    curl -s -o /dev/null http://localhost:15000/health 2>/dev/null && break
    sleep 0.25
done

# Announce the hub proxy the same way the notebook itself is announced.
#
# It was registered with the auth guard only, and the guard's router is not
# what puts a name on the network: `map_http_service` is, by reporting it to
# the gateway, which writes the nginx server block. So JupyterLab redirected
# the browser to `__guard_hub.uc-….{domain}` — a name the gateway had never
# been told about — the request fell through to app-gateway, and the notebook
# ended on "Cannot GET /hub/api/oauth2/authorize" after a login that had just
# succeeded.
#
# `map_http_service` does both halves: it registers with the guard's admin API
# when the guard is up, and reports to the gateway either way. Backgrounded
# because it loops, like the jupyterlab one above.
sh -c '. /usr/local/bin/container-functions.sh && map_http_service __guard_hub 15000' &

# Build FQDNs for OAuth URLs
DOMAIN=$(echo "$GATEWAY_FQDN" | sed 's/^[^.]*\.//')
BASE_FQDN="uc-${AUTH_GUARD_CONTAINER_ID}.org-${AUTH_GUARD_ORG_ID}.${DOMAIN}"
JUPYTER_FQDN="jupyterlab.${BASE_FQDN}"
HUB_FQDN="__guard_hub.${BASE_FQDN}"

# Start activity server for gateway heartbeats
python3 /usr/local/bin/activity-server.py &

# Launch jupyterhub-singleuser as jovyan user via start.sh (handles root→jovyan switch)
export JUPYTERHUB_API_TOKEN="${HUB_API_TOKEN}"
export JUPYTERHUB_SERVICE_PREFIX="/"
export JUPYTERHUB_SERVICE_URL="http://0.0.0.0:8888/"
export JUPYTERHUB_USER="jupyter-user"
export JUPYTERHUB_BASE_URL="/"
export JUPYTERHUB_CLIENT_ID="jupyterlab-local"
export JUPYTERHUB_OAUTH_ACCESS_SCOPES='["access:servers!server=jupyter-user/","access:servers!user=jupyter-user"]'
export JUPYTERHUB_OAUTH_SCOPES='["access:servers!server=jupyter-user/","access:servers!user=jupyter-user"]'
export JUPYTERHUB_OAUTH_CALLBACK_URL="https://${JUPYTER_FQDN}/oauth_callback"

exec start.sh jupyterhub-singleuser \
    --ServerApp.ip='0.0.0.0' \
    --ServerApp.port=8888 \
    --ServerApp.allow_origin='*' \
    --ServerApp.disable_check_xsrf=True \
    --HubAuth.api_url="http://localhost:15000/hub/api" \
    --HubOAuth.oauth_authorization_url="https://${HUB_FQDN}/hub/api/oauth2/authorize" \
    --HubOAuth.oauth_token_url="http://localhost:15000/hub/api/oauth2/token" \
    --HubOAuth.oauth_redirect_uri="https://${JUPYTER_FQDN}/oauth_callback" \
    --HubOAuth.oauth_client_id="jupyterlab-local" \
    --no-browser
