#!/bin/bash

set -e

. mount-workspace.sh

serve_nx_app() {
    npx nx serve $1 >/tmp/$1.log 2>&1 &
}

main() {
    
    dev_mount_workspace
    dev_bind_nx_dirs

    cd $PLEARNT 
    # git config --global --add safe.directory $PLEARNT

    if [[ -n "${SERVE_NX_APP}" ]]; then
        APP="${SERVE_NX_APP}"
    else
        HN=$(hostname)
        if [[ "${HN}" == account* ]]; then
            APP="app-account"
        elif [[ "${HN}" == ganymede* ]]; then
            APP="app-ganymede"
        else
            echo "No app is set to run"
            exit 0
        fi
    fi

    if [[ -n "${APP}" ]]; then 
        serve_nx_app "${APP}"
        tail -n 1000 -f /tmp/${APP}.log
    fi
}

main
