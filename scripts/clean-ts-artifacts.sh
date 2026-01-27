#!/usr/bin/env bash
# Clean stale TypeScript artifacts that cause TS6305 errors
# This must run BEFORE tsc-files in lint-staged

set -e

# Find and remove all out-tsc directories
# Using a while loop to handle directory deletion properly
find packages -type d -name "out-tsc" 2>/dev/null | while read -r dir; do
  rm -rf "$dir"
done

# Remove tsbuildinfo files
rm -f tsconfig.*.tsbuildinfo 2>/dev/null || true
find packages -name "*.tsbuildinfo" -delete 2>/dev/null || true

exit 0
