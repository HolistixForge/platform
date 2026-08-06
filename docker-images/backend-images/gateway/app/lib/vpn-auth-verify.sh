#!/bin/bash
#
# Verify a connecting container is one this gateway started.
#
# OpenVPN calls this with a file containing the username on line 1 and the
# password on line 2 (`via-file`). The username is the container id; the
# password is the hosting token the gateway minted for that container and
# handed it through SETTINGS.
#
# Why a token rather than the certificate: every container in an organization
# shares one client certificate, so the certificate proves membership of the
# organization and nothing more. Without this check, anything holding that one
# certificate could claim to be any container and be given its address.
#
# The gateway writes the pairs when it starts a container. This script compares;
# it does not decide.

CREDENTIALS="${VPN_CREDENTIALS:-/tmp/vpn-credentials}"
VIA_FILE="$1"

# Either method, because both exist in the wild: `via-env` puts them in the
# environment, `via-file` writes a temporary file and passes the path. The
# server asks for via-env — via-file is deprecated in OpenVPN 2.6 and, on
# 2.6.19, simply fails to write the file — but a gateway still running an
# older configuration must not start refusing everyone.
if [ -n "${username:-}" ] && [ -n "${password:-}" ]; then
  :
elif [ -n "${VIA_FILE}" ] && [ -f "${VIA_FILE}" ]; then
  username=$(sed -n '1p' "${VIA_FILE}")
  password=$(sed -n '2p' "${VIA_FILE}")
else
  exit 1
fi

[ -z "${username}" ] && exit 1
[ -z "${password}" ] && exit 1

# No credentials file yet means no container has been started through this
# gateway. Accepting would let anything with the shared certificate in, so the
# answer is no.
[ -f "${CREDENTIALS}" ] || exit 1

expected=$(grep -E "^${username} " "${CREDENTIALS}" 2>/dev/null | head -1 | awk '{print $2}')
[ -z "${expected}" ] && exit 1

# Constant-time-ish: compare digests rather than the values, so the comparison
# does not stop at the first differing byte of a token.
[ "$(printf '%s' "${password}" | sha256sum)" = \
  "$(printf '%s' "${expected}" | sha256sum)" ] || exit 1

exit 0
