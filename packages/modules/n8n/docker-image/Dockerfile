FROM docker.n8n.io/n8nio/n8n:1.97.1

USER root

RUN apk add --no-cache tini jq curl iputils openvpn util-linux pciutils

COPY --chmod=755 ../../docker-images/user-images/demiurge-functions.sh /usr/local/bin/
COPY --chmod=755 ./demiurge-entrypoint.sh /usr/local/bin/

ENTRYPOINT ["tini", "-g", "--", "demiurge-entrypoint.sh"]