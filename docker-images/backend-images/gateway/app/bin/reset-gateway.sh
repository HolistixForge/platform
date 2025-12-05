#!/bin/bash
# Reset gateway infrastructure (VPN, Nginx) and restart app-gateway
# 
# IMPORTANT: This script kills the calling process (app-gateway) during reset.
# It MUST be wrapped in nohup/setsid when called from app-gateway to prevent
# the calling process from being killed before the script completes.
# 
# When called from entrypoint, it runs in background and entrypoint keeps container alive.

set -euo pipefail

function success_exit {
    echo "{\"status\": \"ok\"}"
    exit 0
}

function reset_gateway {
    # Get script directory using GATEWAY_ROOT
    GATEWAY_ROOT=${GATEWAY_ROOT:-"/opt/gateway"}
    SCRIPT_DIR="${GATEWAY_ROOT}/app"
    
    # Create marker file to signal that reset is in progress
    # This tells start-app-gateway.sh to exit instead of restarting when process dies
    touch /tmp/gateway-resetting
    
    # Stop VPN
    "${SCRIPT_DIR}/lib/stop-vpn.sh"

    # Stop app-gateway (this will kill the calling process if called from app-gateway)
    "${SCRIPT_DIR}/lib/stop-app-gateway.sh"

    # Reset Nginx
    "${SCRIPT_DIR}/lib/reset-nginx.sh"

    # Start VPN
    "${SCRIPT_DIR}/lib/start-vpn.sh"

    # Start app-gateway with hot-reload (always in background)
    nohup setsid bash -c "${SCRIPT_DIR}/lib/start-app-gateway.sh" >/tmp/gateway.log 2>&1 &
    
    # Remove marker file after starting new app-gateway
    # Small delay to ensure old process has exited and new one is starting
    sleep 1
    rm -f /tmp/gateway-resetting
}

export -f reset_gateway

# Always wrap in nohup/setsid to prevent the calling process from being killed
# before the reset completes. This works for both entrypoint and app-gateway calls.
nohup setsid bash -c 'reset_gateway' >/tmp/reset-gateway.log 2>&1 &

success_exit
