#!/bin/bash
set -e

# Package Namespace Rename: @monorepo/* → @holistix/*
# This script ONLY handles package namespace changes
#
# USAGE:
#   ./rename-packages.sh              # Dry run (shows what would change)
#   ./rename-packages.sh --execute    # Apply changes
#   ./rename-packages.sh --verify     # Verify completion

MODE="${1:-dry-run}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  PACKAGE NAMESPACE RENAME: @monorepo → @holistix       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Safety check - ensure we're in the right directory
if [[ ! -f "package.json" ]] || [[ ! -f "nx.json" ]]; then
    echo -e "${RED}ERROR: Must run from repository root${NC}"
    exit 1
fi

# Safety check - ensure we're not on main branch (for execute mode)
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
if [[ "$MODE" == "--execute" && "$CURRENT_BRANCH" == "main" ]]; then
    echo -e "${RED}ERROR: You are on the 'main' branch!${NC}"
    echo -e "${YELLOW}Create a branch first:${NC}"
    echo "  git checkout -b rebrand/package-namespace"
    exit 1
fi

echo -e "${BLUE}Current branch:${NC} $CURRENT_BRANCH"
echo ""

# Count current occurrences
count_namespace() {
    grep -r "@monorepo/" . \
        --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.json" \
        --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist \
        --exclude=package-lock.json \
        2>/dev/null | wc -l
}

CURRENT_COUNT=$(count_namespace)

# Verification mode
if [[ "$MODE" == "--verify" ]]; then
    echo -e "${YELLOW}═══ VERIFICATION MODE ═══${NC}"
    echo ""
    
    REMAINING=$(count_namespace)
    
    if [[ $REMAINING -eq 0 ]]; then
        echo -e "${GREEN}✅ SUCCESS: All @monorepo/* references have been updated!${NC}"
        echo ""
        echo -e "${BLUE}Next steps:${NC}"
        echo "  1. Regenerate package-lock.json:"
        echo "     ${YELLOW}npm install${NC}"
        echo ""
        echo "  2. Test build:"
        echo "     ${YELLOW}npx nx run-many -t build${NC}"
        echo ""
        echo "  3. If build succeeds, commit:"
        echo "     ${YELLOW}git add -A${NC}"
        echo "     ${YELLOW}git commit -m 'Rename package namespace: @monorepo → @holistix'${NC}"
        echo ""
        exit 0
    else
        echo -e "${RED}⚠️  Found $REMAINING remaining @monorepo/* references${NC}"
        echo ""
        echo "Search for them:"
        echo "  grep -r '@monorepo/' . --exclude-dir={node_modules,.git,dist} | less"
        exit 1
    fi
fi

# Dry run mode
if [[ "$MODE" != "--execute" ]]; then
    echo -e "${YELLOW}═══ DRY RUN MODE ═══${NC}"
    echo ""
    echo -e "${BLUE}Current state:${NC}"
    echo "  @monorepo/* references: $CURRENT_COUNT"
    echo ""
    
    echo -e "${BLUE}Files that will be updated:${NC}"
    echo ""
    
    # Show affected files
    echo "  📦 Package.json files (~33 files):"
    find . -name "package.json" -not -path "*/node_modules/*" -not -path "*/.git/*" \
        -exec grep -l "@monorepo/" {} \; 2>/dev/null | head -10
    echo "     ... and more"
    echo ""
    
    echo "  📝 TypeScript/JavaScript files (~350+ files):"
    grep -r "@monorepo/" . \
        --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" \
        --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist \
        --exclude=package-lock.json \
        -l 2>/dev/null | head -10
    echo "     ... and 340+ more files"
    echo ""
    
    echo -e "${BLUE}Changes that will be made:${NC}"
    echo "  ${YELLOW}@monorepo/app-frontend${NC}        → ${GREEN}@holistix/app-frontend${NC}"
    echo "  ${YELLOW}@monorepo/app-gateway${NC}         → ${GREEN}@holistix/app-gateway${NC}"
    echo "  ${YELLOW}@monorepo/app-ganymede${NC}        → ${GREEN}@holistix/app-ganymede${NC}"
    echo "  ${YELLOW}@monorepo/user-containers${NC}     → ${GREEN}@holistix/user-containers${NC}"
    echo "  ${YELLOW}@monorepo/collab${NC}              → ${GREEN}@holistix/collab${NC}"
    echo "  ${YELLOW}@monorepo/reducers${NC}            → ${GREEN}@holistix/reducers${NC}"
    echo "  ... and 25+ more packages"
    echo ""
    
    echo -e "${BLUE}Root package.json changes:${NC}"
    echo "  ${YELLOW}\"name\": \"@monorepo/source\"${NC} → ${GREEN}\"name\": \"@holistix/source\"${NC}"
    echo ""
    
    echo -e "${YELLOW}To execute these changes:${NC}"
    echo "  ./rename-packages.sh --execute"
    echo ""
    echo -e "${YELLOW}⚠️  Recommended workflow:${NC}"
    echo "  git checkout -b rebrand/package-namespace"
    echo "  git tag pre-namespace-rename"
    echo "  ./rename-packages.sh --execute"
    echo "  ./rename-packages.sh --verify"
    echo "  npm install                        # Regenerate package-lock.json"
    echo "  npx nx run-many -t build          # Test build"
    echo ""
    
    exit 0
