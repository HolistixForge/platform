#!/bin/bash

set -x

# Where this script lives — resolved here, before anything changes directory.
#
# `BASH_SOURCE[0]` is the path the script was invoked with, verbatim. Invoked
# the way this directory's README documents (`./start-vpn.sh`) that is `.`, and
# resolving it after the `cd "${TEMP_DIR}/easy-rsa"` below answers the
# temporary directory instead. The scripts named in the OpenVPN config would
# then be looked for somewhere they have never been.
#
# The production caller passes an absolute path, so this only bites the manual
# invocation — which is the one a person uses when something is already wrong.
_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Function for displaying error messages and exiting
function error_exit {
    echo "{\"status\": \"error\", \"error\": \"$1\"}"
    exit 1
}

# Function for displaying success message and returning JSON
function write_config {
    echo -n "{\"organization_id\": \"$1\", \"status\": \"ok\", \"pid\": $2, \"temp_dir\": \"$3\", \"port\": $4, \"hostname\": \"$5\", \"certificates\": { \"clients.crt\": \"${6//$'\n'/\\n}\", \"clients.key\": \"${7//$'\n'/\\n}\", \"ca.crt\": \"${8//$'\n'/\\n}\", \"ta.key\": \"${9//$'\n'/\\n}\" }}" >"/tmp/vpn-config.json"
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

# Per-client identity, off by default.
#
# The shared client certificate proves membership of the organization and
# nothing more: with duplicate-cn every container presents the same common
# name, so the server cannot tell them apart and cannot assign an address to a
# particular one. That is what stops an allocated network range from becoming an
# address a container actually holds.
#
# Turning this on makes the server *require* a username and password. Every
# container that does not send them stops connecting — so it stays off until the
# container bootstrap writes the credential file from SETTINGS. Enabling it
# before that lands would take every service in every organization offline.
PER_CLIENT_IDENTITY_CONFIG=""
if [ "${VPN_PER_CLIENT_IDENTITY:-0}" = "1" ]; then
  PER_CLIENT_IDENTITY_CONFIG=$(cat <<'IDENT'

# The username the client sends is the container id, and becomes its common
# name for the scripts below.
verify-client-cert require
username-as-common-name
# `via-env`, not `via-file`.
#
# `via-file` has openvpn write the credentials to a temporary file and pass the
# path. On 2.6.19 that fails outright — "could not write username/password to
# file" — with the process running as root and `mktemp` in the same directory
# succeeding by hand, and the method is deprecated upstream. Every client got
# AUTH_FAILED: the identity check refusing everyone rather than checking
# anything, which looks from the outside exactly like a wrong password.
#
# `via-env` needs `script-security 3` and puts the credentials in the script's
# environment instead. No credential reaches the filesystem at all, which is
# the better arrangement anyway; what it costs is that the environment of a
# root-owned script is readable by root, which it already was.
auth-user-pass-verify SCRIPT_DIR_PLACEHOLDER/vpn-auth-verify.sh via-env
client-connect SCRIPT_DIR_PLACEHOLDER/vpn-client-connect.sh
script-security 3
IDENT
)
  # Next to *this* script, not /app/lib.
  #
  # The image bakes a copy of these scripts at /app/lib and the build tarball
  # extracts another at /opt/gateway/app/lib. `pack` updates the second; the
  # image only changes when it is rebuilt. Naming /app/lib meant the running
  # gateway called a stale verifier — which, once the server started asking for
  # credentials `via-env`, refused every client while the fixed copy sat
  # unused a directory away.
  _lib_dir="${_LIB_DIR}"
  # Checked, because openvpn cannot say what is wrong with it.
  #
  # A missing `auth-user-pass-verify` script is reported as AUTH_FAILED for
  # every client — indistinguishable from a wrong password, which is the most
  # expensive way for this to be misconfigured. `BASH_SOURCE[0]` also names the
  # caller's file when this script is sourced rather than executed, and a
  # symlinked script resolves to its own directory and not the target's, so the
  # directory is right in the cases that happen today and not by construction.
  if [ ! -x "${_lib_dir}/vpn-auth-verify.sh" ]; then
    error_exit "VPN_PER_CLIENT_IDENTITY=1 but ${_lib_dir}/vpn-auth-verify.sh is not executable — every client would be refused with AUTH_FAILED"
  fi
  if [ ! -x "${_lib_dir}/vpn-client-connect.sh" ]; then
    error_exit "VPN_PER_CLIENT_IDENTITY=1 but ${_lib_dir}/vpn-client-connect.sh is not executable"
  fi
  PER_CLIENT_IDENTITY_CONFIG=${PER_CLIENT_IDENTITY_CONFIG//SCRIPT_DIR_PLACEHOLDER/${_lib_dir}}
fi

# The transport, which is UDP unless the engine underneath cannot carry it.
#
# UDP is the right default and stays the default everywhere it works: OpenVPN
# over TCP puts a reliable transport inside a reliable transport, and a single
# lost packet then stalls every tunnelled connection instead of one.
#
# Apple `container` cannot carry it. A published UDP port is proxied by the
# runtime, and that proxy dies once traffic flows through it — measured: the
# port is bound after `container start`, a client completes its handshake, and
# about a minute later nothing is listening on the host at all while the
# published TCP port beside it keeps serving. Nothing brings it back short of
# restarting the container, and there is no way around it from outside: the
# host cannot reach a container's own address (`ping 192.168.65.91` and a TCP
# connect both fail), so a relay on the host has nothing to relay to.
#
# The symptom, before this was understood, is a platform that looks healthy:
# every container running, every gateway answering HTTP, and every user service
# a 404 — because the container's tunnel is down, its watchdog never lands, and
# the gateway drops its nginx location thirty seconds later.
#
# The client is served the same value from `/collab/vpn-config`, out of the
# same environment variable, so the two cannot disagree.
# Lower-cased before the comparison, and `/collab/vpn-config` does the same, so
# `TCP` cannot mean one thing here and another there.
VPN_PROTO="$(printf '%s' "${GATEWAY_VPN_PROTO:-udp}" | tr '[:upper:]' '[:lower:]')"
case "${VPN_PROTO}" in
  udp) SERVER_PROTO="udp" ;;
  tcp) SERVER_PROTO="tcp-server" ;;
  *) error_exit "GATEWAY_VPN_PROTO must be udp or tcp, got '${VPN_PROTO}'" ;;
