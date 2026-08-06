import {
  TDockerExec,
  TRunningContainer,
  LABEL_CONTAINER,
  LABEL_MACHINE,
  LABEL_PROJECT,
} from './docker';
import { TPlacement } from './placement';
import { TRunnerEngine, UnsupportedByEngine } from './engine';

/**
 * Bring what is running into line with what was placed — by comparing, not by
 * starting from scratch.
 *
 * Recreating everything each pass is simpler to write and wrong to run: it
 * kills sessions nobody asked to lose, drops whatever the container held in
 * memory, and makes a routine reconciliation indistinguishable from an
 * outage. A container that already matches its placement is left strictly
 * alone — including its uptime.
 */

export type TAction =
  | { action: 'create'; user_container_id: string; reason: string }
  | { action: 'start'; user_container_id: string; id: string; reason: string }
  | {
      action: 'recreate';
      user_container_id: string;
      id: string;
      reason: string;
    }
  | { action: 'attach'; user_container_id: string; id: string; network: string }
  | { action: 'detach'; user_container_id: string; id: string; network: string }
  | { action: 'keep'; user_container_id: string; id: string };

/**
 * Whether a running container holds the image its placement asks for.
 *
 * Not a string comparison, because the engines do not agree on how to spell a
 * reference back. Measured on Apple `container` 1.2.0: started with
 * `docker.io/library/alpine:3@sha256:28bd5f…`, `inspect` reports
 * `docker.io/library/alpine@sha256:28bd5f…` — the tag is dropped. Placements
 * are digest-pinned in `repo:tag@sha256:…` form, so byte-for-byte the two
 * never match, every pass emitted `recreate`, and any service placed on a Mac
 * restarted once per interval forever without ever converging.
 *
 * The digest is what actually identifies an image; the tag is a label somebody
 * can move. So when both sides carry one it decides, and anything else falls
 * back to the exact comparison — an unpinned reference says nothing about
 * content and must not be treated as equal to a different unpinned one.
 */
const sameImage = (running: string, placed: string): boolean => {
  if (running === placed) return true;

  /** `registry:5000/acme/thing:v1@sha256:…` → repository and digest. */
  const split = (ref: string) => {
    const [nameAndTag, digest] = ref.split('@');
    const colon = nameAndTag.lastIndexOf(':');
    const slash = nameAndTag.lastIndexOf('/');
    // A colon after the last slash is a tag; before it, a registry port.
    const repository = colon > slash ? nameAndTag.slice(0, colon) : nameAndTag;
    return { repository, digest };
  };

  const a = split(running);
  const b = split(placed);
  return (
    Boolean(a.digest && b.digest) &&
    a.digest === b.digest &&
    a.repository === b.repository
  );
};

/**
 * Decide what to do, without doing any of it.
 *
 * Separated from the execution below so the decision can be tested against a
 * table of states rather than against a Docker daemon, and so a dry run is the
 * same code path as a real one.
 */
export const planReconcile = (
  placements: TPlacement[],
  running: TRunningContainer[]
): TAction[] => {
  const byContainerId = new Map(
    running
      .filter((c) => c.user_container_id)
      .map((c) => [c.user_container_id as string, c])
  );

  const actions: TAction[] = [];

  for (const placement of placements) {
    const existing = byContainerId.get(placement.user_container_id);

    if (!existing) {
      actions.push({
        action: 'create',
        user_container_id: placement.user_container_id,
        reason: 'no container for this placement',
      });
      continue;
    }

    // The image is the one thing that cannot be changed on a container that
    // already exists. Everything else below is adjustable in place.
    if (!sameImage(existing.image, placement.imageRef)) {
      actions.push({
        action: 'recreate',
        user_container_id: placement.user_container_id,
        id: existing.id,
        reason: `image is ${existing.image}, placement asks for ${placement.imageRef}`,
      });
      continue;
    }

    if (existing.state !== 'running') {
      actions.push({
        action: 'start',
        user_container_id: placement.user_container_id,
        id: existing.id,
        reason: `container is ${existing.state}`,
      });
    } else {
      actions.push({
        action: 'keep',
        user_container_id: placement.user_container_id,
        id: existing.id,
      });
    }

    // `docker network connect` works on a running container, so a container on
    // the wrong network is reattached rather than replaced — the one case
    // where recreating would be pure loss for no gain.
    const attached = new Set(existing.networks);
    for (const network of placement.networks) {
      if (!attached.has(network)) {
        actions.push({
          action: 'attach',
          user_container_id: placement.user_container_id,
          id: existing.id,
          network,
        });
      }
    }

    // A placement that names no network is not a placement asking for a
    // container on no network at all.
    //
    // Those two readings differ, and only the first is ever useful: a container
    // detached from everything cannot reach its gateway, or anything else.
    // Local placements name none today — nothing allocates a private network
    // for a container on somebody's own machine — so under Docker the pass
    // would have run `network disconnect bridge` and cut the container off,
    // and on Apple, where a live detach is refused, it would have rebuilt the
    // container once per interval forever.
    //
    // So an empty list means "no opinion", and detaching only happens once a
    // placement has actually said which networks it wants.
    if (placement.networks.length > 0) {
      for (const network of existing.networks) {
        // `bridge` is Docker's default and is not something a placement
        // declares; detaching from it is the point of having private networks
        // at all.
        if (!placement.networks.includes(network)) {
          actions.push({
            action: 'detach',
            user_container_id: placement.user_container_id,
            id: existing.id,
            network,
          });
        }
      }
    }
  }

  return actions;
};

