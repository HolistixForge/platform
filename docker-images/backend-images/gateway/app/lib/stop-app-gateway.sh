#!/bin/bash

if [ -z "GATEWAY_DEV" ]; then
    # prod
    echo TODO_GATEWAY
else
    # dev
    PGIDS=$(ps ax -o "pgid,cmd" | grep '[n]ode .*app-gateway/main.js' | awk '{print $1}')
    echo "$PGIDS" | while read PGID; do
        if ! [ -z "${PGID}" ]; then
            echo "kill process PGID $PGID"
            kill -TERM -- -"${PGID}"
        fi
    done
fi

rm -f /tmp/project-config.json
