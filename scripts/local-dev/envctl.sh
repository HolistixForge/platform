#!/bin/bash
# Environment controller - manage local development environments
# Usage: ./envctl.sh <command> [args...]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_DEV_DIR="/root/.local-dev"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m'
BOLD='\033[1m'

# Function to check if process is running
is_process_running() {
    local pid=$1
    if [ -z "$pid" ]; then
        return 1
    fi
    if kill -0 "$pid" 2>/dev/null; then
        return 0
    else
        return 1
    fi
}

# Function to get service PID
get_service_pid() {
    local env_name=$1
    local service=$2
    local pid_file="${LOCAL_DEV_DIR}/${env_name}/pids/${service}.pid"
    
    if [ -f "$pid_file" ]; then
        cat "$pid_file"
    else
        echo ""
    fi
}

# Function to validate environment exists
validate_env() {
    local env_name=$1
    if [ ! -d "${LOCAL_DEV_DIR}/${env_name}" ]; then
        echo -e "${RED}❌ Environment not found: ${env_name}${NC}"
        echo -e "${GRAY}   Available environments:${NC}"
        ls -1 "${LOCAL_DEV_DIR}" 2>/dev/null | sed 's/^/     /' || echo "     (none)"
        exit 1
    fi
}

# Function to start a service
start_service() {
    local env_name=$1
    local service=$2
    local env_dir="${LOCAL_DEV_DIR}/${env_name}"
    local pid_file="${env_dir}/pids/${service}.pid"
    local log_file="${env_dir}/logs/${service}.log"
    
    # Check if already running
    local existing_pid=$(get_service_pid "$env_name" "$service")
    if is_process_running "$existing_pid"; then
        echo -e "${YELLOW}⚠️  ${service} already running (PID: ${existing_pid})${NC}"
        return 0
    fi
    
    # Clean up stale PID file
    rm -f "$pid_file"
    
    # Load environment variables
    local env_file="${env_dir}/.env.${service}"
    if [ ! -f "$env_file" ]; then
        echo -e "${RED}❌ Config file not found: ${env_file}${NC}"
        return 1
    fi
    
    echo -e "${BLUE}▶️  Starting ${service}...${NC}"
    
    set -a
    source "$env_file"
    set +a
    
    # Build if needed (optional - user can build manually)
    if [ ! -f "${WORKSPACE}/dist/packages/app-${service}/main.js" ]; then
        echo -e "${YELLOW}   Building app-${service}...${NC}"
        cd "${WORKSPACE}"
        npx nx run "app-${service}:build" || {
            echo -e "${RED}❌ Build failed for app-${service}${NC}"
            return 1
        }
    fi
    
    # Start the service
    cd "${WORKSPACE}"
    node "${WORKSPACE}/dist/packages/app-${service}/main.js" \
        > "$log_file" 2>&1 &
    
    local pid=$!
    echo $pid > "$pid_file"
    
    # Wait a moment and verify it started
    sleep 1
    if is_process_running "$pid"; then
        echo -e "${GREEN}✅ ${service} started (PID: ${pid})${NC}"
        echo -e "${GRAY}   Logs: tail -f ${log_file}${NC}"
        return 0
    else
        echo -e "${RED}❌ ${service} failed to start${NC}"
        echo -e "${GRAY}   Check logs: tail ${log_file}${NC}"
        rm -f "$pid_file"
        return 1
    fi
}

# Function to stop a service
stop_service() {
    local env_name=$1
    local service=$2
    local env_dir="${LOCAL_DEV_DIR}/${env_name}"
    local pid_file="${env_dir}/pids/${service}.pid"
    
    local pid=$(get_service_pid "$env_name" "$service")
    
    if [ -z "$pid" ]; then
        echo -e "${GRAY}   ${service} not running${NC}"
        return 0
    fi
    
    if is_process_running "$pid"; then
        echo -e "${BLUE}🛑 Stopping ${service} (PID: ${pid})...${NC}"
        kill "$pid" 2>/dev/null || true
        
        # Wait up to 5 seconds for graceful shutdown
        local waited=0
        while is_process_running "$pid" && [ $waited -lt 5 ]; do
            sleep 1
            waited=$((waited + 1))
        done
        
        # Force kill if still running
        if is_process_running "$pid"; then
            echo -e "${YELLOW}   Force killing ${service}...${NC}"
            kill -9 "$pid" 2>/dev/null || true
        fi
        
        echo -e "${GREEN}✅ ${service} stopped${NC}"
    else
        echo -e "${GRAY}   ${service} not running (cleaning up stale PID)${NC}"
    fi
    
    rm -f "$pid_file"
}

# Function to restart a service
restart_service() {
    local env_name=$1
    local service=$2
    
    echo -e "${BLUE}🔄 Restarting ${service}...${NC}"
    stop_service "$env_name" "$service"
    sleep 1
    start_service "$env_name" "$service"
}

