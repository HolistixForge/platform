#!/bin/bash

if [ -z "GATEWAY_DEV" ]; then
    # prod
    echo TODO_GATEWAY
else
    # dev
    set -x

    REPO_ROOT="$WORKSPACE/monorepo"
    cd "$REPO_ROOT"

    ls -l ./dist

    SERVER_BIND="[{\"host\": \"127.0.0.1\", \"port\": 8888}]" \
        ACCOUNT_FQDN="${ACCOUNT_FQDN}" \
        GANYMEDE_FQDN="${GANYMEDE_FQDN}" \
        ALLOWED_ORIGINS="${ALLOWED_ORIGINS}" \
        SCRIPTS_DIR="${SCRIPTS_DIR}" \
        node ./dist/packages/app-collab/main.js 2>&1 | tee -a /tmp/gateway.log &
fi

# TODO: YPERSISTENCE=/tmp/ypersistence ?
