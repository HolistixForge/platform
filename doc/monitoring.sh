#!/bin/bash

# exemple: $ watch -n 30 -c ./doc/monitoring.sh

ENVIRONMENT=dev-002

# List of services to monitor (URL and display name)
declare -A services=(
    ["Google"]="https://www.google.com"
    ["frontend"]="https://${ENVIRONMENT}.demiurge.co"
    ["frontend dev"]="https://frontend.${ENVIRONMENT}.demiurge.co"
    ["ganymede"]="https://ganymede.${ENVIRONMENT}.demiurge.co/jupyterlab"
    ["account"]="https://account.${ENVIRONMENT}.demiurge.co/user"
    ["gateway"]="https://gw-1-1.${ENVIRONMENT}.demiurge.co/collab/ping"
    ["storybook"]="https://sb.${ENVIRONMENT}.demiurge.co"
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
    echo -e "CPU Usage: $(mpstat | awk '$12 ~ /[0-9.]+/ { print 100 - $12 "%"}')"
    echo
    echo -e "Memory Usage:"
    free -h
    echo
    echo -e "Storage Usage: $(df -h | awk '/\/$/ { print $5 " of " $2 " used"}')"
    echo
    echo -e "Logged in Users:"
    sudo who
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