# Command: list
cmd_list() {
    "${SCRIPT_DIR}/envctl-monitor.sh" once
}

# Command: status
cmd_status() {
    local env_name=$1
    
    if [ -z "$env_name" ]; then
        cmd_list
        return
    fi
    
    validate_env "$env_name"
    "${SCRIPT_DIR}/envctl-monitor.sh" once
}

# Command: start
cmd_start() {
    local env_name=$1
    local service=$2
    
    if [ -z "$env_name" ]; then
        echo -e "${RED}Usage: $0 start <env-name> [service]${NC}"
        echo -e "${GRAY}   service: ganymede, gateway, or both (default)${NC}"
        exit 1
    fi
    
    validate_env "$env_name"
    
    case "$service" in
        ganymede)
            start_service "$env_name" "ganymede"
            ;;
        gateway)
            start_service "$env_name" "gateway"
            ;;
        both|"")
            start_service "$env_name" "ganymede"
            sleep 2  # Wait for ganymede to fully start
            start_service "$env_name" "gateway"
            ;;
        *)
            echo -e "${RED}Unknown service: ${service}${NC}"
            echo -e "${GRAY}Valid services: ganymede, gateway, both${NC}"
            exit 1
            ;;
    esac
    
    echo ""
    echo -e "${GREEN}🎉 Environment started: ${env_name}${NC}"
    echo -e "${CYAN}   Frontend:  https://${env_name}.local${NC}"
    echo -e "${CYAN}   Ganymede:  https://ganymede.${env_name}.local${NC}"
    echo -e "${CYAN}   Gateway:   https://gateway.${env_name}.local${NC}"
}

# Command: stop
cmd_stop() {
    local env_name=$1
    local service=$2
    
    if [ -z "$env_name" ]; then
        echo -e "${RED}Usage: $0 stop <env-name> [service]${NC}"
        echo -e "${GRAY}   service: ganymede, gateway, or both (default)${NC}"
        exit 1
    fi
    
    validate_env "$env_name"
    
    echo -e "${BLUE}🛑 Stopping environment: ${env_name}${NC}"
    
    case "$service" in
        ganymede)
            stop_service "$env_name" "ganymede"
            ;;
        gateway)
            stop_service "$env_name" "gateway"
            ;;
        both|"")
            stop_service "$env_name" "gateway"
            stop_service "$env_name" "ganymede"
            ;;
        *)
            echo -e "${RED}Unknown service: ${service}${NC}"
            echo -e "${GRAY}Valid services: ganymede, gateway, both${NC}"
            exit 1
            ;;
    esac
    
    echo -e "${GREEN}✅ Environment stopped: ${env_name}${NC}"
}

# Command: restart
cmd_restart() {
    local env_name=$1
    local service=$2
    
    if [ -z "$env_name" ]; then
        echo -e "${RED}Usage: $0 restart <env-name> [service]${NC}"
        echo -e "${GRAY}   service: ganymede, gateway, or both (default)${NC}"
        exit 1
    fi
    
    validate_env "$env_name"
    
    echo -e "${BLUE}🔄 Restarting environment: ${env_name}${NC}"
    
    case "$service" in
        ganymede)
            restart_service "$env_name" "ganymede"
            ;;
        gateway)
            restart_service "$env_name" "gateway"
            ;;
        both|"")
            restart_service "$env_name" "ganymede"
            sleep 2
            restart_service "$env_name" "gateway"
            ;;
        *)
            echo -e "${RED}Unknown service: ${service}${NC}"
            echo -e "${GRAY}Valid services: ganymede, gateway, both${NC}"
            exit 1
            ;;
    esac
    
    echo -e "${GREEN}✅ Environment restarted: ${env_name}${NC}"
}

# Command: logs
cmd_logs() {
    local env_name=$1
    local service=$2
    local follow=${3:-false}
    
    if [ -z "$env_name" ] || [ -z "$service" ]; then
        echo -e "${RED}Usage: $0 logs <env-name> <service> [--follow]${NC}"
        echo -e "${GRAY}   service: ganymede or gateway${NC}"
        exit 1
    fi
    
    validate_env "$env_name"
    
    local log_file="${LOCAL_DEV_DIR}/${env_name}/logs/${service}.log"
    
    if [ ! -f "$log_file" ]; then
        echo -e "${YELLOW}⚠️  Log file not found: ${log_file}${NC}"
        exit 1
    fi
    
    if [ "$follow" = "--follow" ] || [ "$follow" = "-f" ]; then
        echo -e "${BLUE}📊 Following logs for ${env_name}/${service}...${NC}"
        echo -e "${GRAY}   Press Ctrl+C to stop${NC}"
        echo ""
        tail -f "$log_file"
    else
        tail -n 50 "$log_file"
    fi
}

# Command: monitor
cmd_monitor() {
    exec "${SCRIPT_DIR}/envctl-monitor.sh" watch
}

