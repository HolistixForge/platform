#/bin/sh

export GW_FILE="/tmp/gateway"

GATEWAY_VPN_IP="172.16.0.1"

extract_settings() {
    JSON_SETTINGS="$(echo "$SETTINGS" | base64 -d)"

    export HOST_USER_ID=$(echo "$JSON_SETTINGS" | jq -r '.user_id')
    export GANYMEDE_FQDN=$(echo "$JSON_SETTINGS" | jq -r '.ganymede_fqdn')
    export FRONTEND_FQDN=$(echo "$JSON_SETTINGS" | jq -r '.frontend_fqdn')
    export GATEWAY_FQDN=$(echo "$JSON_SETTINGS" | jq -r '.gateway_fqdn')
    export TOKEN=$(echo "$JSON_SETTINGS" | jq -r '.token')
    export PROJECT_ID=$(echo "$JSON_SETTINGS" | jq -r '.project_id')
    export USER_CONTAINER_ID=$(echo "$JSON_SETTINGS" | jq -r '.user_container_id')

    # Auth Guard Proxy settings (per-container OAuth client)
    export AUTH_GUARD_CLIENT_ID=$(echo "$JSON_SETTINGS" | jq -r '.auth_guard.client_id // empty')
    export AUTH_GUARD_CLIENT_SECRET=$(echo "$JSON_SETTINGS" | jq -r '.auth_guard.client_secret // empty')
    export AUTH_GUARD_CONTAINER_ID=$(echo "$JSON_SETTINGS" | jq -r '.auth_guard.container_id // empty')
    export AUTH_GUARD_ORG_ID=$(echo "$JSON_SETTINGS" | jq -r '.auth_guard.organization_id // empty')

    # Backward-compatible alias used in some nginx paths
    export PROJECT_SERVER_ID="${USER_CONTAINER_ID}"
}

extract_settings

# Make the platform's names resolve, whatever engine started this container.
#
# The container reaches its gateway by FQDN — `start_vpn` below fetches the VPN
# config over HTTPS before it has a tunnel to fetch it through. In production
# those are real DNS names. In development they are `.local` names the host
# serves, and the container has to be told where the host is.
#
# Docker was told, with `--add-host <name>:host-gateway`. Apple `container` has
# no such flag, so the container works it out instead — from the one address it
# always has and never has to be given: the gateway of its own network, which
# is the host. Measured on both: a container on a private Docker network and a
# container in an Apple microVM each reach the host at their default route.
#
# Only for names that do not already resolve. A real DNS name in production, or
# an entry the engine put there, is left exactly as it is — overriding one
# would send a container to the wrong place for a reason nobody could see from
# the outside.
resolve_platform_hosts() {
    HOST_IP=$(ip route 2>/dev/null | awk '/^default/{print $3; exit}')
    [ -z "${HOST_IP}" ] && return 0

    for name in "${GATEWAY_FQDN}" "${GANYMEDE_FQDN}" "${FRONTEND_FQDN}"; do
        [ -z "${name}" ] && continue
        [ "${name}" = "null" ] && continue
        getent hosts "${name}" >/dev/null 2>&1 && continue
        grep -qE "[[:space:]]${name}\$" /etc/hosts 2>/dev/null && continue
        echo "${HOST_IP} ${name}" >>/etc/hosts
    done
}

resolve_platform_hosts