esac

# `explicit-exit-notify` is a UDP-only option: it sends a datagram on exit so a
# peer that has no connection state learns the session is over. TCP has that
# state, so the option means nothing there.
#
# OpenVPN 2.6 says so and carries on — "NOTICE: --explicit-exit-notify ignored
# for --proto tcp", measured on a gateway that then served every container
# normally — so this is not what breaks a TCP tunnel. Emitting it anyway costs
# a line of noise in a log people read while diagnosing, and leans on a
# tolerance that earlier OpenVPN did not have: 2.4 treats the same
# combination as a usage error and exits. Neither is worth relying on.
EXIT_NOTIFY_CONFIG=""
[ "${SERVER_PROTO}" = "udp" ] && EXIT_NOTIFY_CONFIG="explicit-exit-notify 1"

# Update OpenVPN configuration file with new paths and gateway VPN port
cat <<EOF >"${TEMP_DIR}/server.conf" || error_exit "Failed to write to config file"
dev tun
proto ${SERVER_PROTO}
# Use gateway VPN port
port ${GATEWAY_VPN_PORT}
server 172.16.0.0 255.255.0.0

ca ${CA_CERT}
cert ${SERVER_CERT}
key ${SERVER_KEY}
dh ${DH_FILE}

# Use TLS-authentication
tls-auth ${TA_KEY} 0

