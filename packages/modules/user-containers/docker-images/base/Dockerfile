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
#   docker buildx build --platform linux/amd64,linux/arm64 \
#     -t holistixforge/bootstrap-tools:latest --push \
#     packages/modules/user-containers/docker-images/base/
#
# The auth-guard binary is picked per target architecture, so every platform
# passed to --platform needs its binary present in this directory beforehand:
#
#   make -C packages/modules/user-containers/auth-guard build-all
#   cp packages/modules/user-containers/auth-guard/auth-guard-linux-* \
#      packages/modules/user-containers/docker-images/base/auth-guard/
#
# A plain `docker build` works too and resolves TARGETARCH to the host's
# architecture — but it produces a single-arch image.

FROM scratch

# Set by BuildKit from the target platform: amd64, arm64, ...
ARG TARGETARCH

# Copy shared bootstrap files
COPY container-functions.sh /holistix/container-functions.sh

# Copy the auth guard binary for the target architecture
COPY auth-guard/auth-guard-linux-${TARGETARCH} /holistix/auth-guard
