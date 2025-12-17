#!/bin/bash
# Build static documentation using md-file-graph

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MD_FILE_GRAPH_DIR="/root/workspace/md-file-graph"
OUTPUT_DIR="$SCRIPT_DIR/static"
BASE_URL="${BASE_URL:-https://holistix.so}"
TEMPLATE="$SCRIPT_DIR/doc-template.html"

echo "📚 Building Static Documentation Site"
echo ""
echo "Settings:"
echo "  Repository: $REPO_ROOT"
echo "  Output: $OUTPUT_DIR"
echo "  Base URL: $BASE_URL"
echo "  Template: $TEMPLATE"
echo ""

# Check if md-file-graph is installed
if [ ! -d "$MD_FILE_GRAPH_DIR" ]; then
    echo "❌ Error: md-file-graph not found at $MD_FILE_GRAPH_DIR"
    echo ""
    echo "Please clone md-file-graph:"
    echo "  git clone https://github.com/yourusername/md-file-graph $MD_FILE_GRAPH_DIR"
    echo "  cd $MD_FILE_GRAPH_DIR"
    echo "  python3 -m venv venv"
    echo "  source venv/bin/activate"
    echo "  pip install -e ."
    exit 1
fi

# Check if md-file-graph venv exists
if [ ! -f "$MD_FILE_GRAPH_DIR/venv/bin/md-file-graph" ]; then
    echo "❌ Error: md-file-graph not properly installed"
    echo ""
    echo "Please install md-file-graph:"
    echo "  cd $MD_FILE_GRAPH_DIR"
    echo "  python3 -m venv venv"
    echo "  source venv/bin/activate"
    echo "  pip install -e ."
    exit 1
fi

# Clean output directory
if [ -d "$OUTPUT_DIR" ]; then
    echo "🧹 Cleaning output directory..."
    rm -rf "$OUTPUT_DIR"
fi

# Generate HTML documentation
echo "🚀 Generating HTML documentation..."
echo ""

cd "$MD_FILE_GRAPH_DIR"
source venv/bin/activate

md-file-graph html "$REPO_ROOT" \
    --output "$OUTPUT_DIR" \
    --base-url "$BASE_URL" \
    --template "$TEMPLATE"

echo ""
echo "✨ Documentation build complete!"
echo ""
echo "📁 Output: $OUTPUT_DIR"
echo ""

# Copy assets automatically
echo "📦 Copying website assets to static directory..."
cp "$SCRIPT_DIR"/*.css "$OUTPUT_DIR/" 2>/dev/null || true
cp "$SCRIPT_DIR"/*.js "$OUTPUT_DIR/" 2>/dev/null || true
cp "$SCRIPT_DIR"/*.svg "$OUTPUT_DIR/" 2>/dev/null || true
echo "✅ Assets copied"
echo ""

echo "To deploy:"
echo "  1. Deploy the static/ directory to your web server"
echo ""
echo "  2. Submit sitemap to search engines:"
echo "     $BASE_URL/sitemap.xml"
echo ""
echo "For local testing:"
echo "  cd $OUTPUT_DIR && python3 -m http.server 8000"

