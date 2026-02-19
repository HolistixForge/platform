#!/bin/bash
# =============================================================================
# lint-unused-tokens.sh
# Detects CSS custom properties defined in variables.scss that are not
# referenced anywhere else in the codebase.
# =============================================================================

set -euo pipefail

VARIABLES_FILE="packages/ui-base/src/lib/assets/css/variables.scss"
SEARCH_DIR="packages"
UNUSED_COUNT=0
TOTAL_COUNT=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "Scanning CSS custom properties in $VARIABLES_FILE..."
echo ""

# Extract all custom property definitions (--name: value)
# Matches lines like: --primary-100: #ece2ff;
TOKENS=$(grep -oP '(?<=  --)[\w-]+(?=:)' "$VARIABLES_FILE" | sort -u)

for token in $TOKENS; do
  TOTAL_COUNT=$((TOTAL_COUNT + 1))

  # Count references outside the definition file
  # Look for var(--token) or --token: (re-assignment) patterns
  REF_COUNT=$(grep -r --include="*.scss" --include="*.css" --include="*.tsx" --include="*.ts" \
    -l "var(--${token})" "$SEARCH_DIR" 2>/dev/null \
    | grep -v "$VARIABLES_FILE" \
    | wc -l)

  if [ "$REF_COUNT" -eq 0 ]; then
    # Also check for references in shadow/form tokens that use var() internally
    INTERNAL_REF=$(grep -c "var(--${token})" "$VARIABLES_FILE" 2>/dev/null || echo "0")
    # Subtract the definition itself (the line with --token:)
    DEFINITION_COUNT=$(grep -c "^  --${token}:" "$VARIABLES_FILE" 2>/dev/null || echo "0")
    SELF_REFS=$((INTERNAL_REF - DEFINITION_COUNT))

    if [ "$SELF_REFS" -le 0 ]; then
      echo -e "  ${YELLOW}UNUSED${NC}  --${token}"
      UNUSED_COUNT=$((UNUSED_COUNT + 1))
    fi
  fi
done

echo ""
echo "============================================="
echo -e "Total tokens scanned: ${TOTAL_COUNT}"
if [ "$UNUSED_COUNT" -eq 0 ]; then
  echo -e "${GREEN}No unused tokens found.${NC}"
else
  echo -e "${RED}Unused tokens: ${UNUSED_COUNT}${NC}"
  echo ""
  echo "Consider removing these tokens or adding references."
fi
echo "============================================="

exit "$UNUSED_COUNT"
