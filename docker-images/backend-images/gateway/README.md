# TODO_GW_DOCKER: UPDATE

# Install Host

1. Create a AWS instance, **Ubuntu server 24.04 LTS 64 bits x86 (t2.medium)**

2. add rule for SSH, HTTP, HTTPS and [*$OPENVPN_PORTS*]/udp

3. Create CNAME DNS entries (like gw-2-17.dev-001.demiurge.co)

4. mount main dev server workspace with nfs 

    on main dev server : add a rule allowing this server incoming traffic using its private IPv4 dns
    ```shell
    sudo apt update && sudo apt upgrade
    : "${NFS_SOURCE:=/home/ubuntu/workspace}"
    cd && mkdir workspace
    WORKSPACE=/home/ubuntu/workspace
    NFS_SERVER=ec2-15-237-183-150.eu-west-3.compute.amazonaws.com
    sudo apt install rpcbind nfs-common && sudo service rpcbind start
    ```

5. Install

```shell
sudo ENV_NAME=dev-001 DOMAIN_NAME=demiurge.co GW_INSTANCE_ID=1 GW_COUNT=2 ./install.sh
GW_INSTANCE_ID=1 GW_ID=1 ENV_NAME=dev-001 DOMAIN_NAME=demiurge.co NFS_SERVER=ip-172-31-12-139.eu-west-3.compute.internal ./host-install/start-gw-container.sh
```
