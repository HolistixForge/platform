#!/bin/bash

: "${GW_INSTANCE_ID:?GW_INSTANCE_ID is not set}"
: "${GW_ID:?GW_ID is not set}"
: "${ENV_NAME:?ENV_NAME is not set}"
: "${DOMAIN_NAME:?DOMAIN_NAME is not set}"
: "${NFS_SERVER:?NFS_SERVER is not set}"
: "${GATEWAY_TOKEN:?GATEWAY_TOKEN is not set}"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "${HERE}/common.sh"

##

OPENVPN_PORT=$(get_vpn_port $GW_ID)
APP_COLLAB_PORT=$(get_app_port $GW_ID)

IMAGE_NAME=gateway
IMAGE_TAG=latest
SCRIPTS_DIR="/home/dev/workspace/plearnt/docker-images/backend-images/gateway/app"

docker run --rm -it --name "gw" \
    --privileged \
    \
    -e NFS_SERVER=${NFS_SERVER} \
    \
    -e ENV_NAME=${ENV_NAME} \
    -e GATEWAY_TOKEN=${GATEWAY_TOKEN} \
    -e OPENVPN_PORT=${OPENVPN_PORT} \
    -e APP_COLLAB_PORT=${APP_COLLAB_PORT} \
    -e SCRIPTS_DIR=${SCRIPTS_DIR} \
    \
    -p ${OPENVPN_PORT}:${OPENVPN_PORT}/udp \
    -p ${APP_COLLAB_PORT}:${APP_COLLAB_PORT} \
    \
    "${IMAGE_NAME}:${IMAGE_TAG}"
