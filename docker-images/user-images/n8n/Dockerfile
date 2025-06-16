FROM docker.n8n.io/n8nio/n8n:1.97.1

USER root

RUN apk add --no-cache tini jq curl iputils openvpn nginx util-linux pciutils

COPY --chmod=755 ./demiurge-functions.sh n8n/demiurge-entrypoint.sh n8n/services.conf /usr/local/bin/

ENTRYPOINT ["tini", "-g", "--", "demiurge-entrypoint.sh"]