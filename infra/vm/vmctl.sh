#!/usr/bin/env bash
# ============================================================================
# vmctl.sh — create and drive the Holistix development VM
# ============================================================================
# Replaces the "run everything inside a dev container" workflow with a real
# Ubuntu 24.04 VM. The VM is disposable; all installation is done by the
# Ansible playbook in infra/ansible, which also targets production servers.
#
#   ./vmctl.sh bootstrap     create the VM and provision it end to end
#   ./vmctl.sh up            create/start the VM only
#   ./vmctl.sh provision     (re)run Ansible against it; extra args go to
#                            ansible-playbook, e.g. --tags coredns --check
#   ./vmctl.sh shell [cmd]   root shell (or one command) inside the VM
#   ./vmctl.sh ip            host-reachable guest address
#   ./vmctl.sh dns <tld>     point the host resolver for .<tld> at the VM
#   ./vmctl.sh trust-ca      trust the VM's mkcert root CA on the host
#   ./vmctl.sh status        VM state and the status of every managed service
#   ./vmctl.sh diagnostic    run infra-diagnostic.sh inside the VM
#   ./vmctl.sh verify-ws <env>  prove the collab WebSocket relays events
#   ./vmctl.sh ssh-config    regenerate infra/ansible/.ssh-config
#   ./vmctl.sh stop | start | destroy
#
# Environment overrides:
#   HOLISTIX_VM_NAME     (default: holistix)
#   HOLISTIX_REPO_PATH   (default: the repo this script lives in)
#   HOLISTIX_VM_CPUS / HOLISTIX_VM_MEMORY / HOLISTIX_VM_DISK

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ANSIBLE_DIR="${REPO_ROOT}/infra/ansible"

VM_NAME="${HOLISTIX_VM_NAME:-holistix}"
REPO_PATH="${HOLISTIX_REPO_PATH:-${REPO_ROOT}}"
SSH_CONFIG="${ANSIBLE_DIR}/.ssh-config"

RENDERED_TEMPLATE=""
cleanup_temp() { [ -n "${RENDERED_TEMPLATE}" ] && rm -f "${RENDERED_TEMPLATE}"; return 0; }
trap cleanup_temp EXIT

