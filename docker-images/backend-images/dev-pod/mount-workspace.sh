
: "${NFS_SERVER:=host.minikube.internal}"
: "${NFS_SOURCE:=/home/ubuntu/workspace}"

###

PLEARNT="$WORKSPACE/plearnt"

mount_points=(
    "$PLEARNT/tmp"
    "$PLEARNT/node_modules/.cache"
    "$PLEARNT/.nx"
    "$PLEARNT/dist"
)

dev_mount_workspace() {
    echo "Mount $WORKSPACE... (${NFS_SERVER}:${NFS_SOURCE})"
    mkdir -p /home/${DEV_USER}/workspace
    sudo service rpcbind start
    sudo service nfs-common start
    sudo mount -t nfs -o rsize=8192,wsize=8192,timeo=14,intr ${NFS_SERVER}:${NFS_SOURCE} ${WORKSPACE}
}

dev_bind_nx_dirs() {
    for mount_point in "${mount_points[@]}"; do
        if mount | grep $mount_point >/dev/null; then
            sudo umount $mount_point
        fi
        echo "overwrite [$mount_point]"
        SRC=$(mktemp -d "/tmp/plearnt_$(basename $mount_point)-XXXXXXXX")
        sudo chown "root:${DEV_USER}" "${SRC}"
        sudo chmod 775 "${SRC}"
        sudo mount --bind "${SRC}" $mount_point
    done
}