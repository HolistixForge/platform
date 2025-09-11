# Install Host

1. (Can be done on main dev server) ~~Create a AWS instance, **Ubuntu server 24.04 LTS 64 bits x86 (t2.medium)**~~

2. add rule for incoming SSH, HTTP, HTTPS and [*$OPENVPN_PORTS*]/udp (49000-4900X)

3. Create CNAME DNS entries (like gw-2-17.dev-001.demiurge.co)

4. ~~mount main dev server workspace with nfs~~

   on main dev server : add a rule allowing this server incoming traffic using its private IPv4 dns

   ```shell
   $ sudo apt update && sudo apt upgrade
   $ : "${NFS_SOURCE:=/home/ubuntu/workspace}"
   $ cd && mkdir workspace
   $ WORKSPACE=/home/ubuntu/workspace
   $ NFS_SERVER=ec2-15-237-183-150.eu-west-3.compute.amazonaws.com
   $ sudo apt install rpcbind nfs-common && sudo service rpcbind start
   ```

5. Install

export all env var so that you don't need to set them for each command and to not mistake values

```shell
export ENV_NAME=dev-001
export GW_INSTANCE_ID=1
export ...
```

If you add gw instances to an existant server, run this to increase GW_COUNT and create nginx configs

```shell
# install docker, nginx, certbot, AND setup nginx config
$ sudo ENV_NAME=dev-001 DOMAIN_NAME=demiurge.co GW_INSTANCE_ID=1 GW_COUNT=2 ./host-install/install.sh
```

Then get a token for each gw to add and start it

```shell
# get a token with app-ganymede-cmd app
$ npx nx run app-ganymede-cmds:build
$ export JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----
-----END PUBLIC KEY-----"
$ export JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
-----END PRIVATE KEY-----"
$ export PG_HOST=127.0.0.1
$ export PG_PORT=5432
$ export PG_USER=test
$ export PG_PASSWORD=test
$ export PG_DATABASE=ganymede_db
$ node ./dist/packages/app-ganymede-cmds/main.js add-gateway -h gw-1-1.dev-002.demiurge.co -gv 0.0.1

# copy the token value for next command

# start gateway container mounting workspace through NFS
$ GW_INSTANCE_ID=1 \
  GW_ID=1 \
  ENV_NAME=dev-001 \
  DOMAIN_NAME=demiurge.co \
  NFS_SERVER=ip-172-31-12-139.eu-west-3.compute.internal \
  ./host-install/start-gw-container.sh

# start gateway container mounting workspace through docker volume
$ GW_INSTANCE_ID=1 \
  GW_ID=1 \
  ENV_NAME=dev-001 \
  DOMAIN_NAME=demiurge.co \
  WORKSPACE=/home/ubuntu/workspace \
  GATEWAY_TOKEN=XXXXX \
  ./host-install/start-gw-container.sh
```
