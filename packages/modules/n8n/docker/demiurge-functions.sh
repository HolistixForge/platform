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

    # Backward-compatible alias used in some nginx paths
    export PROJECT_SERVER_ID="${USER_CONTAINER_ID}"

    # echo
    # echo -e "GANYMEDE_FQDN: $GANYMEDE_FQDN\n"
    # echo -e "ACCOUNT_FQDN: $ACCOUNT_FQDN\n"
    # echo -e "FRONTEND_FQDN: $FRONTEND_FQDN\n"
    # echo -e "PROJECT_ID: $PROJECT_ID\n"
    # echo -e "PROJECT_SERVER_ID: $PROJECT_SERVER_ID\n"
}

extract_settings

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
    PAYLOAD='{"event":{"type":"user-container:watchdog","system": '$(get_system_info)'}}'
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

map_http_service() {
    NAME=$1
    PORT=$2
    while true; do
        echo "map_http_service $NAME"
        curl --max-time 2 \
            -X POST http://${GATEWAY_VPN_IP}/collab/event \
            -H "Authorization: ${TOKEN}" \
            -H "Content-Type: application/json" \
            -d "{\"event\":{\"type\":\"user-container:map-http-service\",\"port\":${PORT},\"name\":\"${NAME}\"}}" \
            2>/dev/null
        sleep 15
    done
}
