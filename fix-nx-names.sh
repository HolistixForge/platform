#!/bin/bash
# Fix Nx project names to include @holistix scope
# This updates the "nx.name" field in package.json files

set -e

echo "Fixing Nx project names to include @holistix/ scope..."
echo ""

# Update each package with nx.name field
update_nx_name() {
    local file=$1
    local old_name=$2
    local new_name=$3
    
    if grep -q "\"name\": \"$old_name\"" "$file"; then
        # Use | as delimiter instead of / to avoid conflicts with @holistix/
        sed -i "s|\"name\": \"$old_name\"|\"name\": \"$new_name\"|g" "$file"
        echo "✓ $file: $old_name → $new_name"
    fi
}

# Applications
update_nx_name "packages/app-frontend/package.json" "app-frontend" "@holistix/app-frontend"
update_nx_name "packages/app-gateway/package.json" "app-gateway" "@holistix/app-gateway"
update_nx_name "packages/app-ganymede/package.json" "app-ganymede" "@holistix/app-ganymede"
update_nx_name "packages/app-ganymede-cmds/package.json" "app-ganymede-cmds" "@holistix/app-ganymede-cmds"

# Libraries (core)
update_nx_name "packages/api-fetch/package.json" "api-fetch" "@holistix/api-fetch"
update_nx_name "packages/backend-engine/package.json" "backend-engine" "@holistix/backend-engine"
update_nx_name "packages/collab-engine/package.json" "collab-engine" "@holistix/collab-engine"
update_nx_name "packages/frontend-data/package.json" "frontend-data" "@holistix/frontend-data"
update_nx_name "packages/log/package.json" "log" "@holistix/log"
update_nx_name "packages/simple-types/package.json" "simple-types" "@holistix/simple-types"
update_nx_name "packages/ui-base/package.json" "ui-base" "@holistix/ui-base"
update_nx_name "packages/ui-toolkit/package.json" "ui-toolkit" "@holistix/ui-toolkit"
update_nx_name "packages/ui-views/package.json" "ui-views" "@holistix/ui-views"

# Special case: demiurge-types → types (also rename the package itself!)
update_nx_name "packages/demiurge-types/package.json" "demiurge-types" "@holistix/types"

# Modules
update_nx_name "packages/modules/chats/package.json" "chats" "@holistix/chats"
update_nx_name "packages/modules/core-graph/package.json" "core-graph" "@holistix/core-graph"
update_nx_name "packages/modules/jupyter/package.json" "jupyter" "@holistix/jupyter"
update_nx_name "packages/modules/module/package.json" "module" "@holistix/module"
update_nx_name "packages/modules/notion/package.json" "notion" "@holistix/notion"
update_nx_name "packages/modules/socials/package.json" "socials" "@holistix/socials"
update_nx_name "packages/modules/space/package.json" "space" "@holistix/space"
update_nx_name "packages/modules/tabs/package.json" "tabs" "@holistix/tabs"
update_nx_name "packages/modules/user-containers/package.json" "user-containers" "@holistix/user-containers"

echo ""
echo "✅ All Nx project names updated to @holistix/* scope"
echo ""
echo "Next: npm install to regenerate lock file"

