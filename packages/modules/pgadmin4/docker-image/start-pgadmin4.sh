#!/bin/sh

id

. /usr/local/bin/container-functions.sh

echo
JSON_SETTINGS="$(echo $SETTINGS | base64 -d)"
echo $JSON_SETTINGS
echo

# export PGADMIN_LISTEN_ADDRESS="\"127.0.0.1\""
export PGADMIN_LISTEN_PORT=5050
export PGADMIN_DISABLE_POSTFIX=1
# TODO
export PGADMIN_CONFIG_ALLOWED_HOSTS="[]"
export PGADMIN_DEFAULT_EMAIL="none@noway.com"
export PGADMIN_DEFAULT_PASSWORD="xxx"

# Auth Guard mode: use webserver (trusted proxy) authentication
# The auth guard proxy injects X-Auth-User-Email header after OAuth verification
if [ "${AUTHENTICATION_SOURCES}" = '["webserver"]' ]; then
    export PGADMIN_CONFIG_AUTHENTICATION_SOURCES="['webserver']"

    cat > /pgadmin4/config_local.py <<EOF
# Auth Guard Proxy mode: pgAdmin trusts the reverse proxy header for user identity
WEBSERVER_REMOTE_USER = '${WEBSERVER_REMOTE_USER:-X-Auth-User-Email}'
WEBSERVER_AUTO_CREATE_USER = True
EOF

else
    # Legacy OAuth2 mode (fallback if auth guard is not configured)
    export PGADMIN_CONFIG_AUTHENTICATION_SOURCES="['oauth2']"

    OAUTH2_API_BASE_URL="'https://${GATEWAY_FQDN}/'"
    OAUTH2_CLIENT_ID="'$(echo "$JSON_SETTINGS" | jq -r '.oauth_clients.pgadmin4.client_id // empty')'"
    OAUTH2_CLIENT_SECRET="'$(echo "$JSON_SETTINGS" | jq -r '.oauth_clients.pgadmin4.client_secret // empty')'"
    OAUTH2_TOKEN_URL="'https://${GATEWAY_FQDN}/oauth/token'"
    OAUTH2_AUTHORIZATION_URL="'https://${GATEWAY_FQDN}/oauth/authorize'"

    cat > /pgadmin4/config_local.py <<EOF
OAUTH2_CONFIG = [
    {
        'OAUTH2_NAME': 'HolistixForge',
        'OAUTH2_DISPLAY_NAME': 'HolistixForge',
        'OAUTH2_CLIENT_ID': ${OAUTH2_CLIENT_ID},
        'OAUTH2_CLIENT_SECRET': ${OAUTH2_CLIENT_SECRET},
        'OAUTH2_TOKEN_URL': ${OAUTH2_TOKEN_URL},
        'OAUTH2_AUTHORIZATION_URL': ${OAUTH2_AUTHORIZATION_URL},
        'OAUTH2_SERVER_METADATA_URL': None,
        'OAUTH2_API_BASE_URL': ${OAUTH2_API_BASE_URL},
        'OAUTH2_USERINFO_ENDPOINT': 'user',
        'OAUTH2_SCOPE': 'email',
        'OAUTH2_USERNAME_CLAIM': 'username',
        'OAUTH2_ICON': None,
        'OAUTH2_BUTTON_COLOR': None,
        'OAUTH2_ADDITIONAL_CLAIMS': None,
        'OAUTH2_SSL_CERT_VERIFICATION': True,
        'OAUTH2_LOGOUT_URL': None
    }
]
EOF
fi

/entrypoint.sh
