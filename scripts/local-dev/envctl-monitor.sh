#!/bin/bash
# Environment monitoring script - no screen flicker
# Usage: ./envctl-monitor.sh [watch]

set -e

LOCAL_DEV_DIR="/root/.local-dev"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Status icons
ICON_RUNNING="🟢"
ICON_STOPPED="🔴"
ICON_PARTIAL="🟡"
ICON_UNKNOWN="⚪"

# Function to check if a process is running
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

# Function to get process uptime
get_process_uptime() {
    local pid=$1
    if [ -z "$pid" ] || ! kill -0 "$pid" 2>/dev/null; then
        echo "-"
        return
    fi
    
    # Get process start time in seconds since epoch
    local start_time=$(ps -p "$pid" -o lstart= | xargs -I {} date -d "{}" +%s 2>/dev/null || echo "0")
    if [ "$start_time" = "0" ]; then
        echo "-"
        return
    fi
    
    local current_time=$(date +%s)
    local uptime_seconds=$((current_time - start_time))
    
    # Format uptime
    local days=$((uptime_seconds / 86400))
    local hours=$(((uptime_seconds % 86400) / 3600))
    local minutes=$(((uptime_seconds % 3600) / 60))
    
    if [ $days -gt 0 ]; then
        echo "${days}d ${hours}h"
    elif [ $hours -gt 0 ]; then
        echo "${hours}h ${minutes}m"
    else
        echo "${minutes}m"
    fi
}

# Function to get process memory usage (RSS in MB)
get_process_memory() {
    local pid=$1
    if [ -z "$pid" ] || ! kill -0 "$pid" 2>/dev/null; then
        echo "-"
        return
    fi
    
    local mem_kb=$(ps -p "$pid" -o rss= 2>/dev/null | tr -d ' ' || echo "0")
    if [ "$mem_kb" = "0" ]; then
        echo "-"
        return
    fi
    
    local mem_mb=$((mem_kb / 1024))
    echo "${mem_mb} MB"
}

# Function to get process CPU usage
get_process_cpu() {
    local pid=$1
    if [ -z "$pid" ] || ! kill -0 "$pid" 2>/dev/null; then
        echo "-"
        return
    fi
    
    local cpu=$(ps -p "$pid" -o %cpu= 2>/dev/null | tr -d ' ' || echo "0.0")
    echo "${cpu}%"
}

# Function to get service status
get_service_status() {
    local env_dir=$1
    local service=$2
    
    local pid_file="${env_dir}/pids/${service}.pid"
    
    if [ ! -f "$pid_file" ]; then
        echo "stopped::"
        return
    fi
    
    local pid=$(cat "$pid_file" 2>/dev/null || echo "")
    
    if is_process_running "$pid"; then
        local uptime=$(get_process_uptime "$pid")
        local memory=$(get_process_memory "$pid")
        local cpu=$(get_process_cpu "$pid")
        echo "running:${pid}:${uptime}:${memory}:${cpu}"
    else
        echo "crashed:${pid}::"
        # Clean up stale PID file
        rm -f "$pid_file"
    fi
}

# Function to get environment status
get_env_status() {
    local env_name=$1
    local env_dir="${LOCAL_DEV_DIR}/${env_name}"
    
    if [ ! -d "$env_dir" ]; then
        echo "missing"
        return
    fi
    
    local ganymede_status=$(get_service_status "$env_dir" "ganymede" | cut -d: -f1)
    local gateway_status=$(get_service_status "$env_dir" "gateway" | cut -d: -f1)
    
    if [ "$ganymede_status" = "running" ] && [ "$gateway_status" = "running" ]; then
        echo "running"
    elif [ "$ganymede_status" = "stopped" ] && [ "$gateway_status" = "stopped" ]; then
        echo "stopped"
    else
        echo "partial"
    fi
}

# Function to get port from env file
get_port() {
    local env_file=$1
    local port=$(grep "^PORT=" "$env_file" 2>/dev/null | cut -d= -f2 | tr -d '"' | tr -d "'" || echo "-")
    # Handle port in SERVER_BIND JSON if PORT not found
    if [ "$port" = "-" ]; then
        port=$(grep "SERVER_BIND\|GANYMEDE_SERVER_BIND" "$env_file" 2>/dev/null | grep -oP '"port":\s*\K\d+' | head -1 || echo "-")
    fi
    echo "$port"
}

