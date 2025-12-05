#!/bin/bash
#
# Validate Node.js application bundles for React dependencies
# This script should be run after building Node apps to ensure no frontend
# dependencies leaked into backend bundles.
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_ROOT"

echo ""
echo "🔍 Validating Node.js application bundles..."
echo ""

# Find all Node.js apps (apps with main.js in dist)
NODE_APPS=(
  "dist/packages/app-gateway/main.js"
  "dist/packages/app-ganymede/main.js"
  "dist/packages/app-ganymede-cmds/main.js"
)

# Filter to only existing files
EXISTING_APPS=()
for app in "${NODE_APPS[@]}"; do
  if [ -f "$app" ]; then
    EXISTING_APPS+=("$app")
  else
    echo "⚠️  Skipping $app (not found)"
  fi
done

if [ ${#EXISTING_APPS[@]} -eq 0 ]; then
  echo "❌ No Node.js application bundles found to validate"
  echo "   Run 'npx nx build app-gateway app-ganymede app-ganymede-cmds' first"
  exit 1
fi

echo "📦 Found ${#EXISTING_APPS[@]} bundle(s) to validate"
echo ""

# Run analyzer
node "$SCRIPT_DIR/analyze-bundle.js" "${EXISTING_APPS[@]}"
EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ All bundles validated successfully"
else
  echo "❌ Bundle validation failed - fix React dependencies before deploying"
fi

exit $EXIT_CODE


