#!/bin/bash

DOMAIN="$1"

if [ -z "$DOMAIN" ]; then
    echo "$0 <DOMAIN>"
    echo "example: $0 dev.local"
    exit 1
fi

openssl genrsa -out rootCA.key 2048
openssl req -x509 -new -nodes -key rootCA.key -sha256 -days 1024 -out rootCA.crt

openssl genrsa -out wildcard.${DOMAIN}.key 2048
openssl req -new -key wildcard.${DOMAIN}.key -out wildcard.${DOMAIN}.csr -subj "/CN=*.${DOMAIN}"

cat <<EOF >wildcard.${DOMAIN}.config
basicConstraints=CA:FALSE
subjectAltName=DNS:*.${DOMAIN}
extendedKeyUsage=serverAuth
EOF

openssl x509 -req -in wildcard.${DOMAIN}.csr -CA rootCA.crt -CAkey rootCA.key -CAcreateserial -extfile wildcard.${DOMAIN}.config -out wildcard.${DOMAIN}.crt -days 365 -sha256
