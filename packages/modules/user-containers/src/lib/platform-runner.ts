import { TJsonObject } from '@holistix-forge/simple-types';
import { log, EPriority } from '@holistix-forge/log';
import {
  ContainerRunner,
  TRunnerConfig,
  TContainerLimits,
  DEFAULT_CONTAINER_LIMITS,
} from './runner';
import { ContainerImageRegistry } from './image-registry';
import { TUserContainer } from './servers-types';

/**
 * What the gateway asks the broker for.
 *
 * Note what is absent: no command line, and no image URI. The broker is handed
 * an `image_id` scoped to an organization and resolves it against the
 * catalogue host-side.
 *
 * That asymmetry is the whole point. The gateway is the tenant-facing process
 * — it holds user JWTs and runs the reducer over user events — so it is the
 * one that must not be able to say "run this image with these flags". Mounting
 * a Docker socket into it would be the shortest path and the worst: it is
 * root-equivalent on the host. The Docker API over TLS authenticates the
 * caller without reducing what the caller can do.
 */
export type TBrokerStartRequest = {
  organization_id: string;
  project_id: string;
  user_container_id: string;
  name: string;
  image_id: string;
  /** Base64 `SETTINGS` blob — the container's whole configuration channel. */
  settings: string;
  capabilities: string[];
  devices: string[];
  extra_hosts: { host: string; ip: string }[];
  limits: TContainerLimits;
};

export type TBrokerStartResponse = {
  /** The runtime's own id for the container, for later stop/inspect calls. */
  container_id: string;
  /** Which platform host it landed on. */
  host: string;
  runtime: string;
  /**
   * Which container engine ran it — `docker` on Linux, `apple` on macOS.
   *
   * Optional because an older broker does not send it, and a gateway that
   * threw on the missing field would refuse to start containers on a host that
   * was working yesterday.
   */
  engine?: string;
  /**
   * Whether the container got its own kernel.
   *
   * Computed by the broker rather than derived here: what shares a kernel and
   * what does not is the broker's own knowledge, and a gateway matching
   * runtime names against a list would quietly call an unfamiliar one safe.
   */
  isolation?: 'microvm' | 'shared-kernel';
  /** Controls this deployment's engine cannot express, by id. */
  concessions?: string[];
};

/**
 * How the broker is reached. Injected so tests need no network, and so the
 * transport can be swapped (mTLS, unix socket) without touching the runner.
 */
export type TBrokerTransport = (
  request: TBrokerStartRequest
) => Promise<TBrokerStartResponse>;

export type TPlatformRunnerOptions = {
  endpoint?: string;
  token?: string;
  limits?: TContainerLimits;
  transport?: TBrokerTransport;
};

/**
 * Reach the broker over HTTP.
 *
 * The bearer token is the gateway's own credential, not a user's — the broker
 * authorizes the gateway, and the gateway has already authorized the user.
 */
