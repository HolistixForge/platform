#!/bin/bash
set -e

# Holistix Rebranding Script
# Automates the text replacement portion of rebranding
# 
# USAGE:
#   ./rebrand.sh                    # Dry run (shows what would change)
#   ./rebrand.sh --execute          # Actually perform changes
#   ./rebrand.sh --verify           # Verify changes after execution
#
# ⚠️ WARNING: Always run in a dedicated branch first!
# ⚠️ Recommended: Create backup before running with --execute
#
# RECOMMENDED WORKFLOW:
#   git checkout -b rebrand/holistix
#   git tag pre-rebrand-backup
#   ./rebrand.sh                    # Review changes
#   ./rebrand.sh --execute          # Apply changes
#   ./rebrand.sh --verify           # Verify
#   npm install                     # Regenerate package-lock
#   npx nx run-many -t build        # Test build

MODE="${1:-dry-run}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     HOLISTIX REBRANDING AUTOMATION SCRIPT             ║${NC}"
echo -e "${BLUE}║     Demiurge → Holistix                                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check current branch
CURRENT_BRANCH=$(git branch --show-current)
if [[ "$MODE" == "--execute" && "$CURRENT_BRANCH" == "main" ]]; then
    echo -e "${RED}ERROR: You are on the 'main' branch!${NC}"
    echo -e "${YELLOW}Please create a dedicated rebranding branch first:${NC}"
    echo -e "  git checkout -b rebrand/holistix"
    exit 1
fi

echo -e "${BLUE}Current branch:${NC} $CURRENT_BRANCH"
echo -e "${BLUE}Mode:${NC} $MODE"
echo ""

# Function to count matches
count_matches() {
    local pattern=$1
    local path=${2:-.}
    local count=$(grep -r "$pattern" "$path" \
        --exclude-dir={node_modules,.git,dist} \
        --exclude=package-lock.json \
        --exclude=rebrand.sh \
        --exclude=REBRANDING_TODO.md \
        --exclude=REBRANDING_SUMMARY.md \
        2>/dev/null | wc -l)
    echo "$count"
}

# Verification mode
if [[ "$MODE" == "--verify" ]]; then
    echo -e "${YELLOW}═══ VERIFICATION MODE ═══${NC}"
    echo ""
    
    echo -e "${BLUE}Checking for remaining old references...${NC}"
    
    DEMIURGE_COUNT=$(count_matches "demiurge" ".")
    MONOREPO_COUNT=$(count_matches "@monorepo/" ".")
    DOCKER_COUNT=$(count_matches "holistix/" ".")
    DOMAIN_COUNT=$(count_matches "demiurge\.co" ".")
    KOSMO_COUNT=$(count_matches "Kosmoforge" "./website")
    YOURORG_COUNT=$(count_matches "YourOrg" ".")
    GALAXIE_COUNT=$(count_matches "DemiurgeGalaxie" ".")
    
    TOTAL_ISSUES=$((DEMIURGE_COUNT + MONOREPO_COUNT + DOCKER_COUNT + DOMAIN_COUNT + KOSMO_COUNT + YOURORG_COUNT + GALAXIE_COUNT))
    
    echo ""
    echo -e "${BLUE}Results:${NC}"
    echo "  'demiurge' occurrences:      $DEMIURGE_COUNT (expected: 0)"
    echo "  '@monorepo/' references:     $MONOREPO_COUNT (expected: 0)"
    echo "  'holistix/' Docker refs:     $DOCKER_COUNT (expected: 0)"
    echo "  'holistix.so' domains:       $DOMAIN_COUNT (expected: 0)"
    echo "  'Kosmoforge' in website:     $KOSMO_COUNT (expected: 0)"
    echo "  'YourOrg' placeholders:      $YOURORG_COUNT (expected: 0)"
    echo "  'DemiurgeGalaxie' refs:      $GALAXIE_COUNT (expected: 0)"
    echo ""
    
    if [[ $TOTAL_ISSUES -eq 0 ]]; then
        echo -e "${GREEN}✅ SUCCESS: All references have been updated!${NC}"
        echo ""
        echo -e "${BLUE}Next steps:${NC}"
        echo "  1. npm install                    # Regenerate package-lock.json"
        echo "  2. npx nx run-many -t build      # Test build"
        echo "  3. Review REBRANDING_TODO.md for manual tasks"
        exit 0
    else
        echo -e "${RED}⚠️  WARNING: $TOTAL_ISSUES old references still found${NC}"
        echo ""
        echo -e "${YELLOW}Search for details:${NC}"
        echo "  grep -ri 'demiurge' . --exclude-dir={node_modules,.git,dist}"
        echo "  grep -r '@monorepo/' . --exclude-dir={node_modules,.git,dist}"
        exit 1
    fi
