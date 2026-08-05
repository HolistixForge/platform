#!/bin/bash
#
# Assign a connecting container the address its network was allocated.
#
# OpenVPN runs this per connection and reads the file named in $1 as extra
# client configuration. Writing `ifconfig-push` there is what turns an allocated
# range into an address a container actually holds — without it, addresses come
# from the pool in arrival order and nothing can be placed on a given network.
#
# Identity comes from the username the client presented, which is the container
# id. The shared client certificate cannot provide it: every container in an
# organization uses the same one (`duplicate-cn`), so the common name is
# `clients` for all of them.
#
# The allocation file is written by the gateway when it starts a container. It
# is the authority here; this script decides nothing, it looks things up.
#
#   <user_container_id> <address> <netmask>
#
# A container with no entry gets no ifconfig-push and falls back to the pool,
# which is the pre-existing behaviour. Failing that way is deliberate: a service
# that cannot be placed on its network should still come up and be reachable by
# FQDN, rather than fail to connect for a reason no one can see from the UI.

ALLOCATIONS="${VPN_ALLOCATIONS:-/tmp/vpn-allocations}"
CLIENT_CONFIG="$1"

[ -z "${common_name}" ] && exit 0
[ -f "${ALLOCATIONS}" ] || exit 0

# `username_as_common_name` makes OpenVPN set common_name to what the client
# sent, so this is the container id rather than the shared certificate's name.
entry=$(grep -E "^${common_name} " "${ALLOCATIONS}" 2>/dev/null | head -1)
[ -z "${entry}" ] && exit 0

address=$(echo "${entry}" | awk '{print $2}')
netmask=$(echo "${entry}" | awk '{print $3}')

[ -z "${address}" ] && exit 0

echo "ifconfig-push ${address} ${netmask:-255.255.0.0}" >"${CLIENT_CONFIG}"
exit 0