# ---------------------------------------------------------------------------
# Output helpers
# ---------------------------------------------------------------------------
if [ -t 1 ]; then
  C_RESET=$'\033[0m'; C_BOLD=$'\033[1m'
  C_RED=$'\033[31m'; C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'; C_BLUE=$'\033[34m'
else
  C_RESET=""; C_BOLD=""; C_RED=""; C_GREEN=""; C_YELLOW=""; C_BLUE=""
fi

info()  { printf '%s==>%s %s\n' "${C_BLUE}${C_BOLD}" "${C_RESET}" "$*"; }
ok()    { printf '%s  ok%s %s\n' "${C_GREEN}" "${C_RESET}" "$*"; }
warn()  { printf '%swarn%s %s\n' "${C_YELLOW}" "${C_RESET}" "$*" >&2; }
die()   { printf '%s fail%s %s\n' "${C_RED}${C_BOLD}" "${C_RESET}" "$*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Preconditions
# ---------------------------------------------------------------------------
require_limactl() {
  command -v limactl >/dev/null 2>&1 || die \
    "limactl not found. Install it with:  brew install lima"
}

require_ansible() {
  command -v ansible-playbook >/dev/null 2>&1 || die \
    "ansible-playbook not found. Install it with:  brew install ansible"
}

vm_exists() {
  limactl list --format '{{.Name}}' 2>/dev/null | grep -qx "${VM_NAME}"
}

vm_running() {
  [ "$(limactl list --format '{{.Status}}' "${VM_NAME}" 2>/dev/null || true)" = "Running" ]
}

require_running() {
  vm_exists || die "VM '${VM_NAME}' does not exist. Run: $0 up"
  vm_running || die "VM '${VM_NAME}' is not running. Run: $0 start"
}

# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------

cmd_up() {
  require_limactl

  if vm_exists; then
    if vm_running; then
      ok "VM '${VM_NAME}' is already running"
    else
      info "Starting VM '${VM_NAME}'"
      limactl start "${VM_NAME}"
    fi
  else
    [ -d "${REPO_PATH}" ] || die "Repo path does not exist: ${REPO_PATH}"

    # Deliberately not a RETURN trap: bash keeps that trap armed for later
    # function returns, by which point the local is out of scope and `set -u`
    # aborts the script. RENDERED_TEMPLATE is global and cleaned on EXIT.
    RENDERED_TEMPLATE="$(mktemp -t lima-holistix.XXXXXX.yaml)"

    # The mount location must be an absolute host path; substitute it in.
    sed "s|__REPO_PATH__|${REPO_PATH}|g" \
      "${SCRIPT_DIR}/lima-holistix.yaml" > "${RENDERED_TEMPLATE}"

    local -a create_args=(--name "${VM_NAME}")
    [ -n "${HOLISTIX_VM_CPUS:-}" ]   && create_args+=(--cpus "${HOLISTIX_VM_CPUS}")
    [ -n "${HOLISTIX_VM_MEMORY:-}" ] && create_args+=(--memory "${HOLISTIX_VM_MEMORY}")
    [ -n "${HOLISTIX_VM_DISK:-}" ]   && create_args+=(--disk "${HOLISTIX_VM_DISK}")

    info "Creating VM '${VM_NAME}' (repo mounted from ${REPO_PATH})"
    limactl create "${create_args[@]}" "${RENDERED_TEMPLATE}"
    limactl start "${VM_NAME}"
  fi

  cmd_ssh_config
  ok "VM ready — address: $(vm_ip || echo 'unknown')"
}

cmd_ssh_config() {
  require_limactl
  vm_exists || die "VM '${VM_NAME}' does not exist"
  mkdir -p "${ANSIBLE_DIR}"

  # Lima 1.0+ writes a ready-made ssh config per instance; `limactl show-ssh`
  # is deprecated in 2.x. Prefer the file, fall back for older Lima.
  local generated="${HOME}/.lima/${VM_NAME}/ssh.config"
  if [ -f "${generated}" ]; then
    cp "${generated}" "${SSH_CONFIG}"
  else
    limactl show-ssh --format=config "${VM_NAME}" > "${SSH_CONFIG}"
  fi

  chmod 600 "${SSH_CONFIG}"
  ok "Wrote ${SSH_CONFIG#"${REPO_ROOT}"/}"
}

# The guest has two NICs: Lima's user-mode NIC (192.168.5.0/24, not reachable
# from the host) and the vzNAT NIC (reachable). Skip loopback, the slirp
# range, and Docker's bridges.
vm_ip() {
  require_running
  limactl shell "${VM_NAME}" -- bash -lc '
    ip -4 -o addr show scope global \
      | awk "{print \$4}" | cut -d/ -f1 \
      | grep -Ev "^(127\.|192\.168\.5\.|172\.1[6-9]\.|172\.2[0-9]\.|172\.3[01]\.)" \
      | head -1
  ' 2>/dev/null | tr -d '\r'
}

cmd_ip() {
  local ip
  ip="$(vm_ip)"
  [ -n "${ip}" ] || die "Could not determine a host-reachable guest address"
  echo "${ip}"
}

cmd_provision() {
  require_running
  require_ansible
  cmd_ssh_config

  info "Installing Ansible collections"
  (cd "${ANSIBLE_DIR}" && ansible-galaxy collection install -r requirements.yml >/dev/null)

  # The guest has several NICs and its default route is Lima's user-mode one,
  # which the host cannot reach. Tell the playbook which address to publish.
  local guest_ip
  guest_ip="$(vm_ip)"
  [ -n "${guest_ip}" ] || die "Could not determine a host-reachable guest address"

  info "Running the playbook against '${VM_NAME}' (public IP ${guest_ip})"
  (cd "${ANSIBLE_DIR}" && \
    ansible-playbook site.yml -e "holistix_public_ip=${guest_ip}" "$@")

  ok "Provisioning complete"
  cat <<EOF

${C_BOLD}Next steps${C_RESET}
  1. Trust the dev CA on this machine:   $0 trust-ca
  2. Point the host resolver at the VM:  $0 dns local
  3. Create an environment:
       $0 shell
       cd /root/workspace/monorepo
       ./scripts/local-dev/create-env.sh dev-001 domain.local
       ./scripts/local-dev/build-frontend.sh dev-001
       ./scripts/local-dev/envctl.sh start dev-001
  4. Browse to https://domain.local

EOF
}

cmd_shell() {
  require_running
  # --workdir /tmp: without it limactl tries to cd to the host's current
  # directory inside the guest, which prints two errors on every call.
  # The local-dev scripts assume root and /root paths anyway.
  if [ $# -gt 0 ]; then
    limactl shell --workdir /tmp "${VM_NAME}" -- sudo -i bash -lc "$*"
  else
    limactl shell --workdir /tmp "${VM_NAME}" -- sudo -i
  fi
}

cmd_dns() {
  local tld="${1:-local}"
  local ip; ip="$(vm_ip)"
  [ -n "${ip}" ] || die "Could not determine the guest address"

  [ "$(uname -s)" = "Darwin" ] || die \
    "'dns' only knows how to configure macOS. On Linux, point systemd-resolved
     or /etc/resolv.conf at ${ip}."

  if [ "${tld}" = "local" ]; then
    warn ".local is reserved for mDNS/Bonjour on macOS and resolves unreliably."
    warn "Consider creating environments on a .test domain instead:"
    warn "    ./scripts/local-dev/create-env.sh dev-001 dev.test"
  fi

  info "Writing /etc/resolver/${tld} -> ${ip} (sudo required)"
  sudo mkdir -p /etc/resolver
  printf 'nameserver %s\n' "${ip}" | sudo tee "/etc/resolver/${tld}" >/dev/null
  sudo dscacheutil -flushcache 2>/dev/null || true
  sudo killall -HUP mDNSResponder 2>/dev/null || true
  ok "Host resolver configured for .${tld}"
  echo "   verify:  dscacheutil -q host -a name ganymede.domain.${tld}"
}

cmd_trust_ca() {
  require_running
  local tmp; tmp="$(mktemp -t holistix-rootCA.XXXXXX.pem)"

  limactl shell "${VM_NAME}" -- sudo cat /root/.local-dev/rootCA.pem > "${tmp}" \
    || die "No root CA in the VM. Run '$0 provision' first (mkcert role)."

  case "$(uname -s)" in
    Darwin)
      info "Adding the mkcert root CA to the System keychain (sudo required)"
      sudo security add-trusted-cert -d -r trustRoot \
        -k /Library/Keychains/System.keychain "${tmp}"
      ok "CA trusted. Restart your browser."
      ;;
    Linux)
      info "Installing the mkcert root CA into the system trust store"
      sudo cp "${tmp}" /usr/local/share/ca-certificates/holistix-mkcert.crt
      sudo update-ca-certificates
      ok "CA trusted. Restart your browser."
      ;;
    *)
      warn "Unsupported host OS. The certificate is at ${tmp}"
      return 0
      ;;
  esac
  rm -f "${tmp}"
  echo "   Firefox keeps its own store — import it manually if you use Firefox."
}

