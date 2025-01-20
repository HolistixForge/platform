# Development setup summary

We deploy minikube on an Ubuntu VM on AWS.
Then we access and edit source code over ssh.

## install

## Aws instance

In AWS, setup an Ubuntu Instance, **Ubuntu server 24.04 LTS 64 bits x86 (t2.xlarge)** with **16 GB** disk

create or reuse an IAM role 'ganymede-aws-api' for this instance to run with.

add the following permission on this role

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:RunInstances",
        "ec2:StartInstances",
        "ec2:StopInstances",
        "ec2:TerminateInstances",
        "ec2:DescribeInstances",
        "ec2:CreateTags"
      ],
      "Resource": "*"
    }
  ]
}
```

Ganymede app will later use this permission to start and manage demiurge users servers launched in cloud.
Because Ganymede app will run in a minikube pod itself running in a docker container, in order for Ganymede
App to access this grant through AWS IMDS api, we need to configure the instance metadata to allow 3 "hop".

```shell
$ aws ec2 modify-instance-metadata-options \
    --instance-id i-04b1f5f6f716b0af0 \
    --http-put-response-hop-limit 3 \
    --http-endpoint enabled
```

now the following command will be successfull from Ganymede app pod (try it later after helm chart deployment)

```shell
$  aws ec2 describe-instances --query "Reservations[*].Instances[*].[InstanceId,State.Name]" --output table
```

## Clone repo

in the instance:

- setup your github ssh key,
- clone [plearnt repo](https://github.com/FL-AntoineDurand/plearnt) in a "workspace" folder
- run `$ npm install` in plearnt repo

## Install NodeJs

install recent nodejs.
see [dev-pod Dockerfile](../docker-images/backend-images/dev-pod/Dockerfile) as an example

## Install Kubernetes tools

- install [minikube](https://minikube.sigs.k8s.io/docs/start/)
- install [corresponding kubectl version](https://kubernetes.io/docs/tasks/tools/install-kubectl-linux/)
- install [docker](https://docs.docker.com/engine/install/ubuntu/)
- install [helm](https://github.com/helm/helm/releases)
- add user to "docker" group: `$ sudo usermod -aG docker $USER && newgrp docker`
- `$ minikube start`
- install minikube ingress addon : `$ minikube addons enable ingress`

  Enable **use-forwarded-headers** nginx option

  ```shell
  $ kubectl edit configmap ingress-nginx-controller -n ingress-nginx
  ```

  add **use-forwarded-headers: "true"**

  ```
  apiVersion: v1
  data:
      hsts: "false"
      use-forwarded-headers: "true"
  kind: ConfigMap
  ...
  ```

  Then apply configuration

  ```shell
  $ kubectl rollout restart deployment ingress-nginx-controller -n ingress-nginx
  ```

  This is needed so that X-Forwarded-Proto is set to https, so that we can send secure cookie from services.

- install minikube metrics-server addon : `$ minikube addons enable metrics-server`
- install k9s : `$ snap install k9s --devmode` (then alias "k9s" to the binary in /snap/...)
- setup kubectl to work on minikube cluster

## Build dev-pod docker image

Build dev-pod docker image. see [README](../docker-images/backend-images/dev-pod/README.md).

## Install NFS server

We will serve the same repo over NFS to the different service's pods. Install nfs server

`$ sudo apt-get install nfs-server`

(mkdir, chown nobody:nogroup, etc/exports, exportfs -a)

⚠️ NOT SURE NEEDED : add user to "nogroup" group: `sudo usermod -a -G nogroup $USER && newgrp nogroup` (to have permission to edit workspace)

## Deploy helm chart

- clone [helm chart repo](https://github.com/DemiurgeGalaxie/helm)
- create kebernetes secrets as described in the helm chart README
- edit values-dev.yaml to edit domain name (dev-XXX.demiurge.co)
- deploy helm chart with values-dev.yaml file.

## Setup external access to minikube

In AWS:

- add CNAME entry for **account** and **ganymede** from ganymede.dev-XXX.demiurge.co to the instance default fqdn
- add HTTP and HTTPS input to instance security group rules.

On the instance, install **nginx** and configure it to route ganymede and account requests to minikube ip.

```
sudo apt-get update
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