fi

# Execute mode
if [[ "$MODE" == "--execute" ]]; then
    echo -e "${RED}═══ EXECUTE MODE ═══${NC}"
    echo ""
    echo -e "${YELLOW}This will update ~1,100 references across ~380 files${NC}"
    echo -e "${YELLOW}Press Ctrl+C within 5 seconds to cancel...${NC}"
    sleep 5
    echo ""
    
    # Create a backup point
    echo -e "${BLUE}Creating safety tag...${NC}"
    git tag -f pre-namespace-rename-$(date +%Y%m%d-%H%M%S) 2>/dev/null || true
    echo -e "${GREEN}✅ Safety tag created${NC}"
    echo ""
    
    echo -e "${BLUE}[1/3] Updating root package.json...${NC}"
    sed -i 's/"name": "@monorepo\/source"/"name": "@holistix\/source"/g' package.json
    echo -e "${GREEN}✅ Root package.json updated${NC}"
    
    echo -e "${BLUE}[2/3] Updating all package.json files...${NC}"
    find . -name "package.json" -type f \
        -not -path "*/node_modules/*" \
        -not -path "*/.git/*" \
        -not -name "package-lock.json" \
        -exec sed -i 's/@monorepo\//@holistix\//g' {} \; 2>/dev/null
    echo -e "${GREEN}✅ All package.json files updated${NC}"
    
    echo -e "${BLUE}[3/3] Updating all TypeScript/JavaScript imports...${NC}"
    find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) \
        -not -path "*/node_modules/*" \
        -not -path "*/.git/*" \
        -not -path "*/dist/*" \
        -exec sed -i 's/@monorepo\//@holistix\//g' {} \; 2>/dev/null
    echo -e "${GREEN}✅ All imports updated${NC}"
    
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  ✅ PACKAGE NAMESPACE RENAME COMPLETE!                 ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    # Count updated files
    UPDATED_COUNT=$(git diff --name-only | wc -l)
    echo -e "${BLUE}Files modified:${NC} $UPDATED_COUNT"
    echo ""
    
    echo -e "${BLUE}Next steps:${NC}"
    echo ""
    echo "  1. Verify completion:"
    echo "     ${GREEN}./rename-packages.sh --verify${NC}"
    echo ""
    echo "  2. Review changes:"
    echo "     ${GREEN}git status${NC}"
    echo "     ${GREEN}git diff packages/app-frontend/package.json${NC} (example)"
    echo ""
    echo "  3. Regenerate package-lock.json:"
    echo "     ${YELLOW}npm install${NC}"
    echo "     ${YELLOW}# This will take a few minutes${NC}"
    echo ""
    echo "  4. Test build:"
    echo "     ${YELLOW}npx nx run-many -t build${NC}"
    echo "     ${YELLOW}# This will take 5-10 minutes${NC}"
    echo ""
    echo "  5. If everything works, commit:"
    echo "     ${GREEN}git add -A${NC}"
    echo "     ${GREEN}git commit -m 'Rename package namespace: @monorepo → @holistix'${NC}"
    echo ""
    
    exit 0
fi

