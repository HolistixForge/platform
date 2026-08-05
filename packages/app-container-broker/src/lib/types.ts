/**
 * The broker's wire contract with the gateway.
 *
 * Mirrors `TBrokerStartRequest` in the user-containers module. Kept as its own
 * declaration rather than imported: the broker runs on the platform host, out
 * of reach of a compromised gateway, and a shared type would invite the two to
 * drift into trusting each other.
 */
export type TStartRequest = {
  organization_id: string;
  project_id: string;
  user_container_id: string;
  name: string;
  image_id: string;
  settings: string;
  capabilities: string[];
  devices: string[];
  extra_hosts: { host: string; ip: string }[];
  limits: {
    cpus: number;
    memoryMb: number;
    pidsLimit: number;
  };
};

export type TStartResponse = {
  container_id: string;
  host: string;
  runtime: string;
  engine: string;
  /**
   * Whether this container got its own kernel, computed rather than named.
   *
   * The gateway must not have to know that `runc` shares one and `kata` does
   * not, or that every Apple container is a VM whatever its runtime handler is
   * called. That mapping lives in the engine, so the answer travels instead of
   * the inputs to it — a frontend matching runtime strings would silently call
   * a new runtime safe.
   */
  isolation: 'microvm' | 'shared-kernel';
  /**
   * What this deployment gave up, by id.
   *
   * Sent so the platform can show it. A Mac host that isolates differently and
   * a UI that says nothing is the silent failure the "no default runtime" rule
   * exists to prevent — the same failure one level up, where the person whose
   * code is running cannot see which guarantee they got.
   */
  concessions: string[];
};

/**
 * How a container engine is actually invoked.
 *
 * Injected so the argv-building and policy layers can be tested without a
 * container runtime, and so either engine's front-end can be swapped in
 * without touching them.
 *
 * `stdin` exists for one caller: Apple `container registry login` takes its
 * password only from standard input. A registry token is therefore never an
 * argv element, where it would be visible in `ps` to every user on the host.
 *
 * Declared here rather than beside `engineExec` so that `engine.ts` and
 * `runtime.ts` can both name it without importing each other.
 */
export type TRuntimeExec = (args: string[], stdin?: string) => Promise<string>;

/**
 * A catalogue entry, as the broker resolves it.
 *
 * The gateway never sends this — it sends an `image_id`, and the broker looks
 * the reference up itself. That is the difference between a gateway that can
 * pick from a list and a gateway that can run anything on the host.
 */
export type TResolvedImage = {
  imageId: string;
  /** Fully qualified, digest-pinned: `repo:tag@sha256:…`. */
  reference: string;
  /**
   * Short-lived registry bearer for this pull, scoped to this repository.
   *
   * Minted by Ganymede from the project's stored `github_token`, so the PAT
   * itself never reaches this host. Absent for built-in images, which are ours
   * and need no tenant credential.
   */
  pullToken?: string;
  /**
   * The GitHub organization the project is linked to.
   *
   * Present exactly when `pullToken` is: a tenant image is legal only under
   * `ghcr.io/<githubOrganization>/`, and the broker re-checks that rather than
   * taking the reference on trust. Ganymede has already applied the rule; this
   * catches a mistake in that logic at the point where it would do damage.
   */
  githubOrganization?: string;
  /**
   * An image the platform ships, rather than one a tenant registered.
   *
   * Stated rather than inferred from the absence of a pull token: the digest
   * requirement and the always-pull rule both turn on it, and "no token" would
   * equally describe a tenant image whose credential failed to mint.
   */
  builtin?: boolean;
};

export type TBrokerConfig = {
  /**
   * Which container engine speaks to the host: `docker` or `apple`.
   *
   * No default, for the same reason `runtime` has none. The two engines do not
   * grant the same things — see `ENGINE_CONCESSIONS` — so a broker that picked
   * one on its own would decide a security question by guessing which binary
   * was installed.
   */
  engine: string;
  /** Container runtime to hand every start to, e.g. `kata`. */
  runtime: string;
  /**
   * Controls the selected engine cannot express, named one by one.
   *
   * The engine declares what it cannot do; the operator has to write each one
   * down before the broker will serve. An unacknowledged concession, or an
   * acknowledgement of something the engine does support, is a refusal to
   * start. See `assertConcessionsAccepted`.
   */
  acceptedConcessions: string[];
  /** Hostname reported back to the gateway. */
  hostname: string;
  /** Shared secret the gateway authenticates with. */
  token: string;
  port: number;
  /** Ceilings a request may not exceed, whatever it asks for. */
  maxLimits: {
    cpus: number;
    memoryMb: number;
    pidsLimit: number;
  };
};

/**
 * Capabilities every container gets, on top of `--cap-drop=ALL`.
 *
 * Dropping everything and granting only what a request asks for is the
 * appealing version, and it does not survive contact with real images: nginx,
 * Jupyter, n8n and pgAdmin all chown their data directories at startup and then
 * drop to a non-root user. Without CHOWN and SETUID/SETGID they exit before
 * doing anything, with `chown(…) failed (Operation not permitted)`.
 *
 * So: the smallest set that lets a conventional entrypoint set itself up. What
 * stays dropped is what matters —
 *
 *   SYS_ADMIN, SYS_MODULE, SYS_RAWIO, SYS_PTRACE, SYS_BOOT, SYS_TIME
 *     the ones that reach the kernel or other processes
 *   MKNOD        creating device nodes
 *   NET_RAW      raw sockets: packet spoofing, ARP games, scanning
 *   SYS_CHROOT, AUDIT_WRITE, SETFCAP
 *
 * Docker's own default grants MKNOD, NET_RAW, SYS_CHROOT, AUDIT_WRITE and
 * SETFCAP as well. This is narrower than the default, not wider.
 */
export const BASELINE_CAPABILITIES = [
  'CHOWN',
  'DAC_OVERRIDE',
  'FOWNER',
  'FSETID',
  'SETGID',
  'SETUID',
  // Needed by an entrypoint that drops its own capabilities before exec'ing
  // the real process — su-exec, gosu and tini all do this.
  'SETPCAP',
  'KILL',
  'NET_BIND_SERVICE',
  // Raw sockets, which ping needs. Dropping it looked like a clean win — it
  // takes away packet spoofing and scanning — and it broke the containers'
  // own bootstrap, which pings its gateway to decide whether the VPN came up.
  // Docker grants it by default; taking it away needs the bootstrap changed
  // first, not the capability removed and the breakage discovered later.
  'NET_RAW',
];

/**
 * Capabilities a request may ask for beyond the baseline.
 *
 * NET_ADMIN alone: the container runs an OpenVPN client to reach its gateway.
 * Under a microVM runtime that capability applies to the guest kernel, not the
 * host's, which is most of the reason for running one.
 */
export const ALLOWED_CAPABILITIES = ['NET_ADMIN'];

/**
 * Runtimes that give each container its own kernel.
 *
 * The distinction decides where `/dev/net/tun` comes from. The container runs
 * an OpenVPN client to reach its gateway, so it needs a tun device either way:
 * under a microVM the guest kernel provides one, and passing the host's in
 * would punch through the isolation the microVM exists for. Under a
 * shared-kernel runtime there is no guest kernel, so the host device is the
 * only source — OpenVPN otherwise connects to its peer and then exits.
 *
 * A request still cannot ask for a device. This is decided here, from the
 * broker's own runtime, which the caller has no say over.
 */
export const MICROVM_RUNTIMES = [
  'kata',
  'kata-runtime',
  'kata-qemu',
  'kata-fc',
];
