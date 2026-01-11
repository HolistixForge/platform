FROM codercom/code-server:4.97.1

USER root

RUN apt-get update --yes && apt-get install --yes --no-install-recommends \
    tini \
    jq \
    curl \
    openvpn \
    iputils-ping \
    pciutils

COPY --chmod=755 ../../docker-images/user-images/container-functions.sh /usr/local/bin/
COPY --chmod=755 ./container-entrypoint.sh /usr/local/bin/

# Set code-server to run without authentication initially (OAuth will be used)
ENV PASSWORD=""
ENV SUDO_PASSWORD=""

ENTRYPOINT ["tini", "-g", "--", "container-entrypoint.sh"]
