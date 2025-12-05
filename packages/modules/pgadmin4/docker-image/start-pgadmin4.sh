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
export PGADMIN_CONFIG_AUTHENTICATION_SOURCES="['oauth2']"
# TODO
export PGADMIN_CONFIG_ALLOWED_HOSTS="[]"
export PGADMIN_DEFAULT_EMAIL="none@noway.com"
export PGADMIN_DEFAULT_PASSWORD="xxx"

OAUTH2_API_BASE_URL="'https://${GATEWAY_FQDN}/'"
OAUTH2_CLIENT_ID="'$(echo "$JSON_SETTINGS" | jq -r '.oauth_clients.pgadmin4.client_id')'"
OAUTH2_CLIENT_SECRET="'$(echo "$JSON_SETTINGS" | jq -r '.oauth_clients.pgadmin4.client_secret')'"
OAUTH2_TOKEN_URL="'https://${GATEWAY_FQDN}/oauth/token'"
OAUTH2_AUTHORIZATION_URL="'https://${GATEWAY_FQDN}/oauth/authorize'"

cat > /pgadmin4/config_local.py <<EOF
OAUTH2_CONFIG = [
    {
        # The name of the of the oauth provider, ex: github, google
        'OAUTH2_NAME': 'HolistixForge',
        # The display name, ex: Google
        'OAUTH2_DISPLAY_NAME': 'HolistixForge',
        # Oauth client id
        'OAUTH2_CLIENT_ID': ${OAUTH2_CLIENT_ID},
        # Oauth secret
        'OAUTH2_CLIENT_SECRET': ${OAUTH2_CLIENT_SECRET},
        # URL to generate a token,
        # Ex: https://github.com/login/oauth/access_token
        'OAUTH2_TOKEN_URL': ${OAUTH2_TOKEN_URL},
        # URL is used for authentication,
        # Ex: https://github.com/login/oauth/authorize
        'OAUTH2_AUTHORIZATION_URL': ${OAUTH2_AUTHORIZATION_URL},
        # server metadata url might optional for your provider
        'OAUTH2_SERVER_METADATA_URL': None,
        # Oauth base url, ex: https://api.github.com/
        'OAUTH2_API_BASE_URL': ${OAUTH2_API_BASE_URL},
        # Name of the Endpoint, ex: user
        'OAUTH2_USERINFO_ENDPOINT': 'user',
        # Oauth scope, ex: 'openid email profile'
        # Note that an 'email' claim is required in the resulting profile
        'OAUTH2_SCOPE': 'email',
        # The claim which is used for the username. If the value is empty the
        # email is used as username, but if a value is provided,
        # the claim has to exist.
        'OAUTH2_USERNAME_CLAIM': 'username',
        # Font-awesome icon, ex: fa-github
        'OAUTH2_ICON': None,
        # UI button colour, ex: #0000ff
        'OAUTH2_BUTTON_COLOR': None,
        # The additional claims to check on user ID Token or Userinfo response.
        # This is useful to provide additional authorization checks
        # before allowing access.
        # Example for GitLab: allowing all maintainers teams, and a specific
        # developers group to access pgadmin:
        # 'OAUTH2_ADDITIONAL_CLAIMS': {
        #     'https://gitlab.org/claims/groups/maintainer': [
        #           'kuberheads/applications',
        #           'kuberheads/dba',
        #           'kuberheads/support'
        #      ],
        #     'https://gitlab.org/claims/groups/developer': [
        #           'kuberheads/applications/team01'
        #      ],
        # }
        # Example for AzureAD:
        # 'OAUTH2_ADDITIONAL_CLAIMS': {
        #     'groups': ["0760b6cf-170e-4a14-91b3-4b78e0739963"],
        #     'wids': ["cf1c38e5-3621-4004-a7cb-879624dced7c"],
        # }
        'OAUTH2_ADDITIONAL_CLAIMS': None,
        # Set this variable to False to disable SSL certificate verification
        # for OAuth2 provider.
        # This may need to set False, in case of self-signed certificates.
        # Ref: https://github.com/psf/requests/issues/6071
        'OAUTH2_SSL_CERT_VERIFICATION': True,
        # set this variable to invalidate the session of the oauth2 provider
        # Example for keycloak:
        # 'OAUTH2_LOGOUT_URL':
        # 'https://example.com/realms/master/protocol/openid-connect/logout?post_logout_redirect_uri={redirect_uri}&id_token_hint={id_token}'
        'OAUTH2_LOGOUT_URL': None
    }
]
EOF

/entrypoint.sh