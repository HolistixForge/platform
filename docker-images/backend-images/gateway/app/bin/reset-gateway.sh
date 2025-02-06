#!/bin/bash

set -euo pipefail

function success_exit {
    echo "{\"status\": \"ok\"}"
    exit 0
}

function reset_gateway {
    lib/stop-vpn.sh

    lib/stop-app-collab.sh

    lib/reset-nginx.sh

    lib/start-vpn.sh

    lib/start-app-collab.sh
}

export -f reset_gateway

nohup setsid bash -c 'reset_gateway' >/tmp/gateway.log 2>&1 &

success_exit
