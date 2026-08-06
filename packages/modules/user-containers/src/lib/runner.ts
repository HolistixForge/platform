import { TJsonObject } from '@holistix-forge/simple-types';
import { TUserContainer } from './servers-types';
import { ContainerImageRegistry, imageReference } from './image-registry';

export type TRunnerConfig = {
  user_id: string;
  project_id: string;
  frontend_fqdn: string;
  ganymede_fqdn: string;
  gateway_fqdn: string;
  organization_id: string;
  /**
   * Secret for `container.auth_guard.client_id`.
   *
   * Passed alongside the container rather than on it: the container record
   * lives in collab shared state and is replicated to every client in the
   * project, so the secret must never be stored there.
   */
  auth_guard_client_secret?: string;
  /** What this container presents on the VPN. Short by necessity — see settings. */
  vpn_secret?: string;
  /**
   * Local development only: hosts to map, because `.local` names do not
   * resolve inside a container.
   *
   * Supplied by the caller rather than read from `process.env` here — module
   * packages are bundled with a browser `process` shim, so this file's
   * environment is empty at runtime in the gateway and the mapping was never
   * actually emitted.
   */
  dev_host_ip?: string;
};

/**
 * Caps a container runs under.
 *
 * Meaningless when the container runs on the user's own machine — it is their
 * CPU and their memory. On shared infrastructure they are mandatory, and a
 * microVM needs a fixed memory figure at boot rather than a ceiling it may
 * grow into.
 */
export type TContainerLimits = {
  cpus: number;
  memoryMb: number;
  pidsLimit: number;
};

export const DEFAULT_CONTAINER_LIMITS: TContainerLimits = {
  cpus: 2,
  memoryMb: 2048,
  pidsLimit: 512,
};

/**
 * Everything needed to start one container, resolved and validated.
 *
 * This is what a runner receives — never a command line, and never an image
 * URI chosen by the caller. `imageRef` has already been resolved from an
 * `image_id` against the registry, which is what makes the id an allowlist key
 * rather than a suggestion.
 */
export type TContainerLaunchSpec = {
  name: string;
  /**
   * The catalogue key, carried alongside the resolved reference.
   *
   * The platform runner sends this rather than `imageRef`: the broker
   * re-resolves it host-side, so a gateway cannot name an arbitrary image. The
   * local runner has no such boundary to defend — the command it emits runs on
   * the user's own machine — and uses `imageRef` directly.
   */
  imageId: string;
  imageRef: string;
  /** Base64 `SETTINGS` blob, the container's entire configuration channel. */
  settings: string;
  capabilities: string[];
  /**
   * Host devices to pass through.
   *
   * Empty under a microVM runtime: the guest has its own kernel, so tun comes
   * from the guest image rather than from the host's `/dev/net/tun`.
   */
  devices: string[];
  /** Extra host mappings, dev environments only. */
  extraHosts: { host: string; ip: string }[];
  limits: TContainerLimits;
};

/**
 * Abstract base class for container runners.
 * Provides command generation and container startup functionality.
 */
/**
 * The name a runtime knows this container by.
 *
 * Its own function because two operations need to agree on it and they are
 * written far apart: `buildLaunchSpec` names the container when it starts it,
 * and `stop` has to name the same one to reach it. Derived from the container
 * alone, so neither has to carry it.
 */
export const launchName = (container: TUserContainer): string => {
  const shortUuid = container.user_container_id.substring(0, 8);
  const safeName = container.container_name.replace(/[^a-zA-Z0-9_.-]/g, '_');
  return `holistix_${safeName}_${shortUuid}`;
};

