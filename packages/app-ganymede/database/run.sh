#!/bin/bash

# Check if the directory argument is provided
if [ $# -lt 1 ]; then
    echo "Usage: ./run.sh <directory_path> [database_name]"
    exit 1
fi

# Set the directory containing SQL scripts
scriptFileOrDirectory=$1

# Database name from argument (2nd param) or environment variable or default
if [ -n "$2" ]; then
    database="$2"
else
    database="${PGDATABASE:-ganymede_db}"
fi

# Set PostgreSQL database connection parameters (can be overridden by environment variables)
h="${PGHOST:-127.0.0.1}"
port="${PGPORT:-5432}"
username="${PGUSER:-postgres}"

# Check if the argument is a directory or a file
if [ -d "$scriptFileOrDirectory" ]; then
    # Get a sorted list of SQL script files
    sortedScripts=$(find "$scriptFileOrDirectory" -maxdepth 1 -name "*.sql" | sort)

    # Loop through each SQL script in the sorted list
    for scriptPath in $sortedScripts; do
        # Execute the SQL script using psql
        if psql -U "$username" -h "$h" -d "$database" -p "$port" -f "$scriptPath" -q; then
            echo -e "\e[32mSuccessfully executed script: $scriptPath\e[0m"
        else
            echo -e "\e[31mFailed to execute script: $scriptPath\e[0m"
            echo -e "\e[31mError: $?\e[0m"
        fi
    done
elif [ -f "$scriptFileOrDirectory" ]; then
    # If it's a file, execute only that file
    if psql -U "$username" -h "$h" -d "$database" -p "$port" -f "$scriptFileOrDirectory" -q; then
        echo -e "\e[32mSuccessfully executed script: $scriptFileOrDirectory\e[0m"
    else
        echo -e "\e[31mFailed to execute script: $scriptFileOrDirectory\e[0m"
        echo -e "\e[31mError: $?\e[0m"
    fi
else
    echo -e "\e[31mInvalid argument: $scriptFileOrDirectory\e[0m"
fi
