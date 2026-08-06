import { randomUUID } from 'node:crypto';

import { dockerExec, listOwned, removeContainer, TDockerExec } from './docker';
import { TPlacement } from './placement';
import { planReconcile, reconcile, runArgs } from './reconcile';
import { dockerEngine } from './engine-docker';

/**
 * The reconcile loop against a real Docker daemon.
 *
 * The unit tests next door check the decisions; they cannot check that
 * `docker inspect` returns the fields this code reads, that a label survives a
 * restart, or that `network connect` really does work on a running container —
 * which the whole "reattach rather than recreate" rule rests on. Those are the
 * things that are only ever true because someone ran them.
 *
 * Skipped unless RUNNER_DOCKER_TESTS=1: it needs a daemon and it pulls an
 * image, neither of which belongs in a default `nx test`.
 */

const enabled = process.env.RUNNER_DOCKER_TESTS === '1';
const describeDocker = enabled ? describe : describe.skip;

// busybox, digest-pinned like a real placement — the guard in placement.ts
// refuses anything else, and a test that used a bare tag would be exercising a
// shape the runner never accepts.
const IMAGE =
  'busybox@sha256:dc2d74b28e4cf8984fa52af1f39bc7c3d9c73760b41a74d629f5d11b1ab28616';

describeDocker('reconcile against a real daemon', () => {
  const exec: TDockerExec = dockerExec();
  const project_id = `test-${randomUUID()}`;
  const machine_id = 'machine-under-test';
  const network = `holistix-test-${randomUUID().slice(0, 8)}`;
  const secondNetwork = `${network}-b`;
  const created: string[] = [];

  const placement = (overrides: Partial<TPlacement> = {}): TPlacement => ({
    machine_id,
    project_id,
    user_container_id: 'container-1',
    name: `holistix_test_${randomUUID().slice(0, 8)}`,
    imageRef: IMAGE,
    settings: 'eyJ9',
    // Nothing exotic: this is about the reconcile mechanics, and NET_ADMIN
    // would need a tun device the test image has no use for.
    capabilities: [],
    devices: [],
    extraHosts: [],
    networks: [network],
    ...overrides,
  });

  const create = async (p: TPlacement) => {
    // `sleep` so the container stays running long enough to be reconciled,
    // which is the state every assertion below is about.
    const id = (
      await exec([...runArgs(p, machine_id), 'sleep', '3600'])
    ).trim();
    created.push(id);
    return id;
  };

  // Containers first, then networks: docker refuses to remove a network that
  // still has something attached, and a removal attempted from inside a test —
  // while the container is still on it — fails quietly and leaves the network
  // on the developer's machine.
  afterAll(async () => {
    for (const id of created) {
      await removeContainer(exec, id).catch(() => undefined);
    }
    for (const name of [network, secondNetwork]) {
      await exec(['network', 'rm', name]).catch(() => undefined);
    }
  }, 60_000);

  it('should create, label and find its own containers', async () => {
    // Arrange
    const p = placement();

    // Act
    const actions = await reconcile(
      dockerEngine,
      exec,
      project_id,
      [p],
      create
    );
    const owned = await listOwned(exec, project_id);

    // Assert - the labels are what make a second pass possible at all
    expect(actions.map((a) => a.action)).toEqual(['create']);
    expect(owned).toHaveLength(1);
    expect(owned[0].user_container_id).toBe('container-1');
    expect(owned[0].state).toBe('running');
    expect(owned[0].networks).toContain(network);
  }, 120_000);

  it('should leave a container that already matches untouched', async () => {
    // Arrange
    const p = placement();
    const before = (await listOwned(exec, project_id))[0];

    // Act - the same placement again, which is the normal steady state
    const actions = await reconcile(
      dockerEngine,
      exec,
      project_id,
      [p],
      create
    );
    const after = (await listOwned(exec, project_id))[0];

    // Assert - same container id, so nothing was recreated behind the user's back
    expect(actions).toEqual([expect.objectContaining({ action: 'keep' })]);
    expect(after.id).toBe(before.id);
  }, 60_000);

  it('should restart a container that stopped rather than replace it', async () => {
    // Arrange - a laptop that was closed
    const p = placement();
    const before = (await listOwned(exec, project_id))[0];
    await exec(['stop', before.id]);

    // Act
    const actions = await reconcile(
      dockerEngine,
      exec,
      project_id,
      [p],
      create
    );
    const after = (await listOwned(exec, project_id))[0];

    // Assert - the same container, running again
    expect(actions).toEqual([expect.objectContaining({ action: 'start' })]);
    expect(after.id).toBe(before.id);
    expect(after.state).toBe('running');
  }, 120_000);

  it('should attach a running container to a network added later', async () => {
    // Arrange - this is the claim the "reattach rather than recreate" rule
    // rests on, and it is only true because docker allows it on a live container
    const before = (await listOwned(exec, project_id))[0];

    // Act
    const actions = await reconcile(
      dockerEngine,
      exec,
      project_id,
      [placement({ networks: [network, secondNetwork] })],
      create
    );
    const after = (await listOwned(exec, project_id))[0];

    // Assert
    expect(actions.map((a) => a.action)).toContain('attach');
    expect(after.id).toBe(before.id);
    expect(after.networks).toEqual(
      expect.arrayContaining([network, secondNetwork])
    );
  }, 120_000);

  it('should detach a network the placement stopped declaring', async () => {
    // Arrange - the container is on two, the placement now names one
    const before = (await listOwned(exec, project_id))[0];

    // Act
    const actions = await reconcile(
      dockerEngine,
      exec,
      project_id,
      [placement()],
      create
    );
    const after = (await listOwned(exec, project_id))[0];

    // Assert
    expect(actions.map((a) => a.action)).toContain('detach');
    expect(after.id).toBe(before.id);
    expect(after.networks).toEqual([network]);
  }, 120_000);

  it('should recreate when the image no longer matches', async () => {
    // Arrange
    const before = (await listOwned(exec, project_id))[0];

    // Act - a different digest for the same repository
    const other =
      'busybox@sha256:2e46a5cc1f0d9d0cb54f7d97b21b1e46a5cc1f0d9d0cb54f7d97b21b1e460000';
    const actions = planReconcile(
      [placement({ imageRef: other })],
      await listOwned(exec, project_id)
    );

    // Assert - planned only: pulling a digest that does not exist would fail
    // for a reason that has nothing to do with what is being checked here
    expect(actions).toEqual([
      expect.objectContaining({ action: 'recreate', id: before.id }),
    ]);
  }, 60_000);

  it('should not see another project’s containers', async () => {
    // Act
    const owned = await listOwned(exec, `${project_id}-other`);

    // Assert - the label filter is what keeps one project's reconciliation
    // from tearing down another's work on a shared machine
    expect(owned).toEqual([]);
  }, 60_000);
});
