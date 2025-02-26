#!/bin/bash

# Get the script's directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# exemple: $ watch -n 30 -c ./doc/monitoring.sh

ENVIRONMENT=dev-002

# List of services to monitor (URL and display name)
declare -A services=(
    ["frontend"]="https://${ENVIRONMENT}.demiurge.co"
#    ["frontend dev"]="https://frontend.${ENVIRONMENT}.demiurge.co"
    ["ganymede"]="https://ganymede.${ENVIRONMENT}.demiurge.co/jupyterlab"
    ["account"]="https://account.${ENVIRONMENT}.demiurge.co/user"
    ["gateway-1"]="https://gw-1-1.${ENVIRONMENT}.demiurge.co/collab/ping"
 #   ["storybook"]="https://sb.${ENVIRONMENT}.demiurge.co"
    ["jaeger"]="https://jaeger.${ENVIRONMENT}.demiurge.co"
)

# Function to check the status of a URL with a timeout of 2 seconds
check_service() {
    local name=$1
    local url=$2
    local status_code=$(curl -s -o /dev/null -w "%{http_code}" -m 2 "$url")
    if [ "$status_code" -eq 200 ]; then
        echo -e "\033[32m[UP]\033[0m $name ($url)"
    else
        echo -e "\033[31m[DOWN]\033[0m $name ($url) - Status: $status_code"
    fi
}

# Function to print system resource usage
print_resource_usage() {
    echo -e "\033[1;34mSystem Resource Monitoring\033[0m"
    echo "==========================="
    
    # CPU Usage with color
    CPU_PCT=$(mpstat | awk '$12 ~ /[0-9.]+/ { print 100 - $12 }')
    if (( $(echo "$CPU_PCT > 50" | bc -l) )); then
        echo -e "CPU Usage:      \033[31m${CPU_PCT}%\033[0m"
    else
        echo -e "CPU Usage:      \033[32m${CPU_PCT}%\033[0m"
    fi
    
    # Memory Usage with color
    MEM_INFO=$(free | awk '/Mem:/ {printf("%.1f %d", $3/$2 * 100, $2)}')
    MEM_PCT=$(echo $MEM_INFO | cut -d' ' -f1)
    MEM_TOTAL=$(echo $MEM_INFO | cut -d' ' -f2)
    MEM_GIB=$(echo "scale=1; $MEM_TOTAL/1024/1024" | bc)
    if (( $(echo "$MEM_PCT > 50" | bc -l) )); then
        echo -e "Memory Usage:   \033[31m${MEM_PCT}% of ${MEM_GIB} GiB\033[0m"
    else
        echo -e "Memory Usage:   \033[32m${MEM_PCT}% of ${MEM_GIB} GiB\033[0m"
    fi
    
    # Storage Usage with color
    STORAGE_INFO=$(df | awk '/\/$/ {print $5}' | sed 's/%//')
    STORAGE_TOTAL=$(df -h | awk '/\/$/ {print $2}')
    if (( $STORAGE_INFO > 50 )); then
        echo -e "Storage Usage:  \033[31m${STORAGE_INFO}% of ${STORAGE_TOTAL}\033[0m"
    else
        echo -e "Storage Usage:  \033[32m${STORAGE_INFO}% of ${STORAGE_TOTAL}\033[0m"
    fi
    
    echo
    echo -e "Logged in Users:"
    # Try sudo who, fall back to who if sudo isn't available
    if command -v sudo >/dev/null 2>&1; then
        sudo who
    else
        who
    fi
}

# Main check
echo -e "\033[1;34mService Monitoring Tool\033[0m"
echo "========================"
for service_name in "${!services[@]}"; do
    check_service "$service_name" "${services[$service_name]}"
done

echo
echo

print_resource_usage