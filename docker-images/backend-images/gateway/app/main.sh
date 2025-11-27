#!/bin/bash

# Source the configuration file
source "${BASH_SOURCE%/*}/config.conf"

cd "${GATEWAY_SCRIPTS_DIR}"

# Function to set -x if not already set
set_x_if_not_set() {
    if ! [[ $- =~ x ]]; then
        set -x
        export XTRACE_ON_EXIT=1
    fi
}

# Function to unset -x
unset_x() {
    if [ -n "$XTRACE_ON_EXIT" ]; then
        set +x
    fi
}

# Function to execute a script
execute_script() {
    script="$1"
    if [ -f "$script" ] && [ -x "$script" ]; then
        "$script"
    else
        echo "Script not found or not executable: $script"
    fi
}

# Trap to unset -x when the script exits
trap 'unset_x' EXIT

# Trap to unset -x if an error occurs
trap 'unset_x; trap - ERR; exit 1' ERR

# Main script

# Set bash to stop on error
set -e

# Parse command line options
while [[ $# -gt 0 ]]; do
    key="$1"

    case $key in
    -r | --run)
        script="$2"
        execute_script "$script"
        shift # past argument
        shift # past value
        ;;
    *)
        echo "Unknown option: $key"
        exit 1
        ;;
    esac
done
