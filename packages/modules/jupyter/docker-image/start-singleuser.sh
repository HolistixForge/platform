#!/bin/sh

echo

id

echo

JSON_SETTINGS="$(echo $SETTINGS | base64 -d)"

echo $JSON_SETTINGS

echo

OAUTH_CLIENT_ID=$(echo "$JSON_SETTINGS" | jq -r '.oauth_clients.jupyterlab.client_id')

PORT=8888
LOCATION="${PROJECT_SERVER_ID}/jupyterlab"
JUPYTERHUB_API_TOKEN="$TOKEN"

OAUTH_REDIRECT_URI="https://${GANYMEDE_FQDN}/dynredir/${LOCATION}/oauth_callback"

echo "GANYMEDE_FQDN: $GANYMEDE_FQDN"
echo "ACCOUNT_FQDN: $ACCOUNT_FQDN"
echo "FRONTEND_FQDN: $FRONTEND_FQDN"
echo "LOCATION: $LOCATION"
echo "OAUTH_CLIENT_ID: $OAUTH_CLIENT_ID"
echo "JUPYTERHUB_API_TOKEN: $JUPYTERHUB_API_TOKEN"
echo "OAUTH_REDIRECT_URI: $OAUTH_REDIRECT_URI"

echo -e "\n\n"

set -x

python3 /usr/local/bin/activity-server.py &

JUPYTERHUB_API_TOKEN="${JUPYTERHUB_API_TOKEN}" \
    JUPYTERHUB_SERVER_NAME="${OAUTH_CLIENT_ID}" \
    JUPYTERHUB_SERVICE_PREFIX="/${LOCATION}/" \
    JUPYTERHUB_SERVICE_URL="http://0.0.0.0:${PORT}/${LOCATION}/" \
    JUPYTERHUB_USER="${OAUTH_CLIENT_ID}" \
    JUPYTERHUB_BASE_URL="/" \
    JUPYTERHUB_OAUTH_ACCESS_SCOPES="[\"access:servers!server=${OAUTH_CLIENT_ID}/\",\"access:servers!user=${OAUTH_CLIENT_ID}\"]" \
    jupyterhub-singleuser \
    --ServerApp.allow_origin="https://${FRONTEND_FQDN}" \
    \
    --HubAuth.api_url="https://${GANYMEDE_FQDN}/jupyterlab" \
    \
    --HubOAuth.oauth_client_id="${OAUTH_CLIENT_ID}" \
    \
    --HubOAuth.oauth_redirect_uri="${OAUTH_REDIRECT_URI}" \
    \
    --HubOAuth.oauth_authorization_url="https://${ACCOUNT_FQDN}/oauth/authorize" \
    \
    --HubOAuth.oauth_token_url="https://${ACCOUNT_FQDN}/oauth/token" \
    \
    --JupyterHubSingleUser.hub_activity_url="http://127.0.0.1:8000/activity" \
    \
    --JupyterHubSingleUser.hub_activity_interval=60 \
    \
    --Application.log_level=DEBUG
