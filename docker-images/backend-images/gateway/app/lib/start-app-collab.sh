#!/bin/bash

if [ -z "GATEWAY_DEV" ]; then
    # prod
    echo TODO_GATEWAY
else
    # dev
    set -x

    REPO_ROOT="$WORKSPACE/monorepo"
    cd "$REPO_ROOT"

    while true; do
        SERVER_BIND="[{\"host\": \"127.0.0.1\", \"port\": 8888}]" \
        GATEWAY_FQDN="${GATEWAY_FQDN}" \
        ACCOUNT_FQDN="${ACCOUNT_FQDN}" \
        GANYMEDE_FQDN="${GANYMEDE_FQDN}" \
        ALLOWED_ORIGINS="${ALLOWED_ORIGINS}" \
        SCRIPTS_DIR="${SCRIPTS_DIR}" \
        node --enable-source-maps ./dist/packages/app-collab/main.js 2>&1 | tee -a /tmp/gateway.log &
        
        APP_PID=$!
        
        # Wait for changes to main.js
        inotifywait -e modify ./restart-app-inotify

        echo "########## Restarting app-collab ##########"
        
        # Kill the previous instance
        kill $APP_PID
        wait $APP_PID 2>/dev/null
    done
fi