# Function to print system resources
print_system_resources() {
    echo -e "${BOLD}┌── System Resources ──────────────────────────────────────────┐${NC}"
    
    # CPU Usage
    local cpu_pct=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
    if [ -z "$cpu_pct" ]; then
        cpu_pct=$(mpstat 1 1 | awk '$12 ~ /[0-9.]+/ { print 100 - $12 }' | tail -1)
    fi
    local cpu_color=$GREEN
    if (( $(echo "$cpu_pct > 50" | bc -l 2>/dev/null || echo "0") )); then
        cpu_color=$YELLOW
    fi
    if (( $(echo "$cpu_pct > 80" | bc -l 2>/dev/null || echo "0") )); then
        cpu_color=$RED
    fi
    
    # Memory Usage
    local mem_info=$(free | awk '/Mem:/ {printf("%.1f %.0f", $3/$2 * 100, $2/1024/1024)}')
    local mem_pct=$(echo $mem_info | cut -d' ' -f1)
    local mem_total=$(echo $mem_info | cut -d' ' -f2)
    local mem_color=$GREEN
    if (( $(echo "$mem_pct > 50" | bc -l 2>/dev/null || echo "0") )); then
        mem_color=$YELLOW
    fi
    if (( $(echo "$mem_pct > 80" | bc -l 2>/dev/null || echo "0") )); then
        mem_color=$RED
    fi
    
    # Disk Usage
    local disk_pct=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    local disk_total=$(df -h / | awk 'NR==2 {print $2}')
    local disk_color=$GREEN
    if (( $disk_pct > 50 )); then
        disk_color=$YELLOW
    fi
    if (( $disk_pct > 80 )); then
        disk_color=$RED
    fi
    
    # Load Average
    local load_avg=$(uptime | awk -F'load average:' '{print $2}' | xargs)
    
    printf "│ ${BOLD}CPU:${NC}  ${cpu_color}%-6.1f%%${NC}  │  ${BOLD}Memory:${NC} ${mem_color}%-6.1f%%${NC} of %.1f GiB  │  ${BOLD}Disk:${NC} ${disk_color}%-3s%%${NC} of %s\n" \
        "$cpu_pct" "$mem_pct" "$mem_total" "$disk_pct" "$disk_total" | sed 's/^/│ /; s/$/ │/'
    
    echo -e "│ ${BOLD}Load Average:${NC} ${load_avg}                                              " | head -c 64 | sed 's/$/│/'
    echo -e "\n${BOLD}└──────────────────────────────────────────────────────────────┘${NC}"
}

# Function to print environment details
print_env_details() {
    local env_name=$1
    local env_dir="${LOCAL_DEV_DIR}/${env_name}"
    
    if [ ! -d "$env_dir" ]; then
        echo -e "${RED}Environment not found: ${env_name}${NC}"
        return
    fi
    
    local env_status=$(get_env_status "$env_name")
    local status_icon=$ICON_UNKNOWN
    local status_color=$GRAY
    
    case "$env_status" in
        running)
            status_icon=$ICON_RUNNING
            status_color=$GREEN
            ;;
        stopped)
            status_icon=$ICON_STOPPED
            status_color=$RED
            ;;
        partial)
            status_icon=$ICON_PARTIAL
            status_color=$YELLOW
            ;;
    esac
    
    echo -e "${BOLD}┌── Environment: ${env_name} ${status_icon} ${status_color}${env_status}${NC}${BOLD} ────────────────────┐${NC}"
    
    # Get service details
    local ganymede_info=$(get_service_status "$env_dir" "ganymede")
    local gateway_info=$(get_service_status "$env_dir" "gateway")
    
    local g_status=$(echo "$ganymede_info" | cut -d: -f1)
    local g_pid=$(echo "$ganymede_info" | cut -d: -f2)
    local g_uptime=$(echo "$ganymede_info" | cut -d: -f3)
    local g_memory=$(echo "$ganymede_info" | cut -d: -f4)
    local g_cpu=$(echo "$ganymede_info" | cut -d: -f5)
    
    local gw_status=$(echo "$gateway_info" | cut -d: -f1)
    local gw_pid=$(echo "$gateway_info" | cut -d: -f2)
    local gw_uptime=$(echo "$gateway_info" | cut -d: -f3)
    local gw_memory=$(echo "$gateway_info" | cut -d: -f4)
    local gw_cpu=$(echo "$gateway_info" | cut -d: -f5)
    
    # Get ports
    local g_port=$(get_port "${env_dir}/.env.ganymede")
    local gw_port=$(get_port "${env_dir}/.env.gateway")
    
    # Table header
    echo -e "│ ${BOLD}Service ${NC}  │ ${BOLD}Status${NC} │  ${BOLD}PID${NC}  │ ${BOLD}Uptime${NC} │ ${BOLD}Memory${NC}  │ ${BOLD}CPU${NC}  │ ${BOLD}Port${NC} │"
    echo -e "├──────────┼────────┼──────┼────────┼─────────┼──────┼──────┤"
    
    # Ganymede row
    local g_status_icon=$ICON_STOPPED
    local g_status_color=$RED
    if [ "$g_status" = "running" ]; then
        g_status_icon=$ICON_RUNNING
        g_status_color=$GREEN
    fi
    printf "│ %-9s│ %s ${g_status_color}%-6s${NC} │ %-5s│ %-7s│ %-8s│ %-5s│ %-5s│\n" \
        "Ganymede" "$g_status_icon" "$g_status" "${g_pid:--}" "${g_uptime:--}" "${g_memory:--}" "${g_cpu:--}" "$g_port"
    
    # Gateway row
    local gw_status_icon=$ICON_STOPPED
    local gw_status_color=$RED
    if [ "$gw_status" = "running" ]; then
        gw_status_icon=$ICON_RUNNING
        gw_status_color=$GREEN
    fi
    printf "│ %-9s│ %s ${gw_status_color}%-6s${NC} │ %-5s│ %-7s│ %-8s│ %-5s│ %-5s│\n" \
        "Gateway" "$gw_status_icon" "$gw_status" "${gw_pid:--}" "${gw_uptime:--}" "${gw_memory:--}" "${gw_cpu:--}" "$gw_port"
    
    echo -e "${BOLD}└──────────────────────────────────────────────────────────────┘${NC}"
}

