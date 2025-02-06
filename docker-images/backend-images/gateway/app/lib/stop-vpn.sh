#!/bin/bash

# Function for displaying error messages and exiting
function error_exit {
    echo "{\"status\": \"error\", \"error\": \"$1\"}"
}

# Function for displaying success message and returning JSON
function success_exit {
    echo "{\"status\": \"ok\", \"message\": \"$1\"}"
    exit 0
}

rm -f /tmp/vpn-config.json

# Enable nullglob option
shopt -s nullglob

# Loop through each temp directory in /tmp matching the ovpn-XXXXXXXXXX name pattern
for TEMP_DIR in /tmp/ovpn-*; do
    echo $TEMP_DIR
        # Kill the OpenVPN process
    OPENVPN_PID_FILE="${TEMP_DIR}/openvpn.pid"
    OPENVPN_PID=$(tail -n 1 "${OPENVPN_PID_FILE}") || error_exit "Failed to read OpenVPN PID from PID file"
    sudo kill "${OPENVPN_PID}" || error_exit "Failed to kill OpenVPN process"

    # Remove the temporary directory and its contents
    rm -rf "${TEMP_DIR}" || error_exit "Failed to remove temporary directory"
done

# let's be sure
sudo pkill openvpn

# Output success message
success_exit "OpenVPN servers stopped successfully"
