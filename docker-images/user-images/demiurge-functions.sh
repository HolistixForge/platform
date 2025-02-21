#/bin/sh

export GW_FILE="/tmp/gateway"

GATEWAY_VPN_IP="172.16.0.1"

extract_settings() {
    JSON_SETTINGS="$(echo $SETTINGS | base64 -d)"

    export HOST_USER_ID=$(echo "$JSON_SETTINGS" | jq -r '.user_id')
    export GANYMEDE_FQDN=$(echo "$JSON_SETTINGS" | jq -r '.ganymede_fqdn')
    export ACCOUNT_FQDN=$(echo "$JSON_SETTINGS" | jq -r '.account_fqdn')
    export FRONTEND_FQDN=$(echo "$JSON_SETTINGS" | jq -r '.frontend_fqdn')
    export TOKEN=$(echo "$JSON_SETTINGS" | jq -r '.token')
    export PROJECT_ID=$(echo "$JSON_SETTINGS" | jq -r '.project_id')
    export PROJECT_SERVER_ID=$(echo "$JSON_SETTINGS" | jq -r '.project_server_id')

    # echo
    # echo -e "GANYMEDE_FQDN: $GANYMEDE_FQDN\n"
    # echo -e "ACCOUNT_FQDN: $ACCOUNT_FQDN\n"
    # echo -e "FRONTEND_FQDN: $FRONTEND_FQDN\n"
    # echo -e "PROJECT_ID: $PROJECT_ID\n"
    # echo -e "PROJECT_SERVER_ID: $PROJECT_SERVER_ID\n"
}

extract_settings

get_gateway() {
    RESPONSE=$(curl -k -X GET -H "Authorization: ${TOKEN}" https://${GANYMEDE_FQDN}/projects/${PROJECT_ID} 2>/dev/null)
    # echo "${RESPONSE}" | json_pp
    export GATEWAY_FQDN=$(echo "${RESPONSE}" | jq -r '._0.gateway_hostname')
    echo "${GATEWAY_FQDN}" >"${GW_FILE}"
    echo "GATEWAY_FQDN: ${GATEWAY_FQDN}"
}

start_vpn() {
    CONFIG=$(curl -k -X GET -H "Authorization: ${TOKEN}" https://${GATEWAY_FQDN}/collab/vpn 2>/dev/null)
    if ! [ -z "${CONFIG}" ]; then
        certificates=$(printf "%s" "${CONFIG}" | jq -r '.certificates')
        # Loop through each certificate
        printf "%s" "$certificates" | jq -r 'to_entries[] | .key' | while read -r filename; do
            value=$(printf "%s" "$certificates" | jq -r ".[\"${filename}\"]")
            echo "$value" >"$filename"
        done
        printf "%s" "${CONFIG}" | jq -r '.config' | sed "s/GATEWAY_HOSTNAME/${GATEWAY_FQDN}/g" >client.ovpn
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
    PAYLOAD='{"event":{"type":"server:watchdog", "host_user_id": "'${HOST_USER_ID}'", "system": '$(get_system_info)'}}'
    echo "--->$PAYLOAD<---"
    curl -X POST http://${GATEWAY_VPN_IP}/collab/event \
        -H "Authorization: ${TOKEN}" \
        -H "Content-Type: application/json" \
        -d "${PAYLOAD}" \
        2>/dev/null
}

reset_nginx() {
    if [ -f /usr/local/bin/services.conf ]; then
        CONF="/etc/nginx/http.d/default.conf"

        # Create the nginx configuration file with server blocks for each service
        cat >$CONF <<'EOF'
EOF

        # Read services config file line by line

        while read -r SERVICE_NAME PORT_FROM PORT_TO || [ "$SERVICE_NAME" ]; do
            LOCATION="/${PROJECT_SERVER_ID}/${SERVICE_NAME}"

            cat >>$CONF <<EOF
server {
    listen ${PORT_FROM};
    server_name ${GATEWAY_FQDN};

    location = ${LOCATION} {                                                                                                                                                                              
        return 301 \$scheme://\$host\$uri/;                                                                                                                               
    }

    location ${LOCATION}/ {
        proxy_pass http://127.0.0.1:${PORT_TO};
        proxy_set_header X-Script-Name ${LOCATION};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
EOF
        done </usr/local/bin/services.conf

        # Start nginx with the specific config file, or reload if already running
        if ! pgrep -f "nginx: master process" >/dev/null; then
            if [ -s "$CONF" ]; then
                nginx
            else
                echo "Configuration file is empty. Nginx not started."
            fi
        else
            nginx -s reload
        fi
    fi
}

vpn_loop() {
    DIR=$(mktemp -d "/tmp/vpn-XXXXXXXX")
    cd "$DIR"
    while true; do
        if ! pgrep -o openvpn || ! ping -c 3 ${GATEWAY_VPN_IP} >/dev/null; then
            echo "No connetivity"
            pkill -9 openvpn
            rm -f "${GW_FILE}"
            get_gateway
            start_vpn
            reset_nginx
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
            -d "{\"event\":{\"type\":\"server:map-http-service\",\"port\":${PORT},\"name\":\"${NAME}\"}}" \
            2>/dev/null
        sleep 15
    done
}
