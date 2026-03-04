# Holistix Bootstrap Tools
#
# This image packages shared files needed by all user container images.
# It uses 'scratch' (empty) base to keep it minimal - it only contains files.
#
# Usage in user container Dockerfiles:
#   FROM holistixforge/bootstrap-tools:latest AS tools
#   FROM any-third-party-image:tag
#   COPY --from=tools /holistix/ /usr/local/bin/
#
# Build:
#   docker build -t holistixforge/bootstrap-tools:latest packages/modules/user-containers/docker-images/base/
#
# Push:
#   docker push holistixforge/bootstrap-tools:latest

FROM scratch

# Copy shared bootstrap files
COPY container-functions.sh /holistix/container-functions.sh

# Copy auth guard binary (built with: make build-linux-amd64 in auth-guard/)
COPY auth-guard/auth-guard-linux-amd64 /holistix/auth-guard