cmd_status() {
  require_limactl
  limactl list "${VM_NAME}" 2>/dev/null || { warn "VM '${VM_NAME}' not created"; return 0; }
  vm_running || return 0
  echo
  info "Guest address: $(vm_ip || echo unknown)"
  echo
  cmd_shell '
    systemctl is-active --quiet docker      && echo "  docker      running" || echo "  docker      DOWN"
    systemctl is-active --quiet postgresql  && echo "  postgresql  running" || echo "  postgresql  DOWN"
    systemctl is-active --quiet nginx       && echo "  nginx       running" || echo "  nginx       DOWN"
    systemctl is-active --quiet coredns     && echo "  coredns     running" || echo "  coredns     DOWN"
    systemctl is-active --quiet holistix-buildserver && echo "  buildserver running" || echo "  buildserver DOWN"
  ' 2>/dev/null || warn "VM not provisioned yet"
}

cmd_diagnostic() {
  require_running
  cmd_shell '/root/workspace/monorepo/scripts/local-dev/infra-diagnostic.sh'
}

# Proves the collaboration WebSocket relays events between clients — the
# foundation the whiteboard sits on.
cmd_verify_ws() {
  require_running
  local env_name="${1:-}"
  [ -n "${env_name}" ] || die "usage: $0 verify-ws <env-name> [--clients N]"
  shift
  cmd_shell "cd /root/workspace/monorepo && \
    node scripts/local-dev/verify-collab-websocket.mjs ${env_name} $*"
}

cmd_start()   { require_limactl; limactl start "${VM_NAME}"; cmd_ssh_config; }
cmd_stop()    { require_limactl; limactl stop "${VM_NAME}"; }

cmd_destroy() {
  require_limactl
  vm_exists || { warn "VM '${VM_NAME}' does not exist"; return 0; }
  printf 'This deletes the VM %s and everything inside it (databases, envs, images).\n' "${VM_NAME}"
  printf 'The shared source tree at %s is NOT touched.\n' "${REPO_PATH}"
  read -r -p "Type the VM name to confirm: " confirm
  [ "${confirm}" = "${VM_NAME}" ] || die "Aborted"
  limactl stop -f "${VM_NAME}" 2>/dev/null || true
  limactl delete -f "${VM_NAME}"
  rm -f "${SSH_CONFIG}"
  ok "VM '${VM_NAME}' deleted"
}

cmd_bootstrap() {
  cmd_up
  cmd_provision "$@"
}

# Print the header comment block (everything from line 2 up to the first
# non-comment line) as the help text.
usage() {
  awk 'NR > 1 { if ($0 !~ /^#/) exit; sub(/^# ?/, ""); print }' "${BASH_SOURCE[0]}"
}

# ---------------------------------------------------------------------------
main() {
  local cmd="${1:-help}"
  shift || true
  case "${cmd}" in
    bootstrap)   cmd_bootstrap "$@" ;;
    up)          cmd_up ;;
    start)       cmd_start ;;
    stop)        cmd_stop ;;
    destroy)     cmd_destroy ;;
    provision)   cmd_provision "$@" ;;
    shell|ssh)   cmd_shell "$@" ;;
    ip)          cmd_ip ;;
    ssh-config)  cmd_ssh_config ;;
    dns)         cmd_dns "$@" ;;
    trust-ca)    cmd_trust_ca ;;
    status)      cmd_status ;;
    diagnostic)  cmd_diagnostic ;;
    verify-ws)   cmd_verify_ws "$@" ;;
    help|-h|--help) usage ;;
    *)           usage; die "Unknown command: ${cmd}" ;;
  esac
}

main "$@"