export abstract class ContainerRunner {
  /**
   * Resolve a container into the spec a runtime can start it from.
   */
  buildLaunchSpec(
    container: TUserContainer,
    jwtToken: string,
    imageRegistry: ContainerImageRegistry,
    config: TRunnerConfig,
    limits: TContainerLimits = DEFAULT_CONTAINER_LIMITS
  ): TContainerLaunchSpec {
    // Scoped by project: that is where the pull credential lives, so the image
    // and the token that fetches it are resolved against the same thing.
    const imageDef = imageRegistry.get(container.image_id, config.project_id);
    if (!imageDef) {
      throw new Error(`Image ${container.image_id} not found in registry`);
    }

    // Create settings JSON
    const settings = {
      user_id: config.user_id,
      frontend_fqdn: config.frontend_fqdn,
      ganymede_fqdn: config.ganymede_fqdn,
      gateway_fqdn: config.gateway_fqdn,
      token: jwtToken,
      // What the container presents on the VPN, and deliberately *not* the
      // token above.
      //
      // OpenVPN carries a password in a fixed buffer — 128 bytes on the Alpine
      // build, more on the Ubuntu one, and `--max-password-size` only arrives
      // in 2.7. A hosting token is a JWT of some 740 bytes, so it was silently
      // truncated to 127 on one image and passed whole on another: the same
      // container refused or admitted depending on which base it was built
      // from, with the server reporting nothing but a wrong password.
      //
      // A short secret has no such ceiling, and keeps a bearer token out of
      // openvpn's memory and its scripts' environment, where it had no reason
      // to be.
      ...(config.vpn_secret ? { vpn_secret: config.vpn_secret } : {}),
      project_id: config.project_id,
      user_container_id: container.user_container_id,
      // Auth Guard Proxy config (per-container OAuth client registered with
      // Ganymede). The secret comes from the config, not the container: it is
      // never persisted in shared state.
      ...(container.auth_guard &&
        config.auth_guard_client_secret && {
          auth_guard: {
            client_id: container.auth_guard.client_id,
            client_secret: config.auth_guard_client_secret,
            container_id: container.user_container_id,
            organization_id: config.organization_id,
          },
        }),
    };

    // Base64 encode settings
    const json = JSON.stringify(settings);
    const env = Buffer.from(json).toString('base64');

    // Build --add-host entries for dev environments
    // In dev, containers can't resolve .local domains via DNS, so we map them
    // to the Docker bridge gateway IP which routes to the host/dev container
    const extraHosts: { host: string; ip: string }[] = [];
    if (config.dev_host_ip) {
      // Without the port. The FQDNs carry one wherever nginx does not listen
      // on 443 — every URL built from them is a link somebody follows — and a
      // hosts entry is not a URL: `ganymede.apollo.test:8443` is not a
      // hostname, and the broker refuses the whole start with "extra_hosts
      // entry has a malformed host". It is right to; the fix belongs here.
      //
      // The same distinction as the nginx `server_name`, which strips the port
      // for the same reason and would silently match nothing if it did not.
      const hostname = (fqdn: string) => fqdn.split(':')[0];
      extraHosts.push(
        { host: hostname(config.gateway_fqdn), ip: config.dev_host_ip },
        { host: hostname(config.ganymede_fqdn), ip: config.dev_host_ip }
      );
    }

    return {
      name: launchName(container),
      imageId: imageDef.imageId,
      imageRef: imageReference(imageDef),
      settings: env,
      // The container runs an OpenVPN client to reach its gateway.
      capabilities: ['NET_ADMIN'],
      devices: ['/dev/net/tun'],
      extraHosts,
      limits,
    };
  }

  /**
   * Generate Docker run command for a container.
   */
  generateCommand(
    container: TUserContainer,
    jwtToken: string,
    imageRegistry: ContainerImageRegistry,
    config: TRunnerConfig
  ): string {
    const spec = this.buildLaunchSpec(
      container,
      jwtToken,
      imageRegistry,
      config
    );

    const addHostFlags = spec.extraHosts
      .map((h) => `--add-host=${h.host}:${h.ip} `)
      .join('');
    const capFlags = spec.capabilities.map((c) => `--cap-add=${c} `).join('');
    const deviceFlags = spec.devices.map((d) => `--device ${d} `).join('');

    // Return Docker run command
    return (
      `docker run ${addHostFlags}--restart unless-stopped --name ${spec.name} ` +
      `-e SETTINGS=${spec.settings} ${capFlags}${deviceFlags}${spec.imageRef}`
    );
  }

  /**
   * Start a container.
   * Returns runner-specific data to be merged into container.runner in shared state.
   */
  abstract start(
    container: TUserContainer,
    jwtToken: string,
    imageRegistry: ContainerImageRegistry,
    config: TRunnerConfig
  ): Promise<TJsonObject>;

  /**
   * Stop a running container.
   *
   * A no-op by default, and that is the honest answer for a runner that does
   * not reach out to anything: the local runner hands a command to somebody
   * else's machine, and what stops a container there is its disappearance from
   * the placement list `app-runner` reconciles against — which the reducer
   * does by marking the container stopped, not by calling anything here.
   *
   * Not abstract, for the same reason: a runner that has nothing to do on stop
   * should not have to say so, and a `stop` that threw "not implemented" would
   * make the button dead again for exactly the runner where it works.
   */
  async stop(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    container: TUserContainer
  ): Promise<void> {
    return;
  }
}
