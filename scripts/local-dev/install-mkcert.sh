#!/bin/bash
# Install mkcert for local SSL certificates
# Run this once in the development container

set -e

echo "🔐 Installing mkcert..."

# Detect the CPU architecture (the platform runs on both x86_64 servers and
# arm64 VMs on Apple Silicon)
case "$(uname -m)" in
  x86_64 | amd64) MKCERT_ARCH="amd64" ;;
  aarch64 | arm64) MKCERT_ARCH="arm64" ;;
  *)
    echo "❌ Unsupported architecture: $(uname -m)"
    exit 1
    ;;
esac

echo "   Architecture: ${MKCERT_ARCH}"

# Download mkcert
curl -fsSL -o /tmp/mkcert "https://dl.filippo.io/mkcert/latest?for=linux/${MKCERT_ARCH}"
chmod +x /tmp/mkcert
sudo mv /tmp/mkcert /usr/local/bin/mkcert

# Create local CA
mkcert -install

CA_ROOT=$(mkcert -CAROOT)

echo "✅ mkcert installed"
echo ""
echo "📋 Next step: Copy the root CA to your host OS (Windows/macOS/Linux)"
echo ""
echo "   Root CA location: ${CA_ROOT}/rootCA.pem"
echo ""
echo "   Copy to workspace:"
echo "   $ cp ${CA_ROOT}/rootCA.pem /root/workspace/monorepo/rootCA.pem"
echo ""
echo "   Then on your host OS, install the certificate:"
echo "   - Windows: Right-click rootCA.pem → Install → Trusted Root"
echo "   - macOS: Double-click → Add to System keychain → Always Trust"
echo "   - Linux: certutil -d sql:\$HOME/.pki/nssdb -A -t C,, -n mkcert-dev -i rootCA.pem"
echo ""
echo "   See LOCAL_DEVELOPMENT.md for detailed instructions."

