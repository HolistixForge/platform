
REPO_ROOT="$WORKSPACE/monorepo"

mount_points=(
    "$REPO_ROOT/.nx"
    #"$REPO_ROOT/dist"
)

dev_mount_workspace() {
    if [ ! -d ${WORKSPACE} ]; then
        if  [  -z "${NFS_SERVER}" ]; then
            echo "Error: NFS_SERVER is not defined"
            exit 1
        fi
        echo "Mount $WORKSPACE... (${NFS_SERVER}:${NFS_SOURCE})"
        mkdir -p ${WORKSPACE}
        sudo service rpcbind start
        sudo service nfs-common start
        sudo mount -t nfs -o rsize=8192,wsize=8192,timeo=14,intr ${NFS_SERVER}:${NFS_SOURCE} ${WORKSPACE}
    fi
}

dev_bind_nx_dirs() {
    for mount_point in "${mount_points[@]}"; do
        if mount | grep $mount_point >/dev/null; then
            sudo umount $mount_point
        fi
        echo "overwrite [$mount_point]"
        SRC=$(mktemp -d "/tmp/monorepo_$(basename $mount_point)-XXXXXXXX")
        sudo chown "root:${DEV_USER}" "${SRC}"
        sudo chmod 775 "${SRC}"
        sudo mount --bind "${SRC}" $mount_point
    done
}