#!/bin/bash
# Script to copy documentation files to website directory for serving
# Uses docs-config.json to determine which files to copy

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WEBSITE_DIR="$SCRIPT_DIR"
DOCS_DIR="$WEBSITE_DIR/docs"
CONFIG_FILE="$WEBSITE_DIR/docs-config.json"

# Check if jq is available (for JSON parsing)
if ! command -v jq &> /dev/null; then
    echo "Error: jq is required to parse the config file."
    echo "Install jq: sudo apt-get install jq (or brew install jq on macOS)"
    exit 1
fi

# Check if config file exists
if [ ! -f "$CONFIG_FILE" ]; then
    echo "Error: Config file not found: $CONFIG_FILE"
    exit 1
fi

echo "Reading documentation configuration from: $CONFIG_FILE"
echo "Copying documentation files to website directory..."

# Read sections from config
sections=$(jq -c '.sections[]' "$CONFIG_FILE")

# Process each section
while IFS= read -r section; do
    # Extract items from section
    items=$(echo "$section" | jq -c '.items[]')
    
    while IFS= read -r item; do
        source_path=$(echo "$item" | jq -r '.source')
        dest_path=$(echo "$item" | jq -r '.path')
        label=$(echo "$item" | jq -r '.label')
        
        # Build full paths
        full_source="$REPO_ROOT/$source_path"
        full_dest="$DOCS_DIR/$dest_path"
        
        # Create destination directory if needed
        dest_dir=$(dirname "$full_dest")
        mkdir -p "$dest_dir"
        
        # Copy file
        if [ -f "$full_source" ]; then
            cp "$full_source" "$full_dest"
            echo "  ✓ Copied: $label"
        else
            echo "  ⚠ Warning: File not found: $full_source (for $label)"
        fi
    done <<< "$items"
done <<< "$sections"

echo ""
echo "Documentation files copied successfully!"
echo "Files are now available in: $DOCS_DIR"

