# https://github.com/pgadmin-org/pgadmin4/blob/master/Dockerfile

FROM ubuntu:24.04

USER root

RUN apt-get update --yes && apt-get install --yes --no-install-recommends \
    tini \
    jq \
    curl \
    openvpn \
    iputils-ping \
    pciutils \
    ttyd \
  && rm -rf /var/lib/apt/lists/*

COPY --chmod=755 ./demiurge-functions.sh /usr/local/bin/

COPY --chmod=755 ubuntu/demiurge-entrypoint.sh /usr/local/bin/

ENTRYPOINT ["tini", "-g", "--", "demiurge-entrypoint.sh"]