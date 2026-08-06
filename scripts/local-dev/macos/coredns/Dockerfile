# CoreDNS, with somewhere to mount a Corefile.
#
# The official coredns image is FROM scratch: one binary and nothing else, so
# there is no /etc/coredns for a bind mount to land on and Apple `container`
# refuses to start it ("failed to bootstrap container … mount"). This adds the
# directory, and a shell to look around with when an answer is wrong.
#
# Only the macOS harness needs it. On Linux CoreDNS is a package on the host —
# see infra/ansible/roles/coredns — and this file is not part of that path.
FROM docker.io/library/alpine:3.20

COPY --from=docker.io/coredns/coredns:1.11.1 /coredns /usr/local/bin/coredns

RUN mkdir -p /etc/coredns

EXPOSE 53 53/udp
ENTRYPOINT ["/usr/local/bin/coredns"]
CMD ["-conf", "/etc/coredns/Corefile"]
