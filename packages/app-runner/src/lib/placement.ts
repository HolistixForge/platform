/**
 * What the platform asks this machine to run, and whether it may.
 *
 * The broker refuses a request from one project that names another project's
 * container; this is the same check pointed the other way. A runner executes
 * what the platform sends it, and what it sends is eventually an Ansible
 * playbook — which has `shell`, `command` and `raw`. Opting a laptop into a
 * project means agreeing to run that project's workloads on it, and nothing
 * else's.
 */

export type TPlacement = {
  /** Which machine this is for. */
  machine_id: string;
  project_id: string;
  user_container_id: string;
  name: string;
  /** Fully qualified image reference, resolved platform-side. */
  imageRef: string;
  /**
   * Whether `imageRef` is one of the platform's own images rather than a
   * tenant's. Decides whether it has to be digest-pinned — see below.
   *
   * Optional, because a gateway that predates this field sends nothing and the
   * safe reading of nothing is "tenant", which keeps the stricter rule.
   */
  builtin?: boolean;
  /** Base64 SETTINGS blob — the container's entire configuration channel. */
  settings: string;
  capabilities: string[];
  devices: string[];
  extraHosts: { host: string; ip: string }[];
  /** Private networks this container belongs to, by name. */
  networks: string[];
};

export class PlacementRefused extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'PlacementRefused';
  }
}

/**
 * The local counterpart of the broker's cross-project check.
 *
 * @param placement what arrived
 * @param machine_id who this runner is, from its own credentials — never from
 *   the placement, or the check would be asking the message to vouch for itself
 * @param projects the projects this machine has been opted into
 */
export const assertPlacementIsForUs = (
  placement: TPlacement,
  machine_id: string,
  projects: ReadonlySet<string>
): void => {
  if (!placement.machine_id) {
    throw new PlacementRefused('Placement names no machine');
  }

  // A placement that names another machine is not a message to act on
  // charitably. It reached the wrong runner, and the only safe reading is that
  // something upstream is confused about which machine is which.
  if (placement.machine_id !== machine_id) {
    throw new PlacementRefused(
      `Placement is for machine ${placement.machine_id}, this is ${machine_id}`
    );
  }

  if (!placement.project_id) {
    throw new PlacementRefused('Placement names no project');
  }

  // Enrolment is per machine; consent is per project. A runner reachable by a
  // project it was never placed into would let any project on the platform run
  // a playbook on someone's laptop.
  if (!projects.has(placement.project_id)) {
    throw new PlacementRefused(
      `This machine is not opted into project ${placement.project_id}`
    );
  }

  if (!placement.imageRef) {
    throw new PlacementRefused('Placement names no image');
  }

  // Tenant images only, which is the same line the broker draws in
  // `catalogue.ts` — `!resolved.builtin && !DIGEST_PINNED.test(…)`.
  //
  // The reference is resolved platform-side and digest-pinned there. A bare
  // name reaching here means the resolution did not happen, and starting it
  // would pull whatever that tag points at today. That holds for a tenant
  // image: the registry refuses to record one without an `imageSha256`, so an
  // unpinned tenant reference is always a fault.
  //
  // It does not hold for a built-in. Those come from the deployment's own
  // catalogue, change when the platform is redeployed rather than when a tenant
  // pushes, and have no digest recorded — pinning them would mean a redeploy
  // for every image bump while closing nothing a tenant could exploit.
  // Applied to both, this refused every placement of the default terminal
  // image, which is the first thing anybody puts on their own machine.
  if (!placement.builtin && !/@sha256:[0-9a-f]{64}$/.test(placement.imageRef)) {
    throw new PlacementRefused(
      `Image reference is not digest-pinned: ${placement.imageRef}`
    );
  }
};
