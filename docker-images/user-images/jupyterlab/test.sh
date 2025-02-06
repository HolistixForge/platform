
docker run \
    --rm \
    --name demiurge_yyyyyyyyyy \
    -e SETTINGS=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX \
    --cap-add=NET_ADMIN \
    --device /dev/net/tun \
    --publish 8888:8888 \
    demiurge-jupyterlab-minimal-notebook:lab-4.2.0
