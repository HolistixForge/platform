#!/bin/bash

. /usr/local/bin/container-functions.sh

# The token that opens JupyterLab, minted before anything that needs it.
#
# The guard presents it upstream on every request it has already authorized, so
# the browser never carries a Jupyter token of its own — handing one over would
# give the notebook's whole API to whoever holds the page, undoing the per-user
# check the guard just made against the gateway.
#
# Before `start_auth_guard`, necessarily: the guard reads it once, at startup,
# and a value exported afterwards is a flag it never saw.
HUB_API_TOKEN=$(python3 -c "import secrets; print(secrets.token_hex(32))")
export AUTH_GUARD_UPSTREAM_TOKEN="${HUB_API_TOKEN}"

# Start auth guard proxy (must start before services so it can intercept traffic)
start_auth_guard

sh -c '. /usr/local/bin/container-functions.sh && vpn_loop' &

# Map jupyterlab service on its default port
# If auth guard is running, map_http_service registers with guard and reports guard port
sh -c '. /usr/local/bin/container-functions.sh && map_http_service jupyterlab 8888' &

# --- Hub OAuth Proxy ---
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
#
# A service is a suffix on the container's own label, not a label of its own:
# `uc-<id>--<space>--jupyterlab.org-<uuid>.<domain>`, two below the domain
# rather than three. A TLS wildcard covers exactly one label, so the third
# level is what forced a certificate per container; folded in here, one
# wildcard per organization covers every service.
#
# AUTH_GUARD_SERVICE_PREFIX is everything left of the service name, handed over
# by the gateway rather than assembled here. These names have to agree with
# what the gateway publishes character for character — they are OAuth callbacks
# and nginx routes them by exact `server_name` — and the rule that builds them
# lives, with its tests, in
# packages/modules/user-containers/src/lib/service-fqdn.ts.
DOMAIN=$(echo "$GATEWAY_FQDN" | sed 's/^[^.]*\.//')
BASE_FQDN="uc-${AUTH_GUARD_CONTAINER_ID}.org-${AUTH_GUARD_ORG_ID}.${DOMAIN}"
JUPYTER_FQDN="${AUTH_GUARD_SERVICE_PREFIX}--jupyterlab.org-${AUTH_GUARD_ORG_ID}.${DOMAIN}"
HUB_FQDN="${AUTH_GUARD_SERVICE_PREFIX}--guard-hub.org-${AUTH_GUARD_ORG_ID}.${DOMAIN}"

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

# Who may put this notebook in a frame.
#
# JupyterLab sends `frame-ancestors 'none'; default-src 'none'` of its own, and
# a browser enforces the intersection of every Content-Security-Policy header on
# a response — so the gateway adding `frame-ancestors <platform>` alongside it
# produces `'none'` ∩ `<platform>`, which is nothing. The notebook then fails to
# render inside the project with ERR_BLOCKED_BY_RESPONSE, while answering 200 to
# anything that is not a frame.
#
# Set here rather than stripped at the gateway: this is our image, and it can
# say who may frame it. A third-party image with the same policy is still
# unframeable, and that is the general problem the gateway will have to answer.
#
# `frame-ancestors` and nothing else. The policy Jupyter ships also carries
# `default-src 'none'`, which is right on the JSON its API returns and would be
# fatal on the page: this header replaces Jupyter's rather than adding to it, so
# a `default-src` copied across would block the notebook's own scripts and
# styles and leave a blank frame instead of a blocked one.
#
# ${DOMAIN} carries the port wherever nginx is not on 443, and an origin
# includes it — the one place a port belongs in this file.
CSP_FRAME_ANCESTORS="frame-ancestors https://${DOMAIN} https://*.${DOMAIN}"

exec start.sh jupyterhub-singleuser \
    --ServerApp.ip='0.0.0.0' \
    --ServerApp.port=8888 \
    --ServerApp.allow_origin='*' \
    --ServerApp.disable_check_xsrf=True \
    --ServerApp.tornado_settings="{'headers': {'Content-Security-Policy': \"${CSP_FRAME_ANCESTORS}\"}}" \
    --HubAuth.api_url="http://localhost:15000/hub/api" \
    --HubOAuth.oauth_authorization_url="https://${HUB_FQDN}/hub/api/oauth2/authorize" \
    --HubOAuth.oauth_token_url="http://localhost:15000/hub/api/oauth2/token" \
    --HubOAuth.oauth_redirect_uri="https://${JUPYTER_FQDN}/oauth_callback" \
    --HubOAuth.oauth_client_id="jupyterlab-local" \
    --no-browser