fi

# Dry run mode (default)
if [[ "$MODE" == "dry-run" || "$MODE" == "" ]]; then
    echo -e "${YELLOW}═══ DRY RUN MODE (no changes will be made) ═══${NC}"
    echo ""
    echo -e "${BLUE}This script will perform the following changes:${NC}"
    echo ""
    
    echo "1. Brand name: 'demiurge' → 'holistix' (case-insensitive)"
    echo "   Affected: ~275 occurrences in ~144 files"
    echo ""
    
    echo "2. Package namespace: '@monorepo/*' → '@holistix/*'"
    echo "   Affected: ~1,057 occurrences in ~379 files ⚠️ BIGGEST CHANGE"
    echo ""
    
    echo "3. Docker images: 'holistix/*' → 'holistix/*'"
    echo "   Affected: ~8 occurrences in Dockerfiles and code"
    echo ""
    
    echo "4. Domain: 'holistix.so' → 'holistix.so'"
    echo "   Affected: ~14 occurrences in 7 files"
    echo ""
    
    echo "5. Website: 'Kosmoforge' → 'Holistix'"
    echo "   Affected: ~103 occurrences in website files"
    echo ""
    
    echo "6. GitHub URLs: 'YourOrg' → 'Holistix', 'DemiurgeGalaxie' → 'Holistix'"
    echo "   Affected: ~8 files"
    echo ""
    
    echo "7. File renames (requires manual git mv):"
    echo "   - packages/modules/space/src/lib/components/demiurge-space.tsx"
    echo "   - packages/modules/space/src/lib/stories/story-demiurge-space.tsx"
    echo "   - docker-images/user-images/demiurge-functions.sh"
    echo "   - packages/modules/*/docker-image/demiurge-entrypoint.sh (4 files)"
    echo ""
    
    echo -e "${YELLOW}To execute these changes:${NC}"
    echo "  ./rebrand.sh --execute"
    echo ""
    echo -e "${YELLOW}To verify after execution:${NC}"
    echo "  ./rebrand.sh --verify"
    echo ""
    
    exit 0
fi