start_vpn() {
    CONFIG=$(curl -k -X GET -H "Authorization: ${TOKEN}" https://${GATEWAY_FQDN}/collab/vpn-config 2>/dev/null)
    if ! [ -z "${CONFIG}" ]; then
        certificates=$(printf "%s" "${CONFIG}" | jq -r '.certificates')
        # Loop through each certificate
        printf "%s" "$certificates" | jq -r 'to_entries[] | .key' | while read -r filename; do
            value=$(printf "%s" "$certificates" | jq -r ".[\"${filename}\"]")
            echo "$value" >"$filename"
        done
        printf "%s" "${CONFIG}" | jq -r '.config' | sed "s/GATEWAY_FQDN/${GATEWAY_FQDN}/g" >client.ovpn
        openvpn --config client.ovpn &
    else
        echo "Gateway Down ?"
        sleep 10
    fi
}

get_system_info() {
    CPU_USAGE=$(uptime | awk '{print $10, $11, $12}')
    CPU_COUNT=$(lscpu | grep 'Core(s) per socket' | awk '{print $4}')
    THREADS_PER_CORE=$(lscpu | grep 'Thread(s) per core' | awk '{print $4}')
    CPU_MODEL=$(lscpu | grep 'Model name' | cut -d ':' -f 2- | sed 's/^ *//;s/ *$//')
    FREE_MEMORY=$(free -m | awk 'NR==2{print $7}')
    TOTAL_MEMORY=$(free -m | awk 'NR==2{print $2}')
    DISK_SIZE=$(df -h / | awk 'NR==2{print $2}')
    DISK_USAGE=$(df -h / | awk 'NR==2{printf "%.2f\n", $5}')
    PING_TIME=$(ping -c 3 ${GATEWAY_VPN_IP} | tail -1 | awk '{print $4}')
    GRAPHIC_CARDS=$(lspci | grep VGA)
    echo "{ \"cpu\": { \"usage\": \"${CPU_USAGE}\", \"count\": \"${CPU_COUNT}\", \"threads_per_core\": \"${THREADS_PER_CORE}\", \"model\": \"${CPU_MODEL}\" }, \"memory\": { \"free\": ${FREE_MEMORY}, \"total\": ${TOTAL_MEMORY} }, \"disk\": { \"size\": \"${DISK_SIZE}\", \"usage\": \"${DISK_USAGE}%\" }, \"network\": { \"ping_time\": \"${PING_TIME} ms\" }, \"graphic\": { \"cards\": \"${GRAPHIC_CARDS}\" } }"
}

watchdog() {
    PAYLOAD='{"event":{"type":"user-container:watchdog","system": '$(get_system_info)'},"project_id":"'${PROJECT_ID}'"}'
    echo "--->$PAYLOAD<---"
    curl -X POST http://${GATEWAY_VPN_IP}/collab/event \
        -H "Authorization: ${TOKEN}" \
        -H "Content-Type: application/json" \
        -d "${PAYLOAD}" \
        2>/dev/null
}

# OBSOLETE: With distinct FQDNs per container (uc-{uuid}.org-{uuid}.domain.local),
# user containers don't need internal nginx. Gateway nginx routes directly to VPN IP:port.
# This function remains as a no-op stub for backward compatibility with old entrypoints.
# delete
reset_nginx() {
    echo "reset_nginx: skipped (distinct FQDN routing, no internal nginx needed)"
}

vpn_loop() {
    DIR=$(mktemp -d "/tmp/vpn-XXXXXXXX")
    cd "$DIR"
    while true; do
        if ! pgrep -o openvpn || ! ping -c 3 ${GATEWAY_VPN_IP} >/dev/null; then
            echo "No connectivity"
            pkill -9 openvpn
            rm -f "${GW_FILE}"
            start_vpn
            # No reset_nginx needed - gateway routes via distinct FQDN
            continue
        else
            echo "report"
            watchdog
        fi
        echo "."
        sleep 15
    done
}

start_auth_guard() {
    if [ -z "$AUTH_GUARD_CLIENT_ID" ]; then
        echo "Auth guard not configured (no client_id), skipping"
        return 0
    fi

    GUARD_BIN="/usr/local/bin/auth-guard"
    if [ ! -x "$GUARD_BIN" ]; then
        echo "Auth guard binary not found at $GUARD_BIN, skipping"
        return 0
    fi

    # Build domain from gateway FQDN (org-{uuid}.{domain} -> {domain})
    DOMAIN=$(echo "$GATEWAY_FQDN" | sed 's/^[^.]*\.//')

    GUARD_FLAGS="--listen-port 8443 --admin-port 9999"
    GUARD_FLAGS="$GUARD_FLAGS --ganymede-url https://${GANYMEDE_FQDN}"
    GUARD_FLAGS="$GUARD_FLAGS --gateway-url https://${GATEWAY_FQDN}"
    GUARD_FLAGS="$GUARD_FLAGS --client-id ${AUTH_GUARD_CLIENT_ID}"
    GUARD_FLAGS="$GUARD_FLAGS --client-secret ${AUTH_GUARD_CLIENT_SECRET}"
    GUARD_FLAGS="$GUARD_FLAGS --container-id ${AUTH_GUARD_CONTAINER_ID}"
    GUARD_FLAGS="$GUARD_FLAGS --organization-id ${AUTH_GUARD_ORG_ID}"
    GUARD_FLAGS="$GUARD_FLAGS --cookie-domain .${DOMAIN}"

    # In dev mode (self-signed certs), skip TLS verification
    if [ "${GATEWAY_DEV:-0}" = "1" ]; then
        GUARD_FLAGS="$GUARD_FLAGS --insecure-skip-verify"
    fi

    echo "Starting auth guard proxy..."
    $GUARD_BIN $GUARD_FLAGS &
    GUARD_PID=$!

    # Wait for guard to be healthy (up to 15 seconds)
    for i in $(seq 1 30); do
        if curl -s -o /dev/null http://localhost:9999/health 2>/dev/null; then
            echo "Auth guard ready (pid=$GUARD_PID)"
            export AUTH_GUARD_RUNNING=1
            return 0
        fi
        sleep 0.5
    done

    echo "WARNING: Auth guard failed to start within 15s"
    return 1
}

map_http_service() {
    NAME=$1
    PORT=$2

    # If auth guard is running, register service with guard admin API
    # and report guard port (8443) to gateway instead of service port
    if [ "${AUTH_GUARD_RUNNING:-0}" = "1" ]; then
        # Register with auth guard's admin API
        curl -s -X POST http://localhost:9999/services/register \
            -H "Content-Type: application/json" \
            -d "{\"name\":\"${NAME}\",\"port\":${PORT}}" \
            2>/dev/null
        REPORT_PORT=8443
    else
        REPORT_PORT=$PORT
    fi

    while true; do
        echo "map_http_service $NAME"
        curl --max-time 2 \
            -X POST http://${GATEWAY_VPN_IP}/collab/event \
            -H "Authorization: ${TOKEN}" \
            -H "Content-Type: application/json" \
            -d "{\"event\":{\"type\":\"user-container:map-http-service\",\"port\":${REPORT_PORT},\"name\":\"${NAME}\"},\"project_id\":\"${PROJECT_ID}\"}" \
            2>/dev/null
        sleep 15
    done
}
