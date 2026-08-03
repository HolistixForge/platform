# Running the Platform in a VM

This guide replaces the dev-container workflow described in
[LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md). The platform now runs on a real
Ubuntu 24.04 machine — locally a VM, in production a server — provisioned by
the same Ansible playbook.

---

## Why a VM instead of a dev container

|                        | Dev container                                                                                 | VM / server                                                 |
| ---------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **init system**        | none — services started with `&` and lost on restart                                          | systemd: services enabled, restarted, and surviving reboots |
| **Docker**             | host socket mounted in; bind mounts from the container filesystem are invisible to the daemon | real Docker Engine on the same filesystem                   |
| **`172.17.0.1`**       | not the container's own address, so gateway containers reach the wrong host                   | genuinely this host — matches the code's default            |
| **Networking**         | port mapping through the Docker host                                                          | its own IP address, ports 53/80/443 usable directly         |
| **Path to production** | none; a container image is not a server                                                       | identical roles, only group variables differ                |

The observability role's config-via-Docker-volume workaround, the
`nohup … &` service starts, and the `BUILD_SERVER_IP` guessing all exist
because of dev-container constraints that do not apply here.

---

## Prerequisites

macOS (Apple Silicon or Intel):

```bash
brew install lima ansible
```

`infra/vm/lima-holistix.yaml` uses `vmType: vz` and a `vzNAT` interface, both
of which are macOS-only (Apple's Virtualization.framework, macOS 13+). On a
Linux host, drop those two keys to fall back to QEMU and reach the guest over
Lima's default networking — or skip Lima entirely and use any hypervisor, see
[Other hypervisors](#other-hypervisors). The Ansible playbook is identical
either way.

---

## 1. Create and provision the VM

```bash
cd infra/vm
./vmctl.sh bootstrap
```

`bootstrap` is `up` followed by `provision`:

- **`up`** — creates a Lima VM (Ubuntu 24.04, 4 CPU / 6 GiB / 40 GiB by
  default — sized for a laptop; `disk` is a ceiling, not an allocation) with this repository shared into the guest at
  `/root/workspace/monorepo`, and a `vzNAT` interface so the host can reach the
  guest directly.
- **`provision`** — runs `infra/ansible/site.yml` over SSH. Expect 10–15
  minutes on a first run, mostly Docker image builds and `npm ci`.

Resize with environment variables before the first `up`:

```bash
HOLISTIX_VM_CPUS=8 HOLISTIX_VM_MEMORY=16GiB HOLISTIX_VM_DISK=150GiB ./vmctl.sh up
```

### What gets installed

| Role            | Contents                                                  |
| --------------- | --------------------------------------------------------- |
| `common`        | base packages, platform directories, inotify limits       |
| `node`          | Node.js 24 from NodeSource (arch-aware)                   |
| `docker`        | Docker Engine + compose plugin, `DOCKER_HOST_IP` exported |
| `postgres`      | PostgreSQL, password auth, `scram-sha-256`                |
| `nginx`         | Nginx with `server_names_hash_bucket_size 128`            |
| `mkcert`        | local CA, root certificate exported for the host OS       |
| `certbot`       | _(production only)_ Let's Encrypt + auto-renewal timer    |
| `coredns`       | CoreDNS on `0.0.0.0:53` as a **systemd unit**             |
| `workspace`     | npm dependencies, gateway image, shell aliases            |
| `buildserver`   | gateway tarball server on `:8090` as a systemd unit       |
| `observability` | OTLP Collector, Loki, Tempo, Grafana                      |
| `reclaim`       | apt/npm/docker caches + `fstrim` (runs last)              |

---

## 2. Trust the development CA

```bash
./vmctl.sh trust-ca
```

Adds the VM's mkcert root CA to the macOS System keychain (or the Linux system
trust store). Restart your browser afterwards. Firefox keeps its own store —
import `rootCA.pem` manually there.

---

## 3. Point the host resolver at the VM

```bash
./vmctl.sh dns test        # for *.test domains
./vmctl.sh ip              # the address it configured
```

This writes `/etc/resolver/<tld>` pointing at the guest's `vzNAT` address, so
every `*.dev.test` name resolves through CoreDNS in the VM.

> **Avoid `.local` on macOS.** `.local` is reserved for mDNS/Bonjour and
> resolves unreliably through `/etc/resolver`. The environment scripts accept
> any domain, so create environments on `.test` instead:
> `./scripts/local-dev/create-env.sh dev-001 dev.test`.
> On Linux hosts `.local` works, but `.test` is still the safer default.

---

## 4. Create an environment

```bash
./vmctl.sh shell                       # root shell inside the VM

cd /root/workspace/monorepo
./scripts/local-dev/create-env.sh dev-001 dev.test
./scripts/local-dev/build-frontend.sh dev-001
./scripts/local-dev/envctl.sh start dev-001
```

Everything below this point is unchanged from the dev-container workflow — the
`scripts/local-dev/*` tooling, `envctl.sh`, the gateway pool, and
`infra-diagnostic.sh` all behave the same.

```
https://dev.test                     Frontend
https://ganymede.dev.test            Ganymede API
https://org-<uuid>.dev.test          Gateway
```

---

## 5. Verify the collaboration WebSocket

The whiteboard is built on one WebSocket room per project, streaming events to
every connected client. If that does not work, nothing does — so verify it
explicitly rather than inferring it from a page that loads.

```bash
./vmctl.sh verify-ws dev-001 --bootstrap   # first run on a fresh environment
./vmctl.sh verify-ws dev-001 --clients 5   # afterwards
```

`scripts/local-dev/verify-collab-websocket.mjs` runs on the platform host and
exercises the whole chain — stage-1 nginx TLS and `Upgrade` headers, the
gateway container's nginx, the `app-gateway` process, and the y-websocket room:

1. resolves an organization, project and user from the database
2. signs an RS256 `access_token` with the environment's `jwt-key`
3. allocates a gateway via `POST /gateway/start` on Ganymede — this is what
   writes the `org-<uuid>.<domain>` nginx vhost; without it an upgrade falls
   through to the frontend server block and returns 200 instead of 101
4. probes with a real upgrade until the gateway serves one, since allocation
   returns before nginx has reloaded and the container has fetched its config
5. opens N independent clients on `wss://org-<uuid>.<domain>/project/<project_id>`
6. asserts a document update from client 0 reaches **every** other client
7. asserts awareness (presence) converges across all clients

The room is per project, so a freshly created environment has nothing to join.
`--bootstrap` creates what is missing through the real Ganymede API — signup
(which also creates the organization, via `proc_users_new`) then `POST
/projects` — rather than inserting rows, so the permissions the gateway checks
are built exactly as they are for a human. It is idempotent and skips anything
that already exists. The test removes the marker key it wrote before exiting.

> The clients set `disableBc: true` on purpose. Without it, y-websocket
> providers inside one Node process sync through `BroadcastChannel` and the
> test would pass with the WebSocket server completely down.

A failure names the stage it broke at, so `[websocket connect]` (a rejected JWT
or missing room) is immediately distinguishable from `[document propagation]`
(the socket is open but events are not relayed).

---

## Day-to-day

| Command                          | Purpose                                             |
| -------------------------------- | --------------------------------------------------- |
| `./vmctl.sh status`              | VM state plus the status of every managed service   |
| `./vmctl.sh diagnostic`          | runs `infra-diagnostic.sh` inside the VM            |
| `./vmctl.sh verify-ws <env>`     | proves the collab WebSocket relays events           |
| `./vmctl.sh shell`               | root shell in the guest                             |
| `./vmctl.sh shell 'envctl list'` | run one command in the guest                        |
| `./vmctl.sh stop` / `start`      | suspend / resume                                    |
| `./vmctl.sh provision`           | re-run Ansible after changing a role                |
| `./vmctl.sh destroy`             | delete the VM (the shared source tree is untouched) |

Services are systemd units now, so `systemctl` works as expected:

```bash
./vmctl.sh shell
systemctl status coredns nginx postgresql holistix-buildserver
journalctl -u coredns -f
```

### What survives a reboot

Verified by stopping and starting the VM:

| Layer                                                 | After reboot       |
| ----------------------------------------------------- | ------------------ |
| Docker, PostgreSQL, Nginx, CoreDNS, build server      | back automatically |
| Observability containers (`--restart unless-stopped`) | back automatically |
| Gateway pool containers                               | **stay stopped**   |
| Ganymede (started by `envctl.sh`, not a unit)         | **stays stopped**  |

So the infrastructure layer is self-healing but the application layer is not.
Bring it back with:

```bash
./vmctl.sh shell 'cd /root/workspace/monorepo && ./scripts/local-dev/envctl.sh start <env>'
./vmctl.sh shell 'docker start $(docker ps -aq --filter name=gw-pool-<env>)'
```

Putting Ganymede under systemd and giving pool containers a restart policy is
outstanding work for production — see
[#36](https://github.com/HolistixForge/platform/issues/36).

### Editing code

The repository is shared read-write from the host, so edit on your machine with
your usual editor and build inside the VM. Nothing needs syncing.

**Build directories are deliberately not shared.** `node_modules`, `.nx`,
`dist` and `tmp` are backed by guest-local storage under
`/var/lib/holistix/workspace` and bind-mounted over the workspace, so a
`linux-arm64` native module never overwrites the macOS one sitting in the same
path. Disable with `holistix_isolate_build_dirs: false` if you prefer sharing
them.

---

## Other hypervisors

`vmctl.sh` drives Lima, but the playbook does not care how the machine was
created. For Multipass, UTM, Proxmox, or any cloud VM:

```bash
multipass launch 24.04 --name holistix \
  --cpus 6 --memory 12G --disk 100G \
  --cloud-init infra/vm/cloud-init.yaml

cd infra/ansible
ansible-galaxy collection install -r requirements.yml
ansible-playbook -i "$(multipass info holistix --format json | jq -r '.info.holistix.ipv4[0]')," \
  -u ubuntu --become site.yml \
  -e holistix_repo_mode=clone
```

Use `holistix_repo_mode=clone` whenever the source tree is not shared in from
the host.

---

## Production

The same playbook provisions a server. Only the group variables differ.

```bash
cp infra/ansible/inventory/production.yml.example \
   infra/ansible/inventory/production.yml     # gitignored
$EDITOR infra/ansible/inventory/production.yml

cd infra/ansible
ansible-playbook -i inventory/production.yml site.yml \
  -e vault_postgres_password="…" --check --diff   # dry run
ansible-playbook -i inventory/production.yml site.yml \
  -e vault_postgres_password="…"
```

`inventory/group_vars/production.yml` switches to:

- `holistix_tls_mode: letsencrypt` — certbot with the nginx plugin and the
  renewal timer enabled, instead of a local mkcert CA
- `holistix_repo_mode: clone` — the server clones `main` itself
- `holistix_install_coredns: false` — public DNS comes from your registrar
- `postgres_password` from `vault_postgres_password`, which is **mandatory**;
  the playbook fails rather than falling back to `devpassword`

Still outstanding for a real production deployment (tracked in
[#36](https://github.com/HolistixForge/platform/issues/36)): firewall rules,
log rotation and retention, backups, unattended upgrades, and running Ganymede
under systemd rather than `envctl.sh`.

---

## Troubleshooting

**`limactl not found`** — `brew install lima`.

**Provisioning fails on the workspace role with "package.json not found"** —
the virtiofs share did not mount. Check `./vmctl.sh shell 'ls /root/workspace/monorepo'`
and the `mounts:` block in `infra/vm/lima-holistix.yaml`. If Lima refuses to
mount outside the guest user's home, change `mountPoint` to a path under that
home and symlink it:

```bash
./vmctl.sh shell 'ln -sfn /home/$SUDO_USER.linux/monorepo /root/workspace/monorepo'
```

Alternatively provision with `-e holistix_repo_mode=clone` and let the VM keep
its own checkout.

**CoreDNS will not start / port 53 in use** — Ubuntu's `systemd-resolved` stub
listener holds `127.0.0.53:53`. The `coredns` role disables it via
`/etc/systemd/resolved.conf.d/holistix-no-stub.conf`. Verify with
`ss -tulnp | grep :53`.

**The host cannot resolve `*.dev.test`** — re-run `./vmctl.sh dns test`; the
guest address changes if the VM is recreated. Confirm with
`dscacheutil -q host -a name ganymede.dev.test`.

**Browser still warns about the certificate** — `./vmctl.sh trust-ca`, then
fully restart the browser. Firefox needs a separate manual import.

**`npm ci` is slow** — it runs on a guest-local `node_modules`, not over
virtiofs, so this is normal first-run cost, not share overhead.

**The VM is using too much disk** — the `reclaim` role runs `fstrim`, and
Lima's `vz` disk honours the discard, so the host file tracks what the guest
actually uses. Measured on a full install (observability and Playwright
included): 8.6 GiB inside the guest, 8.7 GiB allocated for
`~/.lima/holistix/disk` even though it is a 40 GiB image. If the two have
drifted apart, re-run `./vmctl.sh provision --tags reclaim`.

---

## Related documentation

- [infra/README.md](../../infra/README.md) — layout and command reference
- [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md) — the dev-container workflow this replaces
- [DNS_COMPLETE_GUIDE.md](DNS_COMPLETE_GUIDE.md) — CoreDNS zones and host DNS
- [GATEWAY_BUILD_DISTRIBUTION.md](GATEWAY_BUILD_DISTRIBUTION.md) — the `:8090` build server
- [PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md) — production architecture
