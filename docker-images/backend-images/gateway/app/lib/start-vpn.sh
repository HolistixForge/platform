#!/bin/bash

set -x

# Function for displaying error messages and exiting
function error_exit {
    echo "{\"status\": \"error\", \"error\": \"$1\"}"
    exit 1
}

# Function for displaying success message and returning JSON
function write_config {
    echo -n "{\"status\": \"ok\", \"pid\": $1, \"temp_dir\": \"$2\", \"port\": $3, \"hostname\": \"$4\", \"certificates\": { \"clients.crt\": \"${5//$'\n'/\\n}\", \"clients.key\": \"${6//$'\n'/\\n}\", \"ca.crt\": \"${7//$'\n'/\\n}\", \"ta.key\": \"${8//$'\n'/\\n}\" }}" >"/tmp/vpn-config.json"
    exit 0
}

# Create a temporary directory for certificate generation and logs
TEMP_DIR=$(mktemp -d -p /tmp ovpn-XXXXXXXXXX) || error_exit "Failed to create temporary directory"
# Change permissions of TEMP_DIR to restrict access
chmod 700 "${TEMP_DIR}" || error_exit "Failed to change permissions for temporary directory"

LOGS_DIR="${TEMP_DIR}/logs"
mkdir -p "${LOGS_DIR}" || error_exit "Failed to create logs directory"

SCRIPT_OUTPUTS="${LOGS_DIR}/script.log"

# Set temporary file paths
CA_CERT="${TEMP_DIR}/easy-rsa/pki/ca.crt"
SERVER_CERT="${TEMP_DIR}/easy-rsa/pki/issued/server.crt"
SERVER_KEY="${TEMP_DIR}/easy-rsa/pki/private/server.key"
DH_FILE="${TEMP_DIR}/easy-rsa/pki/dh.pem"
TA_KEY="${TEMP_DIR}/ta.key"

CLIENTS_CERT="${TEMP_DIR}/easy-rsa/pki/issued/clients.crt"
CLIENTS_KEY="${TEMP_DIR}/easy-rsa/pki/private/clients.key"

# sudo ufw allow ${OPENVPN_PORT}/udp

# Generate CA and server certificates in the temporary directory
cp -r /usr/share/easy-rsa "${TEMP_DIR}/easy-rsa" || error_exit "Failed to copy easy-rsa directory"
cd "${TEMP_DIR}/easy-rsa" || error_exit "Failed to change directory to easy-rsa"
./easyrsa init-pki || error_exit "Failed to initialize PKI"
EASYRSA_BATCH=1 ./easyrsa build-ca nopass || error_exit "Failed to build CA"
./easyrsa gen-dh || error_exit "Failed to generate DH parameters"
EASYRSA_BATCH=1 ./easyrsa gen-req server nopass || error_exit "Failed to generate server request"
EASYRSA_BATCH=1 ./easyrsa sign-req server server || error_exit "Failed to sign server request"
openvpn --genkey secret "${TA_KEY}" || error_exit "Failed to generate TLS key"

# Generate client certificate
EASYRSA_BATCH=1 ./easyrsa gen-req clients nopass || error_exit "Failed to generate clients request"
EASYRSA_BATCH=1 ./easyrsa sign-req client clients || error_exit "Failed to sign clients request"

# Update OpenVPN configuration file with new paths and gateway VPN port
cat <<EOF >"${TEMP_DIR}/server.conf" || error_exit "Failed to write to config file"
dev tun
proto udp
# Use gateway VPN port
port ${GATEWAY_VPN_PORT}
server 172.16.0.0 255.255.0.0

ca ${CA_CERT}
cert ${SERVER_CERT}
key ${SERVER_KEY}
dh ${DH_FILE}

# Use TLS-authentication
tls-auth ${TA_KEY} 0

# Allow client-to-client communication
client-to-client

keepalive 10 120

cipher AES-256-GCM

ifconfig-pool-persist ${LOGS_DIR}/ipp.txt
status ${LOGS_DIR}/openvpn-status.log
log-append ${LOGS_DIR}/openvpn.log
verb 5

# All clients use the same cert/key pair
duplicate-cn

explicit-exit-notify 1

management 127.0.0.1 5555
EOF

# Start OpenVPN using the updated configuration file
sudo openvpn --config "${TEMP_DIR}/server.conf" --daemon || error_exit "Failed to start OpenVPN"

# Retrieve OpenVPN process PID and store it in a file
OPENVPN_PID_FILE="${TEMP_DIR}/openvpn.pid"
OPENVPN_PID=$(pgrep -o openvpn) || error_exit "Failed to retrieve OpenVPN process PID"
echo "${OPENVPN_PID}" >"${OPENVPN_PID_FILE}" || error_exit "Failed to write OpenVPN process PID to file"

# Get public hostname of the machine
HOSTNAME=$(hostname -f)

# Output success message
write_config "${OPENVPN_PID}" "${TEMP_DIR}" "${GATEWAY_VPN_PORT}" "${HOSTNAME}" "$(cat "${CLIENTS_CERT}")" "$(cat "${CLIENTS_KEY}")" "$(cat "${CA_CERT}")" "$(cat "${TA_KEY}")"

sudo nginx -s reload
