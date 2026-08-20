/**
 * A stack: several containers started together, of which only some are reachable.
 *
 * The shape of a single service is already right — a container publishes
 * `map-http-service` per door it wants a name for, and the gateway writes one
 * nginx block per entry at `{service}.uc-{cid}.org-{oid}.{domain}`. Nothing in
 * that path assumes one container has one door, so a stack needs no new
 * routing: it needs a way to say which of its services get a name at all.
 *
 * What this deliberately is *not* is a compose file.
 *
 * `image_id` is an allowlist key, not a label: the broker "never accepts a
 * command line, and never accepts a bare image URI from the gateway"
 * (CLOUD_RUNNER.md), it resolves an id against the catalogue and composes the
 * run itself. A compose file is a command line — it carries `privileged`,
 * `volumes`, `network_mode`, `cap_add`, `devices` — so a tenant-supplied one
 * hands back everything that id was protecting. This is a declaration of what
 * runs and what is reachable; the runner composes the invocation from it, the
 * same way the broker already does for one container.
 */

/** A door of a stack service that gets a name on the project's domain. */
export type TStackExposedPort = {
  /**
   * The name this door answers on, as a DNS label under the stack's FQDN.
   *
   * `main` and `default` are the base name `uc-{cid}.org-{oid}.{domain}` —
   * `generateServiceFQDN` treats them so — and anything else is a subdomain of
   * it. That function does not sanitise, so a name with a dot in it would
   * quietly add a label and land somewhere nobody asked for. Checked here
   * instead, where it is still a catalogue entry and not yet a route.
   */
  name: string;
  /** The port inside the service's container. */
  port: number;
  /** Whether the door speaks TLS. Matches `httpServices[].secure`. */
  secure?: boolean;
};

/**
 * A directory kept in step between the working tree and a running service.
 *
 * The point of running a stack on your own machine is that you are editing it,
 * so the runner rsyncs rather than baking a copy at start: the container holds
 * what the tree holds now, not what it held when the stack came up.
 */
export type TStackSync = {
  /**
   * Where in the repository, relative to the manifest.
   *
   * Relative and inside, checked rather than trusted. The manifest is a file in
   * a repository somebody cloned, and it is read by a script they pasted into a
   * terminal — an absolute path or one climbing out with `..` would rsync
   * whatever it named on that machine into a container.
   */
  from: string;
  /** Where in the container. Absolute. */
  to: string;
};

/** One container of a stack. */
export type TContainerStackService = {
  /**
   * How the rest of the stack addresses this service.
   *
   * Also its hostname on the stack's private network, which is what makes a
   * non-exposed service usable at all: the interface reaches its database by
   * this name and nobody outside can.
   */
  serviceName: string;
  /**
   * The catalogue id of the image this service runs.
   *
   * An id, not a URI, and resolved against the same `ContainerImageRegistry` as
   * a lone container. That is what carries the guarantees sideways: a tenant
   * image inside a stack was still registered under
   * `ghcr.io/<githubOrganization>/` and still had to be digest-pinned, because
   * it went through `registerForProject` like any other.
   */
  imageId: string;
  /**
   * The doors that get a name. Absent or empty means the service runs and is
   * reachable only from inside the stack.
   *
   * Not exposed is the default on purpose. The alternative — publish
   * everything, let the operator subtract — makes a forgotten line the
   * difference between a private database and a public one.
   */
  exposes?: TStackExposedPort[];
  /** Directories kept in step with the working tree while the stack runs. */
  sync?: TStackSync[];
};

/** A stack, as the catalogue holds it. */
export type TContainerStackDefinition = {
  stackId: string;
  stackName: string;
  description?: string;
  category?: string;
  icon?: string;
  services: TContainerStackService[];
};

/** Simplified stack info for the frontend, mirroring `TContainerImageInfo`. */
export type TContainerStackInfo = {
  stackId: string;
  stackName: string;
  description?: string;
};

/**
 * Every door of a stack that gets a name, with the service it belongs to.
 *
 * One place to ask, because two will disagree: the runner needs it to know
 * what to announce, and validation needs it to know what would collide.
 */
export const stackExposedPorts = (
  stack: TContainerStackDefinition
): { serviceName: string; expose: TStackExposedPort }[] =>
  stack.services.flatMap((service) =>
    (service.exposes ?? []).map((expose) => ({
      serviceName: service.serviceName,
      expose,
    }))
  );
