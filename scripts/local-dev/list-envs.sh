#!/bin/bash
# List all local development environments

echo "📋 Local development environments:"
echo ""

if [ ! -d "/root/.local-dev" ]; then
  echo "   No environments found."
  echo ""
  echo "   Create one with: ./create-env.sh dev-001"
  exit 0
fi

for env_dir in /root/.local-dev/*/; do
  if [ -d "$env_dir" ]; then
    env_name=$(basename "$env_dir")
    
    # Check if Ganymede is running
    ganymede_status="⚫"
    if [ -f "${env_dir}/ganymede.pid" ] && kill -0 $(cat "${env_dir}/ganymede.pid") 2>/dev/null; then
      ganymede_status="🟢"
    fi
    
    # Check if Gateway is running
    gateway_status="⚫"
    if [ -f "${env_dir}/gateway.pid" ] && kill -0 $(cat "${env_dir}/gateway.pid") 2>/dev/null; then
      gateway_status="🟢"
    fi
    
    # Overall status
    if [ "$ganymede_status" == "🟢" ] && [ "$gateway_status" == "🟢" ]; then
      status="🟢 RUNNING"
    elif [ "$ganymede_status" == "🟢" ] || [ "$gateway_status" == "🟢" ]; then
      status="🟡 PARTIAL"
    else
      status="⚫ STOPPED"
    fi
    
    echo "  ${status}  ${env_name}"
    echo "           https://${env_name}.local"
    echo "           Ganymede: ${ganymede_status}  Gateway: ${gateway_status}"
    echo ""
  fi
done

echo "💡 Manage environments:"
echo "   Start:  /root/.local-dev/<env-name>/start.sh"
echo "   Stop:   /root/.local-dev/<env-name>/stop.sh"
echo "   Logs:   /root/.local-dev/<env-name>/logs.sh {ganymede|gateway}"
echo "   Delete: ./delete-env.sh <env-name>"
echo ""

