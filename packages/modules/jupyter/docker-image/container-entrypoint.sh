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

# Register hub proxy with auth guard so browser-facing /hub/api/oauth2/authorize
# goes through the guard (which injects X-Auth-* headers)
if [ "${AUTH_GUARD_RUNNING:-0}" = "1" ]; then
    curl -s -X POST http://localhost:9999/services/register \
        -H "Content-Type: application/json" \
        -d '{"name":"__guard_hub","port":15000}'
fi

# Build FQDNs for OAuth URLs
#
# A service is a suffix on the container's own label, not a label of its own:
# `uc-<id>--jupyterlab.org-<uuid>.<domain>`, two below the domain rather than
# three. A TLS wildcard covers exactly one label, so the third level is what
# forced a certificate per container; folded in here, one wildcard per
# organization covers every service. These two names have to agree, character
# for character, with what the gateway publishes — see
# packages/modules/user-containers/src/lib/service-fqdn.ts, which is where the
# rule lives and where it is tested.
DOMAIN=$(echo "$GATEWAY_FQDN" | sed 's/^[^.]*\.//')
CONTAINER_LABEL="uc-${AUTH_GUARD_CONTAINER_ID}"
BASE_FQDN="${CONTAINER_LABEL}.org-${AUTH_GUARD_ORG_ID}.${DOMAIN}"
JUPYTER_FQDN="${CONTAINER_LABEL}--jupyterlab.org-${AUTH_GUARD_ORG_ID}.${DOMAIN}"
HUB_FQDN="${CONTAINER_LABEL}--guard-hub.org-${AUTH_GUARD_ORG_ID}.${DOMAIN}"

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