# Function to list all environments
list_environments() {
    echo -e "${BOLD}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}║  Demiurge Local Development Environments                       ║${NC}"
    echo -e "${BOLD}║  $(date '+%Y-%m-%d %H:%M:%S')                                           ║${NC}"
    echo -e "${BOLD}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    if [ ! -d "$LOCAL_DEV_DIR" ]; then
        echo -e "${YELLOW}No environments directory found: ${LOCAL_DEV_DIR}${NC}"
        echo -e "${GRAY}Run ./create-env.sh <name> to create an environment${NC}"
        return
    fi
    
    local env_count=0
    local running_count=0
    
    echo -e "${BOLD}┌── Environments ──────────────────────────────────────────────┐${NC}"
    echo -e "│ ${BOLD}Name${NC}      │ ${BOLD}Status${NC}   │ ${BOLD}Ganymede${NC} │ ${BOLD}Gateway${NC}  │ ${BOLD}Ports${NC}         │"
    echo -e "├───────────┼──────────┼──────────┼──────────┼───────────────┤"
    
    for env_dir in "$LOCAL_DEV_DIR"/*/; do
        if [ ! -d "$env_dir" ]; then
            continue
        fi
        
        local env_name=$(basename "$env_dir")
        env_count=$((env_count + 1))
        
        local env_status=$(get_env_status "$env_name")
        local ganymede_info=$(get_service_status "$env_dir" "ganymede")
        local gateway_info=$(get_service_status "$env_dir" "gateway")
        
        local g_status=$(echo "$ganymede_info" | cut -d: -f1)
        local gw_status=$(echo "$gateway_info" | cut -d: -f1)
        
        # Status icon
        local status_icon=$ICON_UNKNOWN
        local status_color=$GRAY
        case "$env_status" in
            running)
                status_icon=$ICON_RUNNING
                status_color=$GREEN
                running_count=$((running_count + 1))
                ;;
            stopped)
                status_icon=$ICON_STOPPED
                status_color=$RED
                ;;
            partial)
                status_icon=$ICON_PARTIAL
                status_color=$YELLOW
                ;;
        esac
        
        # Service icons
        local g_icon=$ICON_STOPPED
        [ "$g_status" = "running" ] && g_icon=$ICON_RUNNING
        
        local gw_icon=$ICON_STOPPED
        [ "$gw_status" = "running" ] && gw_icon=$ICON_RUNNING
        
        # Get ports
        local g_port=$(get_port "${env_dir}/.env.ganymede")
        local gw_port=$(get_port "${env_dir}/.env.gateway")
        local ports="${g_port}/${gw_port}"
        
        printf "│ %-10s│ %s ${status_color}%-8s${NC} │ %s %-7s│ %s %-7s│ %-14s│\n" \
            "$env_name" "$status_icon" "$env_status" "$g_icon" "$g_status" "$gw_icon" "$gw_status" "$ports"
    done
    
    if [ $env_count -eq 0 ]; then
        echo -e "│ ${GRAY}No environments found${NC}                                         │"
    fi
    
    echo -e "${BOLD}└──────────────────────────────────────────────────────────────┘${NC}"
    echo -e "${GRAY}Total: ${env_count} environments (${running_count} running)${NC}"
    echo ""
}

# Main display
display_status() {
    list_environments
    echo ""
    print_system_resources
    echo ""
    
    # Show details for running environments
    for env_dir in "$LOCAL_DEV_DIR"/*/; do
        if [ ! -d "$env_dir" ]; then
            continue
        fi
        
        local env_name=$(basename "$env_dir")
        local env_status=$(get_env_status "$env_name")
        
        if [ "$env_status" = "running" ] || [ "$env_status" = "partial" ]; then
            print_env_details "$env_name"
            echo ""
        fi
    done
}

# Main
MODE=${1:-once}

case "$MODE" in
    watch)
        # Watch mode - update every 2 seconds without clearing screen
        while true; do
            tput clear
            display_status
            sleep 2
        done
        ;;
    once|*)
        display_status
        ;;
esac

