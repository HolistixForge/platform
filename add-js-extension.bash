#!/bin/bash

# Function to recursively search for .ts and .tsx files
add_extensions() {
    local dir="$1"

    # Find all .ts and .tsx files, excluding the dist folder
    find "$dir" -type f \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/dist/*" | while read -r file; do
        # Use sed to add .js to import statements that start with `from './`
        sed -i -E "s#from './([^']+)'#from './\1.js'#g" "$file"

        # Replace any repeated .js.js.js... to a single .js
        sed -i -E "s#\.js(\.js)+#\.js#g" "$file"

        echo "Processed: $file"
    done
}

# Run the function on the specified directory (current directory by default)
if [ -z "$1" ]; then
    DIR="."
else
    DIR="$1"
fi

# Run the add_extensions function
add_extensions "$DIR"
