#!/bin/sh

. /usr/local/bin/demiurge-functions.sh

# Start VPN + watchdog loop in background
sh -c '. /usr/local/bin/demiurge-functions.sh && vpn_loop' &

# Start ttyd web terminal on port 7681 (default ttyd port)
sh -c 'ttyd -p 7681 /bin/bash' &

# Map terminal service to gateway (gateway routes uc-{uuid}.org-{uuid}.domain.local directly to VPN IP:7681)
sh -c '. /usr/local/bin/demiurge-functions.sh && map_http_service terminal 7681' &

# Keep container running
tail -f /dev/null