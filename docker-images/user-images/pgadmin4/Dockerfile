# https://github.com/pgadmin-org/pgadmin4/blob/master/Dockerfile
FROM dpage/pgadmin4:8.12.0

USER root

RUN apk add --no-cache tini jq curl iputils openvpn util-linux pciutils

COPY --chmod=755 ./demiurge-functions.sh /usr/local/bin/

COPY --chmod=755 pgadmin4/start-pgadmin4.sh pgadmin4/demiurge-entrypoint.sh /usr/local/bin/

RUN touch /pgadmin4/config_local.py && \
    chown 5050:5050 /pgadmin4/config_local.py

ENTRYPOINT ["tini", "-g", "--", "demiurge-entrypoint.sh"]