Edit /etc/nginx/sites-available/default to route incoming https request to our minikube ingress controller. Use `$ minikube ip` to find the ip address to redirect traffic to.

```
server {
    listen 80;
    server_name ganymede.dev-001.demiurge.co;

    location / {
        proxy_pass http://192.168.49.2;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    error_page 404 /custom_404;
    location = /custom_404 {
        return 404 'Oops! The page you are looking for cannot be found.';
        add_header Content-Type text/plain;
    }
}


server {
    listen 80;
    server_name account.dev-001.demiurge.co;

    location / {
        proxy_pass http://192.168.49.2;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    error_page 404 /custom_404;
    location = /custom_404 {
        return 404 'Oops! The page you are looking for cannot be found.';
        add_header Content-Type text/plain;
    }
}
```

Then run certbox to generate let's encrypt certificates

```shell
$ sudo certbot --nginx
```

## Deploy postgresql database

Start postgres docker container:

```shell
$ docker run -e POSTGRES_PASSWORD=xxxx -p 5432:5432 -d postgres:16.4
```

Deploy database schema and initial data set ([repo](https://github.com/DemiurgeGalaxie/database))

```
$ sudo apt install postgresql-client-common postgresql-client-16 -y

$ cd database/

$ psql -U postgres -h 127.0.0.1 -p 5432
postgres=# CREATE DATABASE ganymede_db;
postgres=# \l
postgres=# exit

$ ./run.sh schema
$ ./run.sh procedures
$ ./run.sh triggers
```

## start a jaeger docker container

```shell
$ docker run -d --name jaeger \
  -e COLLECTOR_ZIPKIN_HTTP_PORT=9411 \
  -p 5775:5775/udp \
  -p 6831:6831/udp \
  -p 6832:6832/udp \
  -p 5778:5778 \
  -p 16686:16686 \
  -p 14268:14268 \
  -p 9411:9411 \
  -p 4318:4318 \
  jaegertracing/all-in-one:1.61.0
```

In AWS:

- add CNAME entry for **jaeger** from jaeger.dev-XXX.demiurge.co to the instance default fqdn
- add inbound rule for TCP:4318 to instance security group rules.

Add a server in Nginx config file to route to jaeger UI

```
server {
    listen 80;
    server_name jaeger.dev-001.demiurge.co;

    location / {
        proxy_pass http://127.0.0.1:16686;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```shell
$ sudo certbot --nginx
```

# Start frontend development server

In **app-frontend** package:

- in [project.json](../packages/app-frontend/project.json): Change value **"allowedHosts"**

- in [app.tsx](../packages/app-frontend/src/app/app.tsx): Change value of **env** props on line `

  `<ApiContext env={'dev-XXX'} domain={'demiurge.co'}>`

  to the revelant value **XXX**.

Then start the development server:

```shell
$ nohup npx nx serve app-frontend > /tmp/app-frontend 2>&1 &
```

In AWS route 53 DNS, add CNAME entries for **frontend.dev-XXX.demiurge.co** and **dev-XXX.demiurge.co** to the instance default fqdn

Add servers definitions in nginx reverse proxy config file to route traffic to frontend development server

```
server {
    listen 80;
    server_name frontend.dev-001.demiurge.co;

    location / {
        proxy_pass http://127.0.0.1:8888;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    server_name dev-001.demiurge.co;

    root /tmp/app-frontend-build;
    index index.html;

    location / {
        try_files $uri /index.html;
    }

    location ~* \.(js|css|html|svg|ttf|woff|woff2)$ {
        gzip_static on;
        expires max;
        add_header Cache-Control public;
    }
}
```

Run certbot again:

```shell
$ sudo certbot --nginx
```

# After reboot

```shell
$ minikube start
$ docker start postgres
```
