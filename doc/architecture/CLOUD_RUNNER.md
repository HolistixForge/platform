# Cloud Runner — running user containers on the platform

Tracks [TAC-129](https://linear.app/tachikoma/issue/TAC-129).

**Status.** Stages 0 and 1 are written and unit-tested. A container now boots
in a **real microVM** and the broker's guarantees have been read back out of it
— under Apple `container` on an M1, which needs no nested virtualisation. What
is still unverified is the Docker+Kata pairing specifically, and the end-to-end
path beyond the container: joining the VPN, being routed by nginx. See
[What is not verified](#what-is-not-verified).

## What this adds

Today "starting a service" hands the user a `docker run` command to paste into
their own terminal (`runner.ts:86`). The container joins its gateway over VPN, so
a service on the user's laptop is reachable from the project. That mode works and
**stays**.

This document covers the second mode: the container runs on the platform, with
the user choosing per container. `user-container:set-runner` already carries that
decision, and `getRunner(runnerId)` is already a registry — a platform runner is
a second entry beside `local`, not a replacement.

## The decision that forces everything else

Organizations supply their own images.

That single choice cascades:

| Because                                   | Therefore                                          |
| ----------------------------------------- | -------------------------------------------------- |
| The image is tenant input                 | It can be hostile at startup, before any user acts |
| Hostile-at-startup code shares the kernel | Kernel sharing between orgs is not defensible      |
| Isolation must be per-container           | A microVM runtime, not namespaces alone            |

Note what this argument does _not_ rest on. Even with a closed catalog, Jupyter,
VS Code and n8n are arbitrary code execution by design — a notebook cell is a
shell. Tenant-supplied images do not introduce code execution; they remove the
last moment where the platform sees the code before it runs.

## Runtime: Kata Containers, not raw Firecracker

**Kata Containers with a microVM hypervisor backend.**

Kata is an OCI runtime: `docker run --runtime=kata …`. Each container gets its own
kernel, and the command generation in `runner.ts` changes by roughly one flag.

Raw Firecracker means building a VMM orchestrator — rootfs assembly, guest kernel,
jailer, vsock plumbing, CNI networking, lifecycle. That is a reimplementation of
what Kata already is, measured in months rather than weeks.

Kata can run _on_ Firecracker, so choosing Kata does not give up Firecracker. The
hypervisor backend (Firecracker / Cloud Hypervisor / QEMU) is deliberately left
open — see [Open questions](#open-questions), since it depends on whether user
containers ever need persistent storage.

## Two engines, because there are two kinds of host

Kata is how a Linux host gets a kernel per container. It is not the only way,
and on the hardware this was written on it is not an available way at all.

So the broker drives one of two engines, named in configuration and with no
default:

| Engine   | Host  | Isolation                           |
| -------- | ----- | ----------------------------------- |
| `docker` | Linux | borrowed from the runtime under it  |
| `apple`  | macOS | a VM per container, by construction |

Apple `container` reaches microVM isolation at **level 1** — no nested
virtualisation — so it runs on any Apple Silicon, including the M1 machines
where `/dev/kvm` is absent inside a Linux VM and Kata cannot start. That is
not a workaround: a Mac host is a real deployment target, because iOS builds
need Apple hardware.

`BROKER_ENGINE` has no default for the same reason `BROKER_RUNTIME` has none.
The two engines do not grant the same controls, and picking one by looking at
which binary happened to be installed would decide a security question by
accident.

### What the Apple engine gives up, said out loud

Three of the Docker path's controls have no expression in Apple `container`,
and three more properties differ. Each is a **concession**: it carries what was
lost, and the broker refuses to start until the operator names every one of
them in `BROKER_ACCEPT_CONCESSIONS`. Naming one the engine does _not_ give up
is equally a refusal — that is a config copied from the other engine.

| Concession                    | What is lost                                                             |
| ----------------------------- | ------------------------------------------------------------------------ |
| `no-new-privileges`           | a setuid binary in the guest can regain what `--cap-drop=ALL` took       |
| `pids-cgroup`                 | `RLIMIT_NPROC` per uid instead of a cgroup `pids.max` over the container |
| `restart-policy`              | a container that exits stays down until something outside restarts it    |
| `run-may-pull`                | `container run` fetches a missing image itself; `--pull=never` is gone   |
| `registry-login-is-host-wide` | a tenant credential is host-wide for its pull, so pulls serialise        |
| `no-hot-network-attach`       | two running services cannot be wired together without a restart          |

`pids-cgroup` is the reason a concession records what was lost rather than what
replaced it. `--ulimit nproc=N` works and was verified (`ulimit -u` is 64 in
the guest), and it is **not** the same control: `RLIMIT_NPROC` is a per-uid
ceiling checked at fork, so two uids inside one guest get the ceiling each.

Two of them are answered rather than merely accepted. `run-may-pull` would
matter if there were an ambient credential for a run to pull with, so the
broker refuses to start while this host holds any `container registry login`
— a refusal, not a sweep, because those logins are the operator's. And
`no-hot-network-attach` answers 501 on the attach route rather than quietly
doing nothing: an edge drawn between two services on the whiteboard that meant
nothing would be worse than being told it cannot be drawn.

`--add-host` is missing too and is **not** a concession: a start carrying
`extra_hosts` is refused outright. Nothing is lost quietly — a container that
silently cannot resolve its gateway fails minutes later looking like a network
fault.

Two places Apple is stronger, and neither costs a flag:

- **No swap in the guest.** The memory limit is hard by construction rather
  than by setting `--memory-swap` equal to `--memory`.
- **No `--device` at all.** What the Docker path refuses by policy under a
  microVM runtime is refused here by there being nothing to ask for.

### The tenant pull, as far as it can be checked from here

`container registry login --username x-access-token --password-stdin -- ghcr.io`
was run against the real GHCR: the argv parses, the token is read from stdin —
never argv, where `ps` would show it to every user on the host — and GHCR
answers `401 access denied or wrong credentials` for a token that is not one.
`registry logout`, `image pull --` and `image inspect --` are all accepted, and
`registry list` is empty afterwards.

So the shape of the exchange is verified and the credential is not. A
**successful** pull of a private image with a minted installation token still
needs a real Ganymede and a GitHub App, and has not been done on either engine.

One observation while doing it: `container image pull` fetches the whole
multi-arch index — the progress line named `linux/s390x` — while `run` selects
`arm64`. Disk and bandwidth, not correctness, and pinning `--platform` would
refuse an amd64-only image that Rosetta could otherwise run. Left alone
deliberately.

### It is an addition, not a rewrite

`run-args.ts`, `pull.ts` and `networks.ts` are untouched and still hold the
Docker behaviour. `engine-docker.ts` is a table naming the functions that were
already there; `engine-apple.ts` is a second table pointing at new files. Both
engines ship, and both are verified — see below.

## The broker stays, and its shape does not change

`gateway-pool.sh:115-127` runs the `gw-pool-*` containers **without**
`/var/run/docker.sock`. The gateway — the tenant-facing process, holding user
JWTs and running the reducer over user events — has no Docker access at all today.
That is a property to preserve, not an oversight to fix.

So: a broker daemon on the platform host, with a closed vocabulary.

```
gateway  ──►  broker  ──►  container runtime
         POST /containers
         { image_ref, settings_b64, limits, org_id }
```

The broker never accepts a command line, and never accepts a bare image URI from
the gateway. It resolves `image_ref` against the persisted per-org catalog and
composes the run itself. Exposing the Docker socket is the shortest path and the
worst one: it is root-equivalent on the host. The Docker API over TLS is the same
capability with authentication bolted on — it authenticates the caller, it does
not reduce what the caller can do.

## Code consequences

Five concrete things, in the order they bite.

### 1. The catalog leaks across tenants before it holds tenant data

`servers-reducer.ts:117-132` (`_initProject`) syncs `imageRegistry.getAll()` into
every project's shared state. The registry is one global in-memory `Map`
(`image-registry.ts:4`).

The moment images become per-organization, every project receives every
organization's catalog. **The registry must become org-scoped before images become
tenant data** — this is a prerequisite, not a follow-up.

### 2. `--device /dev/net/tun` does not survive the move

`runner.ts:86` passes `--cap-add=NET_ADMIN --device /dev/net/tun` because the
container runs an OpenVPN client to reach its gateway (the hosting token carries
`org:<id>:connect-vpn` for exactly this — `servers-reducer.ts:674`).

`--device` is host device passthrough. Under a microVM runtime the guest has its
own kernel, so tun must come from the guest image instead. `NET_ADMIN` stays and
becomes _safer_ — it is now confined to a guest kernel rather than shared with the
host. **To verify on the chosen backend before relying on it.**

### 3. Digest pinning is currently dead code

`TContainerImageDefinition.imageSha256` exists (`container-image.ts:6`) and
jupyter fills it (`jupyter/src/index.ts:26,43`), but `generateCommand` builds
`${imageUri}:${imageTag}` and ignores it.

On the user's laptop, a mutable tag is a shrug. On shared infrastructure it means
the image that ran yesterday is not necessarily the one that runs today. With
tenant-supplied images, pinning by digest stops being optional.

### 4. Nothing caps anything

No CPU, memory, disk or PID limit is set anywhere, and nothing reaps. A microVM
needs a fixed memory allocation at boot, so limits stop being a policy knob and
become a required input to the broker.

The reaping signal already exists: `last_watchdog_at` / `last_activity`
(`servers-types.ts:26-28`) are populated, and `_periodic`
(`servers-reducer.ts:483-508`) already runs and prunes services silent for 30s.

### 5. Registry credentials are new secret material

Pulling from an organization's private registry needs per-org credentials. These
must never reach collab shared state — the same rule, for the same reason, as
`auth_guard_client_secret`, whose handling is already documented at
`runner.ts:12-19` and `servers-types.ts:37-44`. They travel gateway → broker and
stop there.

## Isolation is not abuse prevention

Kata protects the platform's kernel from the workload. It does nothing about what
the workload does _outward_.

A tenant-supplied image with unrestricted egress on shared infrastructure is a
mining rig, a spam relay, or a scanner running from the platform's IP addresses.
Nothing today constrains egress, because nothing needed to when the container ran
on the user's own machine and their own connection.

This is a separate control from isolation and needs its own answer — egress
policy, per-org bandwidth accounting, or both.

## Staged plan

**Stage 0 — project-scoped catalog.** _Done._ `ContainerImageRegistry` now has
two tiers: built-in images registered in code, and per-project images. `get()`
and `getAll()` take a project id; without one, only built-ins resolve. A
built-in id cannot be shadowed by a tenant entry, and a tenant entry without a
digest is refused at registration. `imageReference()` emits `repo:tag@sha256:…`.

Scoped by **project**, not organization, because that is where the pull
credential lives: `credential_shares` already carries
`share_scope = 'project'` with a `project_id`, and the resolution query already
honours it (`routes/credentials/index.ts:159`). An image and the token that
fetches it therefore resolve against the same thing. It is also the stricter of
the two — it stops a leak between two projects of one organization, not merely
between organizations.

**Stage 1 — platform runner and broker.** _Written._ `PlatformRunnerBackend`
registers beside `local`, but only where a broker is configured; the live set is
published through a new `user-containers:runners` shared map so the UI cannot
offer a mode the deployment lacks. `packages/app-container-broker` is the
host-side service. `infra/ansible/roles/kata` and `roles/containerbroker`
provision it, gated on `holistix_install_cloud_runner` (default false).

**Stage 2 — open the catalog, from GHCR.** Partly done. Tenant images come from
`ghcr.io`, pulled with a `github_token` from the credentials wallet shared at
project scope — both the credential type and project-scoped sharing already
exist in Ganymede, so there is no storage layer to build.

`/internal/projects/:projectId/images/:imageId` now exists
(`routes/internal/container-images.ts`), gateway-token protected, returning
`{ imageId, reference, pull_token, github_organization }`. The broker pulls with
that token in a throw-away `--config` directory (`pull.ts`).

**Credential: a GitHub App, not a personal access token.** The deciding factor
was user effort. A PAT means creating a machine account, generating a token with
`read:packages`, inviting it to the organization, granting repositories,
copying, pasting, sharing — and again at every expiry. An App installation is
three clicks, once, and GitHub tells us which organization and repositories were
chosen, so `projects.github_organization` fills itself instead of being typed.

It also means **no tenant secret is stored at all**. We keep an installation id,
which is not a credential, and mint tokens on demand from the platform's own App
key. The chain narrows at every hop:

```
App private key → app JWT (10 min, whole App)
                → installation token (1 h, one organization)
                → GHCR pull token (minutes, one repository, pull only)
```

Only the last leaves Ganymede. The platform host never holds a credential that
can do anything but pull the one image it was asked for.

Tag→digest resolution happens at registration (`resolveDigest`): a tenant
supplies a readable tag, GHCR answers the digest with one `HEAD`, and
`project_container_images.image_sha256` is `NOT NULL`. Demanding a digest from
the user would buy only friction.

**Each project is linked to a GitHub organization.** `projects` carries a
`github_organization` column (migration `003`), and a tenant image is legal only
under `ghcr.io/<github_organization>/`. Without that binding, project A could
register `ghcr.io/orgB/private` and, if its token happened to have access, the
platform would fetch it on A's behalf — the platform as confused deputy.

The check is a string comparison, so it holds before any network call and a
registry answering differently than expected cannot get around it. It runs
twice: at registration (`registerForProject`) and again in the broker
(`resolveImage`), the second time to catch a mistake in the first at the point
where the mistake would actually pull something. `NULL` means no link, which is
the correct state for a project that only runs built-in images.

The link is recorded by the App installation itself — GitHub returns
`account.login`, so `projects.github_organization` is never typed by hand.

What is still missing on this path is the **installation flow**: the routes that
send a user to GitHub to install the App and record the callback into
`github_app_installations`, and the UI to add an image to a project. The
resolution side — everything the broker touches — is written and tested.

Ganymede takes `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY` and `GITHUB_APP_SLUG`.
All three are optional: a deployment running only built-in images needs none of
them, and the internal route answers 503 rather than half-working when they are
absent.

Note the existing GitHub login OAuth is scoped `user:email`
(`routes/auth/github.ts:55`) and cannot read packages, so the login identity is
not reusable for pulls.

**Stage 3 — limits and lifecycle.** Limits done: the broker clamps every request
to host ceilings and refuses one carrying no limits at all. Reaping not started —
the signal exists (`last_watchdog_at`, `_periodic`) but nothing calls the
broker's `DELETE /containers/:id`.

Stage 1 deliberately runs a _known_ image, so that a failure there is a failure of
the runtime and not of the image.

## The image cache is an access-control surface

Worth stating on its own, because it looks like a caching question and is not.

The layer cache belongs to the host; a pull credential belongs to one project.
Once project A has pulled a private image, that image is local. If the broker
treated "already present" as "nothing to do", project B could name the same
digest and get it without ever proving it has access — and registering a known
digest in your own catalog costs nothing.

So the pull runs on **every** start, cached or not (`runtime.ts`,
`startContainer`). The layers are local and cheap; the manifest fetch still goes
to the registry, and that is the part that checks the token. `docker run` is
given `--pull=never` so it cannot quietly refetch with the host's ambient
credentials instead.

For the same reason each pull gets its own `--config` directory rather than a
shared `docker login`: one config for the whole host means two concurrent pulls
race, and the last writer lends its access to the other.

## Networks, kept independent of images

An image entry never names a network and a network never names an image. A
network references _running containers_, so two services can be wired together
long after both started — and a service that does not exist yet can be attached
when it does.

The floor is isolation, not connectivity. Every container starts on a private
network of its own: it reaches the outside (its gateway over VPN, a registry)
and reaches no sibling. Two services talk because someone attached both to a
shared network, which is a single gesture on a whiteboard — an edge between two
nodes.

That floor also closes a hole that predates the feature. Without `--network`,
Docker puts every container on the default bridge, where every container on the
host reaches every other by IP — **including another tenant's**. Verified in the
dev VM before the fix: a container labelled `project-B` fetched a page from one
labelled `project-A`. Kata would not have helped; it isolates the kernel, not
the L2 segment.

Broker surface, deliberately separate from `/containers`:

```
POST   /networks                              create, scoped to a project
POST   /networks/:name/members                attach a running container
DELETE /networks/:name/members/:container     detach
DELETE /networks/:name                        remove (Docker refuses if in use)
```

Attaching reads the project label off _both_ the network and the container,
from the runtime rather than from the request. That single check is what stops
a network from becoming a way across the tenant boundary; a cross-project
attach answers 403.

## What has been verified on a real runtime

`scripts/local-dev/verify-container-broker.sh` runs the whole broker path
against a live engine and reads the started container's privileges back out of
that engine rather than trusting the argv we believe we sent. It takes
`BROKER_ENGINE`, and both were run on one machine — an M1 Pro, macOS 26.5.2:

```
./verify-container-broker.sh                       # docker/runc  → 34 passed, 0 failed
BROKER_ENGINE=apple ./verify-container-broker.sh   # apple        → 35 passed, 0 failed
```

Common to both: authentication, every refusal, then a running container with
capabilities dropped to `ALL`, the cpu and memory limits applied, the reference
the catalog named, NET_ADMIN usable, SYS_ADMIN denied, the `SETTINGS` payload
intact, and a real cgroup `memory.max` read from inside. Plus networks — two
services isolated by default, and a network created on its own.

**Under `apple` the `guest` group finally says something.** Every one of those
checks happened inside a VM with its own kernel:

- `uname -r` → **6.18.15**, the Kata guest kernel, not the host's
- `/sys/fs/cgroup/memory.max` → 268435456 for a 256 MiB request
- `/dev/net/tun` present with **no device passed in** — the guest provides it,
  which is the assumption the whole `--device` policy rests on
- `ulimit -u` → 128, the nproc ceiling standing in for `pids.max`
- `SwapTotal` → 0

Two checks are skipped under `apple` and say so: attaching two running services
to a shared network, and the cross-project attach refusal, both unreachable
because there is no attach verb. The refusal itself is checked — 501, not a
silent success.

Three things changed in the harness while getting there, and all three were the
harness being wrong rather than the broker:

- The device expectation was fixed at "absent", which is only right under a
  microVM runtime. Under `docker`/`runc` the broker **deliberately** passes
  `/dev/net/tun`, because there is no guest kernel to get one from. The check
  now follows the runtime.
- `ip link add … type dummy` was standing in for "NET_ADMIN works". The Kata
  guest kernel has no dummy driver, so it answered `RTNETLINK: Not supported`
  on a container that did hold the capability. It is now `ip addr add`, checked
  on both engines to be denied without NET_ADMIN and allowed with it.
- The stub Ganymede could never produce a startable image, which is why
  thirteen checks had never run at all. It now serves nothing and the run goes
  through a **built-in** id, with a public image tagged under the built-in
  reference. What that still does not cover — and no offline run can — is the
  tenant path: a digest-pinned `ghcr.io` pull with a minted token.

This is where the capability policy was found to be wrong. `--cap-drop=ALL`
with only NET_ADMIN added back is the appealing design and it does not run
nginx: the entrypoint exits with `chown(…) failed (Operation not permitted)`.
Jupyter, n8n and pgAdmin all do the same thing — chown a data directory, then
drop to a non-root user. Hence `BASELINE_CAPABILITIES`, which is still narrower
than Docker's own default.

## What is not verified

Written and unit-tested is not the same as working. Specifically:

- **Nothing has run under Kata _via Docker_.** The Docker verification still
  runs under `runc`, so what it proves holds _except isolation from the host
  kernel_. Apple Silicon before M3 has no nested virtualisation: `/dev/kvm` is
  absent inside the dev VM on an M1, so `--runtime=kata` cannot start there.
  This still needs an x86 host, an M3+, or a cloud VM with nested
  virtualisation.

  What has changed is how much rides on it. The Apple engine runs the same
  broker against a real microVM at level 1, and the whole `guest` group passes
  there — so what remains unproven is narrowed to the Docker+Kata pairing
  itself, not the design it is there to serve.

- **The guest tun assumption is settled, and it was never about the rootfs.**
  The design holds that tun comes from the guest kernel rather than a host
  `/dev/net/tun` passthrough, and the broker refuses `--device` on that basis.

  The pinned release archive was downloaded and read. `configuration.toml`
  points at `configuration-qemu.toml`, which boots
  `vmlinux.container → vmlinux-6.18.15-186` — the same kernel Apple installs —
  from an **image**, not an initrd. That kernel ships `CONFIG_TUN=y`, built in
  rather than a module, with `CONFIG_DEVTMPFS=y` and `CONFIG_DEVTMPFS_MOUNT=y`.

  So nothing creates the node deliberately and nothing has to: a builtin TUN
  driver registers misc device 10:200 and devtmpfs materialises it. Which is
  precisely why it appeared under Apple `container`, booting that kernel with a
  different VMM, rootfs and agent — measured, `crw------- 10, 200`, no device
  passed in.

  The initrd path was checked separately, because `CONFIG_DEVTMPFS_MOUNT` does
  not cover initramfs boots: `kata-alpine-3.22.initrd` ships static nodes for
  null, zero, random, urandom and console but **not** net/tun, and its
  `/sbin/init` is the agent, whose string table carries `devtmpfs` beside
  `/dev`, `/dev/shm` and `/dev/pts`. The agent mounts it.

  All of that is read from shipped artefacts rather than from a boot. The task
  at the end of `roles/kata` is what turns it into a boot, and it has still
  never run — but its remaining failure modes are now narrow: a kernel swapped
  for one without `CONFIG_TUN`, or an agent that stops mounting devtmpfs.

- **A macOS deployment has no provisioning.** `infra/ansible` provisions a
  Linux host with systemd; the Apple engine was run from a shell. A Mac host
  needs a launchd equivalent, and the first `container system start` is
  interactive — it offers to install the guest kernel. A headless runner has to
  detect that and say so rather than block: observed, `container system start`
  hangs without writing a line and the launchd service exits 78 (`EX_CONFIG`).
- **The two jupyter digests.** `imageSha256` was dead code until now.
  `holistixforge/jupyterlab-minimal` and `-pytorch` are private on Docker Hub,
  so the recorded digests could not be checked from here. If they are stale the
  local runner will now fail the pull rather than silently start a different
  image — intended, but it is a behaviour change to the existing local mode and
  is worth confirming before release.
- **The Kata archive layout.** No longer a guess either. `roles/kata` installs
  from the upstream release because Ubuntu does not package Kata, unpacks at
  `/` and asserts `/opt/kata/bin/kata-runtime`. The arm64 archive was opened:
  every entry is under `./opt/`, `VERSION` reads 3.28.0, and `bin/` holds
  `kata-runtime` along with `containerd-shim-kata-v2` and `kata-monitor`. Both
  architectures exist at the pinned URLs, at the sizes the role documents.

  What is still unverified is the install _running_ — apt, zstd, the unarchive
  step, and registering the runtime with Docker. That needs a Linux host.

## What does not change

Worth stating, because it is what makes the two modes interchangeable:

- The `SETTINGS` payload (`runner.ts:42-66`)
- VPN attachment to the gateway
- Per-service FQDN routing — `_updateNginx` (`servers-reducer.ts:463-479`) routes
  `FQDN → container.ip:port` where `ip` is the **VPN** address the container
  publishes itself. Nothing in the routing path assumes where the container runs.

## Open questions

**Hypervisor backend.** Still open, but cheaper than it looked. The archive
ships `qemu-system-aarch64`, `cloud-hypervisor`, `firecracker` and `jailer` in
`/opt/kata/bin`, and a `configuration-*.toml` for each — so the choice is a
config edit on a host that already has Kata, not another install. Kata's own
default is QEMU.

What the decision still waits on is persistent storage: `generateCommand` emits
no `-v`, so user containers are ephemeral today. If Jupyter notebooks must
survive a restart, the volume story comes first and it constrains the backend —
filesystem sharing support differs between them.

**Egress policy.** See [above](#isolation-is-not-abuse-prevention).

**Image scanning.** Whether a tenant image is admitted on push, on first run, or
not at all.
