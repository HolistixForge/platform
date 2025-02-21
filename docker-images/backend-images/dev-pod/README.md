# build

```shell
IMAGE_NAME="dev-pod"
IMAGE_TAG="24.04"
docker build -f ./Dockerfile -t "${IMAGE_NAME}:${IMAGE_TAG}" .
```

# test

```shell
docker run --rm -it --name "test-dev-pod" \
    --privileged \
    --add-host=host.docker.internal:host-gateway \
    -e NFS_SERVER=host.docker.internal \
    -e SERVE_NX_APP=app-collab \
    "${IMAGE_NAME}:${IMAGE_TAG}"
```

# tag

```shell
docker tag ${IMAGE_NAME}:${IMAGE_TAG} ${IMAGE_NAME}:latest
```

# clean

```shell
docker images --filter "dangling=true" -q | xargs docker rmi -f
```
