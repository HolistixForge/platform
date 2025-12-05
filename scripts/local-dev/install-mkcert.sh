#!/bin/bash
# Install mkcert for local SSL certificates
# Run this once in the development container

set -e

echo "🔐 Installing mkcert..."

# Download mkcert
curl -JLO "https://dl.filippo.io/mkcert/latest?for=linux/amd64"
chmod +x mkcert-v*-linux-amd64
sudo mv mkcert-v*-linux-amd64 /usr/local/bin/mkcert

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

