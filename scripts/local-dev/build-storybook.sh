#!/bin/bash
# ============================================================================
# Build the package Storybooks and expose each one on its own subdomain
# ============================================================================
# Every package that has a .storybook/ directory gets its own static build and
# its own vhost, rather than one Storybook served under path prefixes: the
# environment already has a wildcard certificate (*.{domain}) and wildcard DNS,
# so a subdomain each costs nothing and avoids the base-path rewriting that
# Storybook needs to be served from a subdirectory.
#
#   ./build-storybook.sh <env-name>                 # every package
#   ./build-storybook.sh <env-name> ui-base whiteboard
#   ./build-storybook.sh <env-name> --no-build      # only refresh the vhosts
#   ./build-storybook.sh <env-name> --force         # rebuild even if present
#
# Result:
#   https://storybook.{domain}       index of everything available
#   https://sb-ui-base.{domain}      one per package
#   https://sb-whiteboard.{domain}
#   ...
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

ENV_NAME=""
DO_BUILD=true
FORCE=false
SELECTED=()

for arg in "$@"; do
  case "$arg" in
    --no-build) DO_BUILD=false ;;
    --force) FORCE=true ;;
    -h | --help)
      sed -n '2,25p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    -*)
      echo "❌ Unknown option: $arg" >&2
      exit 1
      ;;
    *)
      if [ -z "$ENV_NAME" ]; then ENV_NAME="$arg"; else SELECTED+=("$arg"); fi
      ;;
  esac
done

if [ -z "$ENV_NAME" ]; then
  echo "❌ Usage: $0 <env-name> [package ...] [--no-build] [--force]" >&2
  exit 1
fi

ENV_DIR="/root/.local-dev/${ENV_NAME}"
if [ ! -f "${ENV_DIR}/.env.ganymede" ]; then
  echo "❌ Environment '${ENV_NAME}' not found at ${ENV_DIR}" >&2
  exit 1
fi

DOMAIN=$(grep "^DOMAIN=" "${ENV_DIR}/.env.ganymede" | cut -d= -f2 | tr -d '"')
WORKSPACE=$(grep "^WORKSPACE=" "${ENV_DIR}/.env.ganymede" | cut -d= -f2 | tr -d '"')
WORKSPACE="${WORKSPACE:-$(cd "${SCRIPT_DIR}/../.." && pwd)}"

if [ -z "$DOMAIN" ]; then
  echo "❌ DOMAIN missing from ${ENV_DIR}/.env.ganymede" >&2
  exit 1
fi

echo "📚 Storybook for environment ${ENV_NAME} (${DOMAIN})"
echo "   Workspace: ${WORKSPACE}"
echo ""

cd "$WORKSPACE"

# ---------------------------------------------------------------------------
# Discover the packages that ship a Storybook
# ---------------------------------------------------------------------------
declare -a SHORT_NAMES=() NX_NAMES=() PKG_DIRS=() BUILD_WANTED=()