const httpTransport =
  (endpoint: string, token: string): TBrokerTransport =>
  async (request) => {
    const response = await fetch(`${endpoint.replace(/\/$/, '')}/containers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(
        `Container broker refused the start (${response.status}): ${detail}`
      );
    }

    return (await response.json()) as TBrokerStartResponse;
  };

/**
 * Runs the container on the platform instead of on the user's machine.
 *
 * Everything that makes the container reachable is unchanged from the local
 * runner: the same `SETTINGS` payload, the same VPN attachment to its gateway,
 * the same per-service FQDN routing. `_updateNginx` routes to the VPN address
 * the container publishes itself, so nothing in the routing path knows or
 * cares where the container actually runs. That is what makes the two modes
 * interchangeable.
 */
export class PlatformRunnerBackend extends ContainerRunner {
  constructor(private readonly options: TPlatformRunnerOptions = {}) {
    super();
  }

  private transport(): TBrokerTransport {
    if (this.options.transport) return this.options.transport;

    // No fallback to process.env: module packages are bundled with a browser
    // `process` shim, so it is empty here and reading it would turn a
    // configuration mistake into a silent one. The endpoint and token come from
    // `gateway.environment`, which app-gateway fills from the real environment.
    const { endpoint, token } = this.options;
    if (!endpoint || !token) {
      throw new Error(
        'Platform runner is not configured: it needs a broker endpoint and token'
      );
    }

    return httpTransport(endpoint, token);
  }

  async start(
    container: TUserContainer,
    jwtToken: string,
    imageRegistry: ContainerImageRegistry,
    config: TRunnerConfig
  ): Promise<TJsonObject> {
    const limits = this.options.limits ?? DEFAULT_CONTAINER_LIMITS;
    const spec = this.buildLaunchSpec(
      container,
      jwtToken,
      imageRegistry,
      config,
      limits
    );

    const request: TBrokerStartRequest = {
      organization_id: config.organization_id,
      project_id: config.project_id,
      user_container_id: container.user_container_id,
      name: spec.name,
      image_id: spec.imageId,
      settings: spec.settings,
      capabilities: spec.capabilities,
      // Deliberately empty, where the local runner passes `/dev/net/tun`.
      //
      // `--device` is host device passthrough. Under a microVM runtime the
      // container has its own guest kernel, so tun must come from the guest
      // image; handing it the host's device node is at best meaningless and at
      // worst a hole punched straight through the isolation we run a microVM
      // for. NET_ADMIN stays, and is confined to the guest kernel.
      devices: [],
      // Deliberately empty too, and for a reason that is not the same one.
      //
      // These exist so a container can reach its gateway by FQDN before it has
      // a tunnel, in a development environment where that name is in no DNS.
      // But `--add-host` is not something every engine has: Apple `container`
      // has no equivalent, and the broker refuses a start carrying them rather
      // than dropping them silently — "engine apple cannot set extra hosts" —
      // which is right, because a container that needed them and did not get
      // them fails later and further away.
      //
      // The gateway cannot know which engine is on the other end, and should
      // not have to. Since dd0d0dd2 it does not need to: the container works
      // the host out from the gateway of its own network, on any engine,
      // without being told. So the platform runner sends none and lets the
      // container do it.
      //
      // The local runner still sends them. It builds a command for somebody
      // else's machine, where nothing has been arranged at all.
      //
      // The coupling this creates, stated so it is not discovered: the
      // platform runner is correct only while every image it can start
      // resolves the host itself. That code lives in the user-container base
      // image (`container-functions.sh`, `resolve_platform_hosts`), so a
      // catalogue image built on a different base, or one whose entrypoint
      // does not source it, has no way to reach its gateway by FQDN in a
      // development environment where those names are in no DNS. The
      // `--add-host` entries used to cover that case whatever the image was.
      // Closing it properly means the broker telling the gateway what its
      // engine can do *before* a start, rather than refusing after.
      extra_hosts: [],
      limits: spec.limits,
    };

    const result = await this.transport()(request);

    log(
      EPriority.Info,
      'PLATFORM_RUNNER',
      `Started container ${container.user_container_id} on ${result.host}`,
      {
        runtime: result.runtime,
        engine: result.engine,
        isolation: result.isolation,
        broker_container_id: result.container_id,
      }
    );

    // What comes back is merged into `container.runner` in shared state, which
    // is what puts it in front of the person whose code is running.
    //
    // That is the point of carrying it this far. The platform will have two
    // versions with different guarantees, and a deployment that isolates less
    // while the UI says nothing is the same silent failure the broker's "no
    // default runtime" rule exists to prevent — one level up, where the
    // consequence is a user believing they got a private kernel.
    //
    // `isolation` and `concessions` are omitted rather than defaulted when the
    // broker did not send them: absent is "this broker is older and did not
    // say", which the card can present as unknown. A default would invent an
    // answer, and the safe-looking default is the dangerous one.
    return {
      broker_container_id: result.container_id,
      host: result.host,
      runtime: result.runtime,
      ...(result.engine ? { engine: result.engine } : {}),
      ...(result.isolation ? { isolation: result.isolation } : {}),
      ...(result.concessions ? { concessions: result.concessions } : {}),
      limits: { ...spec.limits },
    };
  }
}
