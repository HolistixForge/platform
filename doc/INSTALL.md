# Development setup

## install

## Aws instance

In AWS, setup an Ubuntu Instance, **Ubuntu server 24.04 LTS 64 bits x86 (t2.xlarge)** with **100 GB** disk

create or reuse an IAM role 'ganymede-aws-api' for this instance to run with.
This allow the instance to create other for running users projects resources (docker images) in the cloud

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

## Clone repo

in the instance:

- setup your github ssh key,
- clone [repo](https://github.com/DemiurgeGalaxie/monorepo) in a "workspace" folder

## Install NodeJs

install recent nodejs.
see [dev-pod Dockerfile](../docker-images/backend-images/dev-pod/Dockerfile) as an example

- run `$ npm install` in repo

## Install Docker

- install [docker](https://docs.docker.com/engine/install/ubuntu/)
- add user to "docker" group: `$ sudo usermod -aG docker $USER && newgrp docker`

## Build dev-pod docker image

Build dev-pod docker image. see [README](../docker-images/backend-images/dev-pod/README.md).

## Install NFS server

We will serve the same repo over NFS to the different service's pods. Install nfs server

`$ sudo apt-get install nfs-server`

(mkdir, chown nobody:nogroup, etc/exports, exportfs -a)

⚠️ NOT SURE NEEDED : add user to "nogroup" group: `sudo usermod -a -G nogroup $USER && newgrp nogroup` (to have permission to edit workspace)

## Setup access to services

In AWS:

- add CNAME entry for **account** and **ganymede** from ganymede.dev-XXX.demiurge.co to the instance default fqdn
- add HTTP and HTTPS input to instance security group rules.

On the instance, install **nginx** and configure it to route ganymede and account requests.

```
sudo apt-get update
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

Edit /etc/nginx/sites-available/default to route incoming https request to our apps.

```
server {
    listen 80;
    server_name ganymede.dev-002.demiurge.co;

    location / {
        proxy_pass http://127.0.0.1:6000;
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
    server_name account.dev-002.demiurge.co;

    location / {
        proxy_pass http://127.0.0.1:6001;
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

$ PGPASSWORD=xxx ./run.sh schema
$ PGPASSWORD=xxx ./run.sh procedures
$ PGPASSWORD=xxx ./run.sh triggers
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
    server_name jaeger.dev-002.demiurge.co;

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

In **app-frontend** package, change Environment name in:

- in vite.config.js : server.allowedHosts: ["frontend.dev-002.demiurge.co"]

- in [.env](../packages/app-frontend/.env): Change value of **VITE_ENVIRONMENT**

Then start the development server:

```shell
$ nohup npx nx run app-frontend:serve --port 6002 > /tmp/app-frontend 2>&1 &
```

In AWS route 53 DNS, add CNAME entries for **frontend.dev-XXX.demiurge.co** and **dev-XXX.demiurge.co** to the instance default fqdn

Add servers definitions in nginx reverse proxy config file to route traffic to frontend development server

```
server {
    listen 80;
    server_name frontend.dev-002.demiurge.co;

    location / {
        proxy_pass http://127.0.0.1:6002;
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
    server_name dev-002.demiurge.co;

    root /var/www/app-frontend;
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

# build frontend

```shell
npx nx run app-frontend:build:production \
    && sudo rm -rf /var/www/app-frontend \
    && sudo cp -ra dist/packages/app-frontend /var/www/app-frontend \
    && sudo chown -R www-data /var/www/app-frontend
```

# Install gateway

[gateway README](../docker-images/backend-images/gateway/README.md)

# After reboot

```shell
$ docker start postgres
```
