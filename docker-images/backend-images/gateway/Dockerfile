FROM dev-pod:latest

USER root 

RUN apt update && apt install -y \
openvpn \
easy-rsa \
nginx \
inotify-tools

CMD env && ls -l \
    && /home/dev/main.sh \
    && ls -l ${WORKSPACE} \
    && echo ${SCRIPTS_DIR} && cd ${SCRIPTS_DIR} \
    && pwd && ls -l \
    && sudo -E -u ${DEV_USER} ./main.sh -r bin/reset-gateway.sh \
    && tail -f /tmp/gateway.log