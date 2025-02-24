#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to log with timestamp
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}
# Function to kill a specific service
kill_service() {
    local service=$1
    PGIDS=$(ps ax -o "pgid,cmd" | grep "[n]ode .*${service}/main.js" | awk '{print $1}')
    echo "$PGIDS" | while read PGID; do
        if ! [ -z "${PGID}" ]; then
            kill -TERM -- -"${PGID}"
        fi
    done
}

# Function to kill running services
kill_services() {
    log "Stopping all services..."
    
    # Kill all services
    kill_service "app-account"
    kill_service "app-ganymede"
}

# Function to build all packages
build_all() {
    log "Building all packages..."
    npx nx run-many -t build || {
        echo -e "${RED}Build failed${NC}"
        return 1
    }
}

# Function to deploy frontend
deploy_frontend() {
    log "Deploying frontend..."
    sudo rm -rf /var/www/app-frontend \
        && sudo cp -ra packages/app-frontend/dist /var/www/app-frontend \
        && sudo chown -R www-data /var/www/app-frontend
}


function __go__() {
    local name=$1
    local env_file="packages/${name}/.env"
    set -a
    . $env_file
    set +a
    node dist/packages/${name}/main.js >> /tmp/${name}.log 2>&1
}
export -f __go__

# Function to start a service
start_service() {
    local name=$1
    log "Starting $name..."
    # Use setsid to create a new session, preventing the process from being killed when script exits
    nohup setsid bash -c "__go__ ${name}" </dev/null >/dev/null 2>&1 &
}

# Function to start all services
start_all_services() {
    # Start backend services
    start_service "app-account" "node dist/packages/app-account/main.js"
    start_service "app-ganymede" "node dist/packages/app-ganymede/main.js"
    date > ./restart-app-inotify
    # Deploy frontend
    deploy_frontend
}

# Function to display menu
display_menu() {
    echo -e "\n${GREEN}Development Services Control${NC}"
    echo "1) Build all and restart services"
    echo "2) Build all (without restart)"
    echo "3) Deploy frontend only"
    echo "4) Start services (without build)"
    echo "5) Stop all services"
    echo "q) Quit"
    echo -n "Enter your choice: "
}

# Start monitoring in background
(while true; do 
    clear
    ./tools/monitoring.sh
    display_menu
    sleep 10
done) &
MONITOR_PID=$!

# Cleanup function
cleanup() {
    kill $MONITOR_PID 2>/dev/null
    exit
}

# Update trap to include monitoring cleanup
trap cleanup INT

# Main loop
while true; do
    read -r choice
    
    case $choice in
        1)
            kill_services
            build_all && start_all_services
            ;;
        2)
            build_all
            ;;
        3)
            deploy_frontend
            ;;
        4)
            kill_services
            start_all_services
            ;;
        5)
            kill_services
            ;;
        q|Q)
            cleanup
            ;;
        *)
            echo -e "${RED}Invalid choice${NC}"
            ;;
    esac
done

