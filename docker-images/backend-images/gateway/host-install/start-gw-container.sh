#!/bin/bash

: "${GW_INSTANCE_ID:?GW_INSTANCE_ID is not set}"
: "${GW_ID:?GW_ID is not set}"
: "${ENV_NAME:?ENV_NAME is not set}"
: "${DOMAIN_NAME:?DOMAIN_NAME is not set}"
: "${GATEWAY_TOKEN:?GATEWAY_TOKEN is not set}"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "${HERE}/common.sh"

##

OPENVPN_PORT=$(get_vpn_port $GW_ID)
APP_GATEWAY_PORT=$(get_app_port $GW_ID)

GATEWAY_FQDN=gw-${GW_INSTANCE_ID}-${GW_ID}.${ENV_NAME}.${DOMAIN_NAME}

IMAGE_NAME=gateway
IMAGE_TAG=latest
GATEWAY_SCRIPTS_DIR="/home/dev/workspace/monorepo/docker-images/backend-images/gateway/app"

# Base docker run command
DOCKER_CMD="docker run --rm -it --name gw-${GW_INSTANCE_ID}-${GW_ID} --privileged"

# Add volume mount or NFS server env var based on what's defined
if [ -n "${WORKSPACE}" ]; then
    DOCKER_CMD+=" \
    -v ${WORKSPACE}:/home/dev/workspace:rw"
elif [ -n "${NFS_SERVER}" ]; then
    DOCKER_CMD+=" \
    -e NFS_SERVER=${NFS_SERVER}"
else
    echo "Error: Either WORKSPACE or NFS_SERVER must be defined"
    exit 1
fi

# Complete the docker run command
DOCKER_CMD+=" \
    -e ENV_NAME=${ENV_NAME} \
    -e DOMAIN_NAME=${DOMAIN_NAME} \
    -e GATEWAY_TOKEN=${GATEWAY_TOKEN} \
    -e GATEWAY_FQDN=${GATEWAY_FQDN} \
    -e OPENVPN_PORT=${OPENVPN_PORT} \
    -e APP_GATEWAY_PORT=${APP_GATEWAY_PORT} \
    -e GATEWAY_SCRIPTS_DIR=${GATEWAY_SCRIPTS_DIR} \
    \
    -p ${OPENVPN_PORT}:${OPENVPN_PORT}/udp \
    -p ${APP_GATEWAY_PORT}:${APP_GATEWAY_PORT} \
    \
    \"${IMAGE_NAME}:${IMAGE_TAG}\""

# Execute the docker run command
eval "${DOCKER_CMD}"