# Execute mode
if [[ "$MODE" == "--execute" ]]; then
    echo -e "${RED}═══ EXECUTE MODE - Changes will be applied! ═══${NC}"
    echo ""
    echo -e "${YELLOW}Press Ctrl+C within 5 seconds to cancel...${NC}"
    sleep 5
    echo ""
    
    echo -e "${BLUE}[1/7] Replacing 'demiurge' → 'holistix' (case-insensitive)...${NC}"
    find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.md" -o -name "*.json" -o -name "*.html" -o -name "*.css" -o -name "*.sh" \) \
      -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/dist/*" \
      -not -name "rebrand.sh" -not -name "REBRANDING_TODO.md" -not -name "REBRANDING_SUMMARY.md" \
      -exec sed -i 's/holistix/holistix/gi' {} + 2>/dev/null || true
    echo -e "${GREEN}✅ Brand name updated${NC}"
    
    echo -e "${BLUE}[2/7] Replacing '@monorepo/' → '@holistix/'...${NC}"
    find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.json" \) \
      -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/dist/*" -not -path "*/package-lock.json" \
      -exec sed -i 's/@monorepo\//@holistix\//g' {} + 2>/dev/null || true
    echo -e "${GREEN}✅ Package namespace updated${NC}"
    
    echo -e "${BLUE}[3/7] Replacing 'holistix/' → 'holistix/' (Docker images)...${NC}"
    find . -type f \( -name "Dockerfile*" -o -name "*.ts" -o -name "*.sh" \) \
      -not -path "*/node_modules/*" -not -path "*/.git/*" \
      -exec sed -i 's/demiurge\//holistix\//g' {} + 2>/dev/null || true
    echo -e "${GREEN}✅ Docker images updated${NC}"
    
    echo -e "${BLUE}[4/7] Replacing 'holistix.so' → 'holistix.so' (domains)...${NC}"
    find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.md" -o -name "*.html" -o -name "*.sh" \) \
      -not -path "*/node_modules/*" -not -path "*/.git/*" \
      -exec sed -i 's/demiurge\.co/holistix.so/g' {} + 2>/dev/null || true
    echo -e "${GREEN}✅ Domains updated${NC}"
    
    echo -e "${BLUE}[5/7] Replacing 'Kosmoforge' → 'Holistix' (website)...${NC}"
    find ./website -type f \( -name "*.html" -o -name "*.md" -o -name "*.css" \) \
      -exec sed -i 's/Kosmoforge/Holistix/g' {} + 2>/dev/null || true
    echo -e "${GREEN}✅ Website updated${NC}"
    
    echo -e "${BLUE}[6/7] Replacing GitHub placeholders...${NC}"
    find . -type f -name "*.md" \
      -not -path "*/node_modules/*" -not -path "*/.git/*" \
      -not -name "REBRANDING_TODO.md" -not -name "REBRANDING_SUMMARY.md" \
      -exec sed -i 's|https://github.com/YourOrg/monorepo|https://github.com/Holistix/platform|g' {} + 2>/dev/null || true
    find . -type f -name "*.md" \
      -not -path "*/node_modules/*" -not -path "*/.git/*" \
      -exec sed -i 's/YourOrg/Holistix/g' {} + 2>/dev/null || true
    find ./website -type f -name "*.html" \
      -exec sed -i 's|https://github.com/DemiurgeGalaxie/monorepo|https://github.com/Holistix/platform|g' {} + 2>/dev/null || true
    find ./website -type f -name "*.html" \
      -exec sed -i 's/DemiurgeGalaxie/Holistix/g' {} + 2>/dev/null || true
    echo -e "${GREEN}✅ GitHub URLs updated${NC}"
    
    echo -e "${BLUE}[7/7] Renaming files...${NC}"
    if git mv packages/modules/space/src/lib/components/demiurge-space.tsx packages/modules/space/src/lib/components/holistix-space.tsx 2>/dev/null; then
        echo "  ✓ Renamed demiurge-space.tsx → holistix-space.tsx"
    fi
    if git mv packages/modules/space/src/lib/stories/story-demiurge-space.tsx packages/modules/space/src/lib/stories/story-holistix-space.tsx 2>/dev/null; then
        echo "  ✓ Renamed story-demiurge-space.tsx → story-holistix-space.tsx"
    fi
    if git mv docker-images/user-images/demiurge-functions.sh docker-images/user-images/holistix-functions.sh 2>/dev/null; then
        echo "  ✓ Renamed demiurge-functions.sh → holistix-functions.sh"
    fi
    if git mv packages/modules/user-containers/docker-images/ubuntu/demiurge-entrypoint.sh packages/modules/user-containers/docker-images/ubuntu/holistix-entrypoint.sh 2>/dev/null; then
        echo "  ✓ Renamed ubuntu/demiurge-entrypoint.sh"
    fi
    if git mv packages/modules/pgadmin4/docker-image/demiurge-entrypoint.sh packages/modules/pgadmin4/docker-image/holistix-entrypoint.sh 2>/dev/null; then
        echo "  ✓ Renamed pgadmin4/demiurge-entrypoint.sh"
    fi
    if git mv packages/modules/n8n/docker-image/demiurge-entrypoint.sh packages/modules/n8n/docker-image/holistix-entrypoint.sh 2>/dev/null; then
        echo "  ✓ Renamed n8n/demiurge-entrypoint.sh"
    fi
    if git mv packages/modules/jupyter/docker-image/demiurge-entrypoint.sh packages/modules/jupyter/docker-image/holistix-entrypoint.sh 2>/dev/null; then
        echo "  ✓ Renamed jupyter/demiurge-entrypoint.sh"
    fi
    echo -e "${GREEN}✅ Files renamed${NC}"
    
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  ✅ REBRANDING COMPLETE!                               ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo "  1. Review changes:          git status"
    echo "  2. Verify completion:       ./rebrand.sh --verify"
    echo "  3. Regenerate lockfile:     npm install"
    echo "  4. Test build:              npx nx run-many -t build"
    echo "  5. Commit changes:          git add -A && git commit"
    echo ""
    echo -e "${YELLOW}Manual tasks remaining (see REBRANDING_TODO.md):${NC}"
    echo "  - Create Holistix logo SVG files"
    echo "  - Delete kosmoforge-*.svg files"
    echo "  - Update website logo references"
    echo "  - Review documentation manually"
    echo "  - Test all Docker builds"
    echo "  - Reserve GitHub organization 'Holistix'"
    echo "  - Decide on license model"
    echo ""
    
    exit 0
fi

# Default: show dry run info
echo -e "${YELLOW}Running in DRY RUN mode (no changes will be made)${NC}"
echo ""
echo -e "${BLUE}Current state:${NC}"
echo "  'demiurge' occurrences:      $(count_matches 'demiurge' '.')"
echo "  '@monorepo/' references:     $(count_matches '@monorepo/' '.')"
echo "  'holistix/' Docker refs:     $(count_matches 'holistix/' '.')"
echo "  'holistix.so' domains:       $(count_matches 'demiurge\.co' '.')"
echo "  'Kosmoforge' in website:     $(count_matches 'Kosmoforge' './website')"
echo "  'YourOrg' placeholders:      $(count_matches 'YourOrg' '.')"
echo "  'DemiurgeGalaxie' refs:      $(count_matches 'DemiurgeGalaxie' '.')"
echo ""

echo -e "${BLUE}Changes that will be made:${NC}"
echo ""
echo -e "${YELLOW}1. Text Replacements:${NC}"
echo "   demiurge → holistix (case-insensitive)"
echo "   @monorepo/* → @holistix/*"
echo "   holistix/* → holistix/* (Docker)"
echo "   holistix.so → holistix.so"
echo "   Kosmoforge → Holistix (website)"
echo "   YourOrg → Holistix"
echo "   DemiurgeGalaxie → Holistix"
echo ""

echo -e "${YELLOW}2. File Renames (preserves git history):${NC}"
echo "   demiurge-space.tsx → holistix-space.tsx"
echo "   story-demiurge-space.tsx → story-holistix-space.tsx"
echo "   demiurge-functions.sh → holistix-functions.sh"
echo "   demiurge-entrypoint.sh → holistix-entrypoint.sh (4 modules)"
echo ""

echo -e "${BLUE}To execute these changes:${NC}"
echo "  ./rebrand.sh --execute"
echo ""
echo -e "${YELLOW}⚠️  Recommended workflow:${NC}"
echo "  git checkout -b rebrand/holistix    # Create branch"
echo "  git tag pre-rebrand-backup          # Create backup tag"
echo "  ./rebrand.sh --execute              # Apply changes"
echo "  ./rebrand.sh --verify               # Verify completion"
echo "  npm install                         # Regenerate package-lock"
echo "  npx nx run-many -t build            # Test build"
echo ""

exit 0

