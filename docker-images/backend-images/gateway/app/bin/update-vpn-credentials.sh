#!/bin/bash
#
# Record which hosting token belongs to which container, for the VPN.
#
# `vpn-auth-verify.sh` reads this file when a container connects. Until now
# nothing wrote it, so that script — and the per-client identity it exists for —
# could never have worked: a missing file means every connection is refused,
# which is the correct answer to "no container has been started here" and a
# useless one on a gateway that has started several.
#
# Input format (stdin): user_container_id token
#   uc_abc123 eyJhbGciOi...
#   uc_def456 eyJhbGciOi...
#
# The whole set on every call, not a diff. The gateway holds the truth about
# which containers it started; writing the union each time means a container it
# no longer knows about loses its entry rather than lingering as a credential
# nobody can account for.
#
# Writing this changes nothing on its own. The server only asks for a username
# and password when VPN_PER_CLIENT_IDENTITY is on, which it is not — see
# start-vpn.sh, and the warning on TAC-155 about what flipping it costs.

function success_exit {
  echo -n "{\"status\": \"ok\"}"
  exit 0
}

CREDENTIALS="${VPN_CREDENTIALS:-/tmp/vpn-credentials}"
TMP="${CREDENTIALS}.$$"

# 0600 before anything is written into it, not after. These are the tokens that
# let a container claim its own address; a window where they are world-readable
# is a window, however short.
umask 077
: > "${TMP}"

while read -r id token rest; do
  # A blank line, or a token that arrived split, is skipped rather than written
  # as a malformed entry — vpn-auth-verify.sh matches on "^id " and a broken
  # line would either match nothing or, worse, match a prefix.
  [ -z "${id}" ] && continue
  [ -z "${token}" ] && continue
  [ -n "${rest}" ] && continue
  printf '%s %s\n' "${id}" "${token}" >> "${TMP}"
done

# Renamed into place rather than written in place: a container connecting while
# the file is half-written would be refused for no reason anyone could see.
mv -f "${TMP}" "${CREDENTIALS}"
chmod 600 "${CREDENTIALS}"

success_exit