while IFS= read -r sb_dir; do
  pkg_dir="${sb_dir%/.storybook}"
  short="$(basename "$pkg_dir")"
  nx_name="$(node -e "process.stdout.write(require('./${pkg_dir}/package.json').name)" 2>/dev/null || true)"
  [ -n "$nx_name" ] || continue

  # Every discovered package is a vhost candidate. A selection narrows what
  # gets *built*, never what gets served — otherwise re-running for one package
  # would silently drop the other vhosts from the generated config.
  SHORT_NAMES+=("$short")
  NX_NAMES+=("$nx_name")
  PKG_DIRS+=("$pkg_dir")

  if [ ${#SELECTED[@]} -eq 0 ]; then
    BUILD_WANTED+=("$short")
  else
    for want in "${SELECTED[@]}"; do
      if [ "$want" = "$short" ] || [ "$want" = "$nx_name" ]; then
        BUILD_WANTED+=("$short")
      fi
    done
  fi
done < <(find packages -maxdepth 3 -name '.storybook' -type d | sort)

if [ ${#SHORT_NAMES[@]} -eq 0 ]; then
  echo "❌ No package with a .storybook directory found" >&2
  exit 1
fi

if [ ${#SELECTED[@]} -gt 0 ] && [ ${#BUILD_WANTED[@]} -eq 0 ]; then
  echo "❌ No package matched: ${SELECTED[*]}" >&2
  echo "   Available: ${SHORT_NAMES[*]}" >&2
  exit 1
fi

echo "   Discovered: ${SHORT_NAMES[*]}"
[ ${#SELECTED[@]} -gt 0 ] && echo "   Building:   ${BUILD_WANTED[*]}"
echo ""

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------
declare -a BUILT_SHORT=() BUILT_DIRS=()

for i in "${!SHORT_NAMES[@]}"; do
  short="${SHORT_NAMES[$i]}"
  nx_name="${NX_NAMES[$i]}"
  pkg_dir="${PKG_DIRS[$i]}"
  out="${WORKSPACE}/${pkg_dir}/storybook-static"

  wanted=false
  for w in "${BUILD_WANTED[@]}"; do [ "$w" = "$short" ] && wanted=true; done

  if [ "$DO_BUILD" = true ] && [ "$wanted" = true ]; then
    if [ -f "${out}/index.html" ] && [ "$FORCE" = false ]; then
      echo "⏭️  ${short}: already built (use --force to rebuild)"
    else
      echo "🔨 Building ${short} (${nx_name})..."
      # Node sizes its heap from available memory, which is not enough for the
      # heavier packages — excalidraw dies with "Ineffective mark-compacts near
      # heap limit" on a 6 GiB VM. Raise it rather than growing the VM, since
      # this is a build-time peak and not a steady-state need.
      if NODE_OPTIONS="--max-old-space-size=${STORYBOOK_NODE_HEAP_MB:-6144} ${NODE_OPTIONS:-}" \
        npx nx run "${nx_name}:build-storybook" >/tmp/storybook-${short}.log 2>&1; then
        echo "   ✅ ${short}"
      else
        echo "   ❌ ${short} failed — see /tmp/storybook-${short}.log"
        tail -5 "/tmp/storybook-${short}.log" | sed 's/^/      /'
        continue
      fi
    fi
  fi

  # Serve whatever has a build on disk, whether or not this run produced it.
  if [ -f "${out}/index.html" ]; then
    BUILT_SHORT+=("$short")
    BUILT_DIRS+=("$out")
  elif [ "$wanted" = true ]; then
    echo "   ⚠️  ${short}: no build output, skipping vhost"
  fi
done

if [ ${#BUILT_SHORT[@]} -eq 0 ]; then
  echo "" >&2
  echo "❌ Nothing was built, no vhosts written" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Index page
# ---------------------------------------------------------------------------
INDEX_DIR="${ENV_DIR}/storybook-index"
sudo mkdir -p "$INDEX_DIR"

{
  cat <<HTML
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Holistix Storybooks — ${DOMAIN}</title>
<style>
  body { font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
         max-width: 42rem; margin: 4rem auto; padding: 0 1.5rem; color: #1a1a1a; }
  h1 { font-size: 1.5rem; margin-bottom: .25rem; }
  p.sub { color: #666; margin-top: 0; }
  ul { list-style: none; padding: 0; }
  li { margin: .4rem 0; }
  a { display: block; padding: .7rem 1rem; border: 1px solid #e2e2e2;
      border-radius: 8px; text-decoration: none; color: #0b5fff; }
  a:hover { border-color: #0b5fff; background: #f6f9ff; }
  code { color: #666; font-size: .85em; }
</style>
</head>
<body>
<h1>Storybooks</h1>
<p class="sub">Environment <code>${ENV_NAME}</code> — ${#BUILT_SHORT[@]} package(s)</p>
<ul>
HTML
  for short in "${BUILT_SHORT[@]}"; do
    echo "  <li><a href=\"https://sb-${short}.${DOMAIN}\">${short}<br><code>sb-${short}.${DOMAIN}</code></a></li>"
  done
  cat <<HTML
</ul>
</body>
</html>
HTML
} | sudo tee "${INDEX_DIR}/index.html" >/dev/null

# Nginx workers run as www-data and the environment directory sits under /root.
# Grant traversal to that user alone rather than opening /root to everyone.
if command -v setfacl >/dev/null 2>&1; then
  sudo setfacl -m u:www-data:x /root /root/.local-dev "${ENV_DIR}" 2>/dev/null || true
  sudo setfacl -R -m u:www-data:rX "${INDEX_DIR}" 2>/dev/null || true
fi

# ---------------------------------------------------------------------------
# Nginx vhosts
# ---------------------------------------------------------------------------
CONF="/etc/nginx/sites-available/storybook-${ENV_NAME}"
LOGS_DIR="${ENV_DIR}/logs"
sudo mkdir -p "$LOGS_DIR"

{
  echo "# Generated by scripts/local-dev/build-storybook.sh for '${ENV_NAME}'"
  echo "# Do not edit by hand — re-run the script instead."
  echo ""

  cat <<CONFEOF
server {
    listen 443 ssl;
    server_name storybook.${DOMAIN};

    ssl_certificate ${ENV_DIR}/ssl-cert.pem;
    ssl_certificate_key ${ENV_DIR}/ssl-key.pem;

    root ${INDEX_DIR};
    index index.html;

    access_log ${LOGS_DIR}/storybook-access.log;
    error_log ${LOGS_DIR}/storybook-error.log;
}
CONFEOF

  for i in "${!BUILT_SHORT[@]}"; do
    short="${BUILT_SHORT[$i]}"
    dir="${BUILT_DIRS[$i]}"
    cat <<CONFEOF

server {
    listen 443 ssl;
    server_name sb-${short}.${DOMAIN};

    ssl_certificate ${ENV_DIR}/ssl-cert.pem;
    ssl_certificate_key ${ENV_DIR}/ssl-key.pem;

    root ${dir};
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Storybook fingerprints its assets, so they can be cached hard.
    location ~* \.(js|css|woff2?|ttf|svg|png|jpg|json)\$ {
        expires 1h;
        add_header Cache-Control public;
    }

    access_log ${LOGS_DIR}/storybook-${short}-access.log;
    error_log ${LOGS_DIR}/storybook-${short}-error.log;
}
CONFEOF
  done
} | sudo tee "$CONF" >/dev/null

sudo ln -sf "$CONF" "/etc/nginx/sites-enabled/storybook-${ENV_NAME}"

echo ""
echo "🔍 Validating Nginx configuration..."
if ! sudo nginx -t 2>&1 | sed 's/^/   /'; then
  echo "❌ Nginx rejected the configuration; the vhosts were not enabled." >&2
  sudo rm -f "/etc/nginx/sites-enabled/storybook-${ENV_NAME}"
  exit 1
fi

sudo nginx -s reload 2>/dev/null || sudo service nginx reload

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Storybooks exposed"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "   Index:  https://storybook.${DOMAIN}"
for short in "${BUILT_SHORT[@]}"; do
  echo "           https://sb-${short}.${DOMAIN}"
done
echo ""
echo "   The wildcard certificate and wildcard DNS already cover these,"
echo "   so nothing else needs configuring on the host OS."
echo ""