# Deliberately NOT client-to-client.
#
# That option makes OpenVPN shuttle packets between clients inside its own
# process, in userspace, without ever consulting the kernel. Traffic between two
# containers therefore never reaches the routing table or the FORWARD chain, so
# no route and no firewall rule on this gateway can see it — let alone stop it.
#
# With it on, every container in an organization could reach every other by
# address regardless of project, which was verified from a running container
# before this line changed. It also makes private network ranges meaningless:
# allocating 172.16.16.0/24 to a network cannot isolate anything if the packets
# bypass the layer where isolation is expressed.
#
# Without it, client-to-client traffic goes out to the kernel and back, where
# the rules below apply. Nothing else changes: a container reaches this gateway,
# and reaches another container's service through the reverse proxy here, which
# is how per-service FQDNs have always worked.

keepalive 10 120

cipher AES-256-GCM

ifconfig-pool-persist ${LOGS_DIR}/ipp.txt
status ${LOGS_DIR}/openvpn-status.log
log-append ${LOGS_DIR}/openvpn.log
verb 5

# All clients use the same cert/key pair
duplicate-cn
${PER_CLIENT_IDENTITY_CONFIG}

${EXIT_NOTIFY_CONFIG}

management 127.0.0.1 5555
EOF

# Start OpenVPN using the updated configuration file
sudo openvpn --config "${TEMP_DIR}/server.conf" --daemon || error_exit "Failed to start OpenVPN"

# Retrieve OpenVPN process PID and store it in a file
OPENVPN_PID_FILE="${TEMP_DIR}/openvpn.pid"
OPENVPN_PID=$(pgrep -o openvpn) || error_exit "Failed to retrieve OpenVPN process PID"
echo "${OPENVPN_PID}" >"${OPENVPN_PID_FILE}" || error_exit "Failed to write OpenVPN process PID to file"

# Refuse to forward one client to another by default.
#
# Removing client-to-client sends that traffic through the kernel; it does not
# stop it. Without this rule the kernel forwards tun0 back out tun0 and every
# container still reaches every other, only more slowly.
#
# Default deny rather than a deny-list: a private network is meant to fail
# closed, so a range that was never explicitly permitted is one nothing can
# reach. Per-network allow rules are inserted above this one when a deployment
# declares them.
#
# What this does not touch: a container reaching this gateway (tun0 -> local,
# not forwarded), and this gateway's reverse proxy reaching a container
# (local -> tun0, not forwarded). Those are how the platform has always worked
# and both keep working.
if ! command -v iptables >/dev/null 2>&1; then
  # Loud, and in the log rather than only on stderr. The first version of this
  # warned on stderr alone, iptables turned out not to be in the image, and the
  # VPN looked isolated while it was not — which is the worst way for a security
  # control to be absent.
  {
    echo "=============================================================="
    echo "VPN CLIENT ISOLATION IS NOT ACTIVE: iptables is not installed."
    echo "Every container on this organization's VPN can reach every"
    echo "other one, across projects. Rebuild the gateway image."
    echo "=============================================================="
  } | tee -a "${SCRIPT_OUTPUTS}" >&2
elif ! sudo iptables -C FORWARD -i tun0 -o tun0 -j DROP 2>/dev/null; then
  sudo iptables -A FORWARD -i tun0 -o tun0 -j DROP \
    || {
      echo "VPN CLIENT ISOLATION IS NOT ACTIVE: could not install the rule." \
        | tee -a "${SCRIPT_OUTPUTS}" >&2
    }
fi

# Get public hostname of the machine
HOSTNAME=$(hostname -f)

# Get organization_id from environment (passed by vpn-manager)
ORG_ID="${ORGANIZATION_ID:-unknown}"

# Output success message
write_config "${ORG_ID}" "${OPENVPN_PID}" "${TEMP_DIR}" "${GATEWAY_VPN_PORT}" "${HOSTNAME}" "$(cat "${CLIENTS_CERT}")" "$(cat "${CLIENTS_KEY}")" "$(cat "${CA_CERT}")" "$(cat "${TA_KEY}")"

sudo nginx -s reload
