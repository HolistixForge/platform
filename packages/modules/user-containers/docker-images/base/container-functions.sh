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
    # What this container presents on the VPN. Short on purpose — openvpn keeps
    # a password in a fixed buffer and truncated the hosting token to 127
    # characters on the Alpine build, which the server could only report as a
    # wrong password. Falls back to the token so a container started by a
    # gateway that predates this still connects.
    export VPN_SECRET=$(echo "$JSON_SETTINGS" | jq -r '.vpn_secret // empty')
    # Whether the platform's TLS is signed by something this container has no
    # root for. `start_auth_guard` passes --insecure-skip-verify on it, and
    # without it the guard cannot fetch Ganymede's public key and never starts.
    export GATEWAY_DEV=$(echo "$JSON_SETTINGS" | jq -r 'if .gateway_dev then "1" else "0" end')

    # Auth Guard Proxy settings (per-container OAuth client)
    export AUTH_GUARD_CLIENT_ID=$(echo "$JSON_SETTINGS" | jq -r '.auth_guard.client_id // empty')
    export AUTH_GUARD_CLIENT_SECRET=$(echo "$JSON_SETTINGS" | jq -r '.auth_guard.client_secret // empty')
    export AUTH_GUARD_CONTAINER_ID=$(echo "$JSON_SETTINGS" | jq -r '.auth_guard.container_id // empty')
    export AUTH_GUARD_ORG_ID=$(echo "$JSON_SETTINGS" | jq -r '.auth_guard.organization_id // empty')
    # The leftmost label this container's services are published under, minus
    # the service name: `uc-<id>` or `uc-<id>--<space>`. Sent whole so an image
    # that builds its own service URLs concatenates rather than reimplements —
    # a name assembled from the wrong rule routes nowhere, and only fails when
    # somebody follows an OAuth callback. Empty from a gateway older than this;
    # the fallback below is what that gateway would have produced.
    export AUTH_GUARD_SERVICE_PREFIX=$(echo "$JSON_SETTINGS" | jq -r '.auth_guard.service_label_prefix // empty')
    [ -n "$AUTH_GUARD_SERVICE_PREFIX" ] || \
        export AUTH_GUARD_SERVICE_PREFIX="uc-${AUTH_GUARD_CONTAINER_ID}"

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
# Only for names that do not already resolve *to somewhere this container can
# go*. A real DNS name in production, or an entry the engine put there, is left
# exactly as it is — overriding one would send a container to the wrong place
# for a reason nobody could see from the outside. But a loopback answer is not
# such a name: measured on macOS, the host's own CoreDNS answers 127.0.0.1 for
# every platform name, which is right for the host and is this container
# itself once inside a microVM.
# The default route, without needing `ip`.
#
# `ip route` was the only source, and iproute2 is not in every image — the
# ubuntu-terminal image in this repository's own catalogue does not have it.
# The function then found nothing, returned early, and wrote no hosts entries
# at all: measured, a container whose /etc/hosts had no platform name in it and
# which reported "Gateway Down ?" every ten seconds forever. Silent, because
# "no default route" and "no `ip` command" looked the same.
#
# /proc/net/route is the kernel's own table and needs no package. The gateway
# column is little-endian hex, which is why the bytes come out backwards.
default_gateway() {
    _gw=$(ip route 2>/dev/null | awk '/^default/{print $3; exit}')
    if [ -n "${_gw}" ]; then
        echo "${_gw}"
        return 0
    fi

    # Shell rather than awk: mawk is what these images ship and it has no
    # `strtonum`, so the hex has to be converted with printf instead.
    while read -r _iface _dest _gwhex _flags _refcnt _use _metric _mask _rest; do
        [ "${_dest}" = "00000000" ] || continue
        [ "${_mask}" = "00000000" ] || continue
        [ ${#_gwhex} -eq 8 ] || continue
        # A link-scope default route has no gateway, and its zero column would
        # come out as the address `0.0.0.0`. That is non-empty, so the caller's
        # emptiness check lets it through, and every platform name in
        # /etc/hosts then points nowhere while looking, at a glance, correct.
        [ "${_gwhex}" = "00000000" ] && continue
        printf '%d.%d.%d.%d\n' \
            "0x$(printf '%s' "${_gwhex}" | cut -c7-8)" \
            "0x$(printf '%s' "${_gwhex}" | cut -c5-6)" \
            "0x$(printf '%s' "${_gwhex}" | cut -c3-4)" \
            "0x$(printf '%s' "${_gwhex}" | cut -c1-2)"
        return 0
    done < /proc/net/route 2>/dev/null
    return 1
}

resolve_platform_hosts() {
    HOST_IP=$(default_gateway | head -1)
    [ -z "${HOST_IP}" ] && { echo "No default route found — platform names will not resolve"; return 0; }

    for entry in "${GATEWAY_FQDN}" "${GANYMEDE_FQDN}" "${FRONTEND_FQDN}"; do
        # Without the port. These FQDNs carry one wherever nginx is not on 443,
        # because every URL built from them is a link somebody follows — and a
        # hosts entry is not a URL. Written with the port, the line is
        # `192.168.68.1 org-….apollo.test:8443`, which resolves nothing: the
        # container then reports "Gateway Down ?" every ten seconds with an
        # /etc/hosts that looks, at a glance, exactly right.
        name="${entry%%:*}"
        [ -z "${name}" ] && continue
        [ "${name}" = "null" ] && continue
        grep -qE "[[:space:]]${name}\$" /etc/hosts 2>/dev/null && continue

        RESOLVED=$(getent hosts "${name}" 2>/dev/null | awk '{print $1; exit}')
        # Every spelling of loopback, and only loopback. `getent` can answer
        # `0:0:0:0:0:0:0:1` or an IPv4-mapped form depending on the resolver,
        # and those fell through to "a real address" — the exact failure this
        # override exists to fix, differently formatted.
        #
        # `0.0.0.0` is deliberately *not* in this list. It is not loopback: it
        # is what a resolver returns for a name it blackholes, which is an
        # answer somebody configured on purpose. Overriding it would send the
        # container to its default route past a deliberate block. The zero
        # address does have to be rejected where it is genuinely meaningless —
        # as a *default route* — and `default_gateway` does that on its own.
        case "${RESOLVED}" in
            '') ;;                       # nothing answered — ours to write
            127.*|::1|0:0:0:0:0:0:0:1|::ffff:127.*) ;;
                                         # answered with itself — not usable here
            *) continue ;;               # a real address, and not ours to move
        esac

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
        # The hostname, not the FQDN, because the template is
        # `remote GATEWAY_FQDN <vpn-port>` (collab.ts) — host and port are
        # already two fields. Substituting a name that carries its own port
        # produces `remote org-….apollo.test:8443 49200`, and openvpn spends
        # forever on "Cannot resolve host address" for a name that is in
        # /etc/hosts, correctly, without the port.
        printf "%s" "${CONFIG}" | jq -r '.config' \
            | sed "s/GATEWAY_FQDN/${GATEWAY_FQDN%%:*}/g" >client.ovpn

        # Who this container is, on the tunnel.
        #
        # Every container in an organization shares one client certificate, so
        # the certificate proves membership and nothing else: with
        # `duplicate-cn` the server sees the common name `clients` for all of
        # them, cannot tell two apart, and cannot give a particular one the
        # address its network was allocated. The username is the container id
        # and the password is the short secret the gateway minted for it and
        # handed over in SETTINGS — the pair `vpn-auth-verify.sh` compares
        # against the credentials file the gateway writes.
        #
        # Sent whether or not the server asks. A server without
        # `auth-user-pass-verify` ignores them, which is what makes the rollout
        # safe in this order: every container learns to send them first, and
        # only then can VPN_PER_CLIENT_IDENTITY be turned on — the other order
        # takes every service in every organization offline at once.
        # `jq -r` prints the four characters `null` for a field that is not
        # there, and those four characters are not empty. Without this the
        # credentials file is written with `null` as the password and the
        # container authenticates as a bogus identity instead of taking the
        # branch below — which is a refusal at connect time that reads exactly
        # like a wrong password. The FQDN loop above already tests for it; this
        # is the same test, where it was missing.
        VPN_PASSWORD="${VPN_SECRET:-${TOKEN}}"
        [ "${VPN_PASSWORD}" = "null" ] && VPN_PASSWORD=""
        VPN_IDENTITY="${USER_CONTAINER_ID}"
        [ "${VPN_IDENTITY}" = "null" ] && VPN_IDENTITY=""
        if [ -n "${VPN_IDENTITY}" ] && [ -n "${VPN_PASSWORD}" ]; then
            printf '%s\n%s\n' "${VPN_IDENTITY}" "${VPN_PASSWORD}" >vpn-credentials
            chmod 600 vpn-credentials
            # `auth-nocache` because openvpn otherwise keeps them in memory to
            # replay on reconnect, and this loop re-reads the file anyway —
            # after a gateway restart the token it holds may be a new one.
            printf 'auth-user-pass %s/vpn-credentials\nauth-nocache\n' "$(pwd)" >>client.ovpn
        else
            echo "No container id or token in SETTINGS — connecting without an identity"
        fi

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
    # Bounded, because this call is inside the loop that repairs the tunnel.
    #
    # The address is on the tunnel. When the tunnel goes down between the ping
    # that decided it was up and this report, the connection neither completes
    # nor is refused — it hangs, and without a timeout `vpn_loop` hangs with
    # it: the one thing that would notice the tunnel is down and rebuild it is
    # blocked on the tunnel being up. Measured, a container sat in that state
    # for minutes with a dead openvpn and no further output at all, while the
    # gateway dropped its nginx location and its service answered 404.
    #
    # `map_http_service` below has carried the same guard from the start.
    curl --max-time 5 -X POST http://${GATEWAY_VPN_IP}/collab/event \
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
    #
    # Without the port. This becomes `--cookie-domain .${DOMAIN}`, and a cookie
    # domain is a domain: a browser rejects `.apollo.test:8443` outright, so
    # every container behind the auth guard would sign a user in and then hand
    # them a cookie their browser drops. GATEWAY_FQDN carries a port wherever
    # nginx is not on 443, because every URL built from it — the two lines
    # below among them — is a link somebody follows.
    DOMAIN=$(echo "$GATEWAY_FQDN" | sed 's/^[^.]*\.//' | cut -d: -f1)

    GUARD_FLAGS="--listen-port 8443 --admin-port 9999"
    GUARD_FLAGS="$GUARD_FLAGS --ganymede-url https://${GANYMEDE_FQDN}"
    GUARD_FLAGS="$GUARD_FLAGS --gateway-url https://${GATEWAY_FQDN}"
    GUARD_FLAGS="$GUARD_FLAGS --client-id ${AUTH_GUARD_CLIENT_ID}"
    GUARD_FLAGS="$GUARD_FLAGS --client-secret ${AUTH_GUARD_CLIENT_SECRET}"
    GUARD_FLAGS="$GUARD_FLAGS --container-id ${AUTH_GUARD_CONTAINER_ID}"
    GUARD_FLAGS="$GUARD_FLAGS --organization-id ${AUTH_GUARD_ORG_ID}"
    GUARD_FLAGS="$GUARD_FLAGS --cookie-domain .${DOMAIN}"

    # What opens the service behind the guard, when it needs anything.
    #
    # JupyterLab authenticates its own API with a token, and handing that token
    # to the browser would give the notebook's whole API to whoever holds the
    # page — undoing, one layer up, the per-user authorization the guard just
    # performed against the gateway. So the browser presents its session, the
    # guard authorizes it, and the guard adds this on the way through. The image
    # sets AUTH_GUARD_UPSTREAM_TOKEN before calling us; ttyd and n8n set nothing
    # and the flag is simply absent.
    if [ -n "${AUTH_GUARD_UPSTREAM_TOKEN:-}" ]; then
        GUARD_FLAGS="$GUARD_FLAGS --upstream-token ${AUTH_GUARD_UPSTREAM_TOKEN}"
    fi

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
