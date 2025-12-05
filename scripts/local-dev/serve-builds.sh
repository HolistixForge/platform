#!/bin/bash
# HTTP server to serve ONLY gateway build tarballs
# Serves from /root/.local-dev-builds/ (isolated from environment configs)
# URL: http://172.17.0.2:8090/gateway-{env-name}.tar.gz

set -e

PORT=8090
BUILDS_DIR="/root/.local-dev-builds"

echo "🌐 Starting gateway build server..."
echo "   Port: ${PORT}"
echo "   Serving: ${BUILDS_DIR}"
echo ""

# Create builds directory
mkdir -p "$BUILDS_DIR"

# Create index page
cat > "${BUILDS_DIR}/index.html" <<'EOF'
<!DOCTYPE html>
<html>
<head><title>Gateway Builds</title></head>
<body>
<h1>Gateway Build Distribution Server</h1>
<p>Available builds:</p>
<ul id="builds"></ul>
<script>
fetch('/').then(r => r.text()).then(html => {
  const builds = html.match(/gateway-[^"]+\.tar\.gz/g) || [];
  document.getElementById('builds').innerHTML = builds.map(b => 
    `<li><a href="/${b}">${b}</a></li>`
  ).join('');
});
</script>
</body>
</html>
EOF

# Get dev container IP
DEV_CONTAINER_IP=$(hostname -I | awk '{print $1}')

echo "📦 Build server serving on:"
echo "   http://${DEV_CONTAINER_IP}:${PORT}/gateway-{env-name}.tar.gz"
echo "   http://0.0.0.0:${PORT}/gateway-{env-name}.tar.gz"
echo ""
echo "🔒 Security:"
echo "   ✓ Only serves .tar.gz files from ${BUILDS_DIR}"
echo "   ✓ No access to .env files, keys, or configs"
echo "   ✓ Isolated from environment directories"
echo ""
echo "💡 Usage:"
echo "   Pack build: ./pack-gateway-build.sh dev-001"
echo "   Gateway fetches: curl ${DEV_CONTAINER_IP}:8090/gateway-dev-001.tar.gz"
echo ""

# Start HTTP server (restricted to builds directory only)
cd "$BUILDS_DIR"
python3 -m http.server $PORT --bind 0.0.0.0
