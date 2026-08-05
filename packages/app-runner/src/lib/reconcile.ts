import {
  connectNetwork,
  disconnectNetwork,
  ensureNetwork,
  listOwned,
  removeContainer,
  startExisting,
  TDockerExec,
  TRunningContainer,
  LABEL_CONTAINER,
  LABEL_MACHINE,
  LABEL_PROJECT,
} from './docker';
import { TPlacement } from './placement';

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
    if (existing.image !== placement.imageRef) {
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

    for (const network of existing.networks) {
      // `bridge` is Docker's default and is not something a placement declares;
      // detaching from it is the point of having private networks at all.
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
  exec: TDockerExec,
  actions: TAction[],
  placements: TPlacement[],
  create: TCreateContainer
): Promise<void> => {
  const byId = new Map(placements.map((p) => [p.user_container_id, p]));

  // Networks first: attaching to one that does not exist fails, and a
  // container created into a missing network fails the same way.
  for (const network of new Set(placements.flatMap((p) => p.networks))) {
    await ensureNetwork(exec, network);
  }

  for (const action of actions) {
    const placement = byId.get(action.user_container_id);

    switch (action.action) {
      case 'keep':
        break;
      case 'start':
        await startExisting(exec, action.id);
        break;
      case 'create':
        if (placement) await create(placement);
        break;
      case 'recreate':
        await removeContainer(exec, action.id);
        if (placement) await create(placement);
        break;
      case 'attach':
        await connectNetwork(exec, action.network, action.id);
        break;
      case 'detach':
        await disconnectNetwork(exec, action.network, action.id);
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
  exec: TDockerExec,
  project_id: string,
  placements: TPlacement[],
  create: TCreateContainer
): Promise<TAction[]> => {
  const running = await listOwned(exec, project_id);
  const actions = planReconcile(placements, running);
  await applyReconcile(exec, actions, placements, create);
  return actions;
};