# Command: build
cmd_build() {
    local env_name=$1
    local target=${2:-all}
    
    if [ -z "$env_name" ]; then
        echo -e "${RED}Usage: $0 build <env-name> [target]${NC}"
        echo -e "${GRAY}   target: ganymede, gateway, frontend, or all (default)${NC}"
        exit 1
    fi
    
    validate_env "$env_name"
    
    local env_dir="${LOCAL_DEV_DIR}/${env_name}"
    local env_file="${env_dir}/.env.ganymede"
    
    # Load WORKSPACE path from env
    set -a
    source "$env_file"
    set +a
    
    cd "${WORKSPACE}"
    
    case "$target" in
        ganymede)
            echo -e "${BLUE}🔨 Building app-ganymede...${NC}"
            npx nx run app-ganymede:build
            ;;
        gateway)
            echo -e "${BLUE}🔨 Building app-collab (gateway)...${NC}"
            npx nx run app-collab:build
            ;;
        frontend)
            echo -e "${BLUE}🔨 Building frontend...${NC}"
            "${SCRIPT_DIR}/build-frontend.sh" "$env_name" "${WORKSPACE}"
            ;;
        all)
            echo -e "${BLUE}🔨 Building all apps...${NC}"
            npx nx run app-ganymede:build
            npx nx run app-collab:build
            "${SCRIPT_DIR}/build-frontend.sh" "$env_name" "${WORKSPACE}"
            ;;
        *)
            echo -e "${RED}Unknown build target: ${target}${NC}"
            echo -e "${GRAY}Valid targets: ganymede, gateway, frontend, all${NC}"
            exit 1
            ;;
    esac
    
    echo -e "${GREEN}✅ Build complete${NC}"
}

# Command: help
cmd_help() {
    echo -e "${BOLD}Demiurge Environment Controller${NC}"
    echo ""
    echo -e "${BOLD}Usage:${NC}"
    echo "  $0 <command> [args...]"
    echo ""
    echo -e "${BOLD}Commands:${NC}"
    echo -e "  ${GREEN}list, ls${NC}                    List all environments"
    echo -e "  ${GREEN}status [env]${NC}                Show status (all or specific env)"
    echo -e "  ${GREEN}monitor${NC}                     Live monitoring (updates every 2s)"
    echo ""
    echo -e "  ${GREEN}start <env> [service]${NC}       Start environment (both/ganymede/gateway)"
    echo -e "  ${GREEN}stop <env> [service]${NC}        Stop environment"
    echo -e "  ${GREEN}restart <env> [service]${NC}     Restart environment"
    echo ""
    echo -e "  ${GREEN}logs <env> <service> [-f]${NC}   View logs (use -f to follow)"
    echo -e "  ${GREEN}build <env> [target]${NC}        Build apps (all/ganymede/gateway/frontend)"
    echo ""
    echo -e "  ${GREEN}help${NC}                        Show this help"
    echo ""
    echo -e "${BOLD}Examples:${NC}"
    echo "  $0 list"
    echo "  $0 start dev-001"
    echo "  $0 start dev-001 ganymede"
    echo "  $0 stop dev-001"
    echo "  $0 restart dev-001 gateway"
    echo "  $0 logs dev-001 ganymede -f"
    echo "  $0 build dev-001"
    echo "  $0 monitor"
    echo ""
    echo -e "${BOLD}Environment Directory:${NC}"
    echo -e "  ${GRAY}${LOCAL_DEV_DIR}${NC}"
    echo ""
    echo -e "${BOLD}Available Scripts:${NC}"
    echo -e "  ${GRAY}./envctl.sh              ${NC}- Main controller (this script)"
    echo -e "  ${GRAY}./envctl-monitor.sh      ${NC}- Standalone monitoring"
    echo -e "  ${GRAY}./create-env.sh          ${NC}- Create new environment"
    echo -e "  ${GRAY}./delete-env.sh          ${NC}- Delete environment"
    echo -e "  ${GRAY}./build-frontend.sh      ${NC}- Build frontend"
    echo ""
}

# Main command dispatcher
COMMAND=${1:-help}
shift || true

case "$COMMAND" in
    list|ls)
        cmd_list "$@"
        ;;
    status|st)
        cmd_status "$@"
        ;;
    start)
        cmd_start "$@"
        ;;
    stop)
        cmd_stop "$@"
        ;;
    restart)
        cmd_restart "$@"
        ;;
    logs|log)
        cmd_logs "$@"
        ;;
    monitor|mon)
        cmd_monitor "$@"
        ;;
    build)
        cmd_build "$@"
        ;;
    help|--help|-h)
        cmd_help
        ;;
    *)
        echo -e "${RED}Unknown command: ${COMMAND}${NC}"
        echo ""
        cmd_help
        exit 1
        ;;
esac

