> ⚠️ Check app have **"generatePackageJson"** set to true, in the **build** target of [project.json](../../apps/ganymede/project.json), to be able to npm install dependancies during image build.

# build : ⚠️ DEPRECATED CONTENT

```powershell
# from workspace root
.\docker-images\ganymede\build.ps1
```

# push to demiurge registry

Retrieve an authentication token and authenticate your Docker client to your registry.

```powershell
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 218467379036.dkr.ecr.us-east-1.amazonaws.com
```

Tag your image so you can push the image to this repository, the tag must be a version.

```powershell
docker tag ganymede:latest 218467379036.dkr.ecr.us-east-1.amazonaws.com/ganymede:X.Y.Z
```

Run the following command to push this image to your newly created AWS repository

```powershell
docker push 218467379036.dkr.ecr.us-east-1.amazonaws.com/ganymede:X.Y.Z
```

# run

> ⚠️ **no reason to try to run the docker image outside k8s**. Content below is deprecated.

Run postgres and Ganymede container in the same docker network than minikube

```
# docker inspect --format='{{json .NetworkSettings.Networks}}' minikube

docker run --env=... -p ... --net=minikube -d image:tag
# or
docker network connect minikube <container-name>

docker network inspect minikube
```

Start container, replace ip in **--add-host** options with ip obtained from _`docker network inspect minikube`_

```
docker run \
    -p 4443:443 -p 8080:80 \
    --net=minikube \
    --add-host db-host:192.168.49.4 \
    --env-file=docker-images\ganymede\env-file.txt \
    --mount type=bind,source=$pwd/certs,target=/usr/app/certs \
    -i -t ganymede:latest
```
