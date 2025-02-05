#!/bin/bash

if [ -z "GATEWAY_DEV" ]; then
    # prod
    echo TODO_GATEWAY
else
    # dev
    set -x

    PLEARNT="$WORKSPACE/plearnt"
    cd "$PLEARNT"

    SERVER_BIND="[{\"host\": \"127.0.0.1\", \"port\": 8888}]" \
        ACCOUNT_FQDN="${ACCOUNT_FQDN}" \
        GANYMEDE_FQDN="${GANYMEDE_FQDN}" \
        ALLOWED_ORIGINS="${ALLOWED_ORIGINS}" \
        SCRIPTS_DIR="${SCRIPTS_DIR}" \
        npx nx run app-collab:serve:development --no-cloud --verbose 2>&1 | tee -a /tmp/gateway.log &
fi

# TODO: YPERSISTENCE=/tmp/ypersistence ?