export type TCreateContainer = (placement: TPlacement) => Promise<string>;

/**
 * Carry out a plan.
 *
 * Creation is injected: it is the one step with a long argument list and a
 * pull behind it, and keeping it out of here means the rest can be exercised
 * without a registry.
 */
export const applyReconcile = async (
  engine: TRunnerEngine,
  exec: TDockerExec,
  actions: TAction[],
  placements: TPlacement[],
  create: TCreateContainer
): Promise<void> => {
  const byId = new Map(placements.map((p) => [p.user_container_id, p]));

  // Which containers this pass has already rebuilt.
  //
  // A rebuild is how an engine that cannot move a network on a live container
  // gets one onto the right networks — and it puts the container on *all* of
  // them at once, so the second network action for the same container has
  // nothing left to do. Worse, it would act on `action.id`, the identifier from
  // before the rebuild: `delete` on a container that no longer exists throws,
  // and the throw aborts the whole pass, leaving every placement after it
  // unconverged. Measured as a service on two networks restarting on every
  // interval and never converging.
  const rebuilt = new Set<string>();

  // Networks first: attaching to one that does not exist fails, and a
  // container created into a missing network fails the same way.
  for (const network of new Set(placements.flatMap((p) => p.networks))) {
    await engine.ensureNetwork(exec, network);
  }

  for (const action of actions) {
    const placement = byId.get(action.user_container_id);

    switch (action.action) {
      case 'keep':
        break;
      case 'start':
        await engine.startExisting(exec, action.id);
        break;
      case 'create':
        if (placement) await create(placement);
        break;
      case 'recreate':
        await engine.removeContainer(exec, action.id);
        if (placement) await create(placement);
        break;
      // An engine that cannot move a network on a live container recreates
      // instead. The plan stays engine-agnostic — what a placement *should*
      // look like does not depend on what started it — and the substitution
      // happens once, here, where the refusal arrives.
      //
      // It costs a restart the Docker path does not pay. That is the
      // `no-hot-network-attach` concession, and paying it is better than
      // leaving a container on a network its placement no longer names while
      // every log line says the pass converged.
      case 'attach':
      case 'detach':
        // Already rebuilt for an earlier network in this pass, and a rebuild
        // creates the container into every network the placement names — so
        // there is nothing left to do, and the identifier this action carries
        // no longer refers to anything.
        if (rebuilt.has(action.user_container_id)) break;
        try {
          await (action.action === 'attach'
            ? engine.connectNetwork(exec, action.network, action.id)
            : engine.disconnectNetwork(exec, action.network, action.id));
        } catch (error) {
          if (!(error instanceof UnsupportedByEngine)) throw error;
          rebuilt.add(action.user_container_id);
          await engine.removeContainer(exec, action.id);
          if (placement) await create(placement);
        }
        break;
    }
  }
};

/**
 * The arguments a placement becomes.
 *
 * The labels are what makes the next reconciliation possible at all: without
 * them this runner cannot tell its own containers from anything else on the
 * machine, and "reconcile" would mean "inspect every container the user has".
 */
export const runArgs = (
  placement: TPlacement,
  machine_id: string
): string[] => [
  'run',
  '--detach',
  '--restart',
  'unless-stopped',
  '--name',
  placement.name,
  '--label',
  `${LABEL_PROJECT}=${placement.project_id}`,
  '--label',
  `${LABEL_CONTAINER}=${placement.user_container_id}`,
  '--label',
  `${LABEL_MACHINE}=${machine_id}`,
  // The container's whole configuration channel, and the reason it can find
  // its gateway.
  '--env',
  `SETTINGS=${placement.settings}`,
  ...placement.capabilities.flatMap((c) => ['--cap-add', c]),
  ...placement.devices.flatMap((d) => ['--device', d]),
  ...placement.extraHosts.flatMap((h) => ['--add-host', `${h.host}:${h.ip}`]),
  // Only the first network can be given at creation; the rest are attached
  // afterwards, which is what the plan above emits.
  ...(placement.networks[0] ? ['--network', placement.networks[0]] : []),
  placement.imageRef,
];

export const reconcile = async (
  engine: TRunnerEngine,
  exec: TDockerExec,
  project_id: string,
  placements: TPlacement[],
  create: TCreateContainer
): Promise<TAction[]> => {
  const running = await engine.listOwned(exec, project_id);
  const actions = planReconcile(placements, running);
  await applyReconcile(engine, exec, actions, placements, create);
  return actions;
};
