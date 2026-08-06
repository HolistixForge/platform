import { TRunningContainer } from './docker';
import { TPlacement } from './placement';
import { applyReconcile, planReconcile, runArgs } from './reconcile';
import { dockerEngine } from './engine-docker';
import { appleEngine } from './engine-apple';

const DIGEST =
  '@sha256:0000000000000000000000000000000000000000000000000000000000000000';
const IMAGE = `ghcr.io/acme/thing:v1${DIGEST}`;

const placement = (overrides: Partial<TPlacement> = {}): TPlacement => ({
  machine_id: 'machine-1',
  project_id: 'project-1',
  user_container_id: 'container-1',
  name: 'holistix_thing_abc',
  imageRef: IMAGE,
  settings: 'eyJ9',
  capabilities: ['NET_ADMIN'],
  devices: ['/dev/net/tun'],
  extraHosts: [],
  networks: ['proj-1-default'],
  ...overrides,
});

const running = (
  overrides: Partial<TRunningContainer> = {}
): TRunningContainer => ({
  id: 'abc123',
  name: 'holistix_thing_abc',
  image: IMAGE,
  state: 'running',
  project_id: 'project-1',
  user_container_id: 'container-1',
  networks: ['proj-1-default'],
  ...overrides,
});

describe('planReconcile', () => {
  it('should leave a container that already matches strictly alone', () => {
    // Act
    const actions = planReconcile([placement()], [running()]);

    // Assert - recreating here would kill a session nobody asked to lose and
    // make a routine pass indistinguishable from an outage
    expect(actions).toEqual([
      { action: 'keep', user_container_id: 'container-1', id: 'abc123' },
    ]);
  });

  it('should create what has no container yet', () => {
    // Act
    const actions = planReconcile([placement()], []);

    // Assert
    expect(actions).toEqual([
      expect.objectContaining({
        action: 'create',
        user_container_id: 'container-1',
      }),
    ]);
  });

  it('should start a container that exists but stopped', () => {
    // Act - a laptop that was closed and reopened
    const actions = planReconcile(
      [placement()],
      [running({ state: 'exited' })]
    );

    // Assert - started, not recreated: an exited container is not a missing one
    expect(actions).toEqual([
      expect.objectContaining({ action: 'start', id: 'abc123' }),
    ]);
  });

  it('should recreate only when the image no longer matches', () => {
    // Act - the placement was re-resolved to a new digest.
    //
    // The digest and not the tag: this fixture used to vary only the tag, so
    // it passed while asserting something its own comment did not say. Two
    // references to one digest are one image, and rebuilding a container
    // because a tag moved onto the bytes it already runs is pure loss.
    const actions = planReconcile(
      [placement()],
      [running({ image: `ghcr.io/acme/thing:v0@sha256:${'1'.repeat(64)}` })]
    );

    // Assert - the image is the one thing that cannot be changed in place
    expect(actions).toEqual([
      expect.objectContaining({ action: 'recreate', id: 'abc123' }),
    ]);
  });

  it('should not also try to start a container it is recreating', () => {
    // Act
    const actions = planReconcile(
      [placement()],
      [running({ image: 'other' + DIGEST, state: 'exited' })]
    );

    // Assert
    expect(actions.map((a) => a.action)).toEqual(['recreate']);
  });

  it('should attach a network the container is missing', () => {
    // Act
    const actions = planReconcile(
      [placement({ networks: ['proj-1-default', 'proj-1-data'] })],
      [running()]
    );

    // Assert - `docker network connect` works on a running container, so this
    // is the one case where recreating would be pure loss
    expect(actions).toContainEqual({
      action: 'attach',
      user_container_id: 'container-1',
      id: 'abc123',
      network: 'proj-1-data',
    });
    expect(actions.map((a) => a.action)).not.toContain('recreate');
  });

  it('should detach a network the placement no longer declares', () => {
    // Act - including Docker's default bridge, which is how every container
    // reached every other before private networks existed
    const actions = planReconcile(
      [placement()],
      [running({ networks: ['proj-1-default', 'bridge'] })]
    );

    // Assert
    expect(actions).toContainEqual({
      action: 'detach',
      user_container_id: 'container-1',
      id: 'abc123',
      network: 'bridge',
    });
  });

  it('should accept the reference Apple reports for a digest-pinned image', () => {
    // Measured on `container` 1.2.0: a container started from
    // `docker.io/library/alpine:3@sha256:28bd5f…` reports its image as
    // `docker.io/library/alpine@sha256:28bd5f…`. Compared byte-for-byte those
    // never match, so every pass recreated the container and any service on a
    // Mac restarted once per interval forever.
    const actions = planReconcile(
      [placement()],
      [running({ image: `ghcr.io/acme/thing${DIGEST}` })]
    );

    expect(actions.map((a) => a.action)).not.toContain('recreate');
    expect(actions).toContainEqual({
      action: 'keep',
      user_container_id: 'container-1',
      id: 'abc123',
    });
  });

  it('should still recreate when the digests differ', () => {
    // The tag is a label somebody can move; the digest is the image. Two
    // different digests are two different images however alike they read.
    const actions = planReconcile(
      [placement()],
      [running({ image: `ghcr.io/acme/thing:v1@sha256:${'b'.repeat(64)}` })]
    );

    expect(actions.map((a) => a.action)).toContain('recreate');
  });

  it('should still recreate when one digest arrived from another repository', () => {
    // Same bytes, different provenance. The repository is where the pull
    // credential applies, so "the content is identical" is not on its own a
    // reason to adopt a container nobody placed from there.
    const actions = planReconcile(
      [placement()],
      [running({ image: `ghcr.io/someone-else/thing${DIGEST}` })]
    );

    expect(actions.map((a) => a.action)).toContain('recreate');
  });

  it('should not treat two unpinned references as interchangeable', () => {
    // Without a digest there is nothing to compare but the string, and
    // `:latest` yesterday is not `:latest` today.
    const actions = planReconcile(
      [placement({ imageRef: 'ghcr.io/acme/thing:v2' })],
      [running({ image: 'ghcr.io/acme/thing:v1' })]
    );

    expect(actions.map((a) => a.action)).toContain('recreate');
  });

  it('should leave the networks alone when the placement names none', () => {
    // A local placement declares no network — nothing allocates one for a
    // container on somebody's own machine. Read as "belongs to no network",
    // the pass would disconnect a Docker container from `bridge` and cut it
    // off from its gateway, and on Apple, where a live detach is refused, it
    // would rebuild the container on every interval forever.
    const actions = planReconcile(
      [placement({ networks: [] })],
      [running({ networks: ['bridge'] })]
    );

    // Assert
    expect(actions.map((a) => a.action)).not.toContain('detach');
    expect(actions).toEqual([
      { action: 'keep', user_container_id: 'container-1', id: 'abc123' },
    ]);
  });

  it('should ignore containers of other projects entirely', () => {
    // Act - listOwned filters by label, but a stale one must not be adopted
    const actions = planReconcile(
      [placement()],
      [running({ user_container_id: 'container-9', id: 'zzz' })]
    );

    // Assert - creates ours, says nothing about theirs
    expect(actions).toEqual([
      expect.objectContaining({
        action: 'create',
        user_container_id: 'container-1',
      }),
    ]);
  });

  it('should plan each placement independently', () => {
    // Act
    const actions = planReconcile(
      [
        placement(),
        placement({ user_container_id: 'container-2', name: 'other' }),
      ],
      [running()]
    );

    // Assert
    expect(actions.map((a) => a.action).sort()).toEqual(['create', 'keep']);
  });
});

describe('applyReconcile', () => {
  const collect = () => {
    const calls: string[][] = [];
    const exec = async (args: string[]) => {
      calls.push(args);
      // ensureNetwork's existence probe
      if (args[0] === 'network' && args[1] === 'ls') return '';
      return '';
    };
    return { calls, exec };
  };

  it('should create every declared network before touching containers', async () => {
    // Arrange
    const { calls, exec } = collect();
    const p = placement({ networks: ['proj-1-default', 'proj-1-data'] });

    // Act
    await applyReconcile(
      dockerEngine,
      exec,
      planReconcile([p], [running()]),
      [p],
      async () => 'new-id'
    );

    // Assert - attaching to a network that does not exist fails, and so does
    // creating a container into one
    const firstConnect = calls.findIndex((c) => c[1] === 'connect');
    const lastCreate = calls
      .map((c) => c.join(' '))
      .lastIndexOf('network create proj-1-data');
    expect(lastCreate).toBeGreaterThanOrEqual(0);
    expect(lastCreate).toBeLessThan(firstConnect);
  });

  it('should not create a network that already exists', async () => {
    // Arrange
    const calls: string[][] = [];
    const exec = async (args: string[]) => {
      calls.push(args);
      return args[1] === 'ls' ? 'proj-1-default\n' : '';
    };

    // Act
    await applyReconcile(
      dockerEngine,
      exec,
      [],
      [placement()],
      async () => 'id'
    );

    // Assert
    expect(calls.map((c) => c.join(' '))).not.toContain(
      'network create proj-1-default'
    );
  });

  it('should remove before recreating', async () => {
    // Arrange
    const { calls, exec } = collect();
    const created: string[] = [];
    const p = placement();

    // Act
    await applyReconcile(
      dockerEngine,
      exec,
      [
        {
          action: 'recreate',
          user_container_id: 'container-1',
          id: 'abc123',
          reason: 'image',
        },
      ],
      [p],
      async (placement) => {
        created.push(placement.user_container_id);
        return 'new-id';
      }
    );

    // Assert - the name is taken until the old one is gone
    expect(calls).toContainEqual(['rm', '--force', 'abc123']);
    expect(created).toEqual(['container-1']);
  });

  it('should do nothing at all for a keep', async () => {
    // Arrange
    const { calls, exec } = collect();

    // Act
    await applyReconcile(
      dockerEngine,
      exec,
      [{ action: 'keep', user_container_id: 'container-1', id: 'abc123' }],
      [],
      async () => 'id'
    );

    // Assert - no docker call touches the container
    expect(calls.filter((c) => c[0] !== 'network')).toEqual([]);
  });
});

describe('runArgs', () => {
  it('should label the container so the next pass can find it', () => {
    // Act
    const args = runArgs(placement(), 'machine-1');

    // Assert - without these, reconciling would mean inspecting every
    // container on the user's machine
    expect(args).toContain('holistix.project=project-1');
    expect(args).toContain('holistix.user_container_id=container-1');
    expect(args).toContain('holistix.machine=machine-1');
  });

  it('should pass settings as an environment variable and nothing else', () => {
    // Act
    const args = runArgs(placement(), 'machine-1');

    // Assert
    expect(args).toContain('SETTINGS=eyJ9');
  });

  it('should join the first network at creation and end with the image', () => {
    // Act
    const args = runArgs(
      placement({ networks: ['proj-1-default', 'proj-1-data'] }),
      'machine-1'
    );

    // Assert - only one network can be given to `docker run`; the rest are
    // attached afterwards, which is what the plan emits
    expect(args).toContain('--network');
    expect(args[args.indexOf('--network') + 1]).toBe('proj-1-default');
    expect(args).not.toContain('proj-1-data');
    expect(args[args.length - 1]).toBe(IMAGE);
  });

  it('should ask for the capabilities and devices the placement declares', () => {
    // Act
    const args = runArgs(placement(), 'machine-1');

    // Assert - NET_ADMIN and /dev/net/tun are what let the container reach its
    // gateway over the VPN
    expect(args).toContain('NET_ADMIN');
    expect(args).toContain('/dev/net/tun');
  });

  it('should never produce a single string a shell could reinterpret', () => {
    // Act - a container name is chosen upstream; if it ever carried a
    // semicolon, a shell would run the rest of it on this machine
    const args = runArgs(placement({ name: 'evil; rm -rf /' }), 'machine-1');

    // Assert - it stays one argument, because nothing ever parses it
    expect(args).toContain('evil; rm -rf /');
  });
});

/**
 * What an engine that cannot move a network on a live container does instead.
 *
 * The plan does not change: what a placement should look like has nothing to
 * do with what started it. The substitution happens where the refusal
 * arrives, and it costs a restart the Docker path does not pay — the
 * `no-hot-network-attach` concession, made visible rather than skipped.
 */
describe('applyReconcile — an engine that cannot attach live', () => {
  const placement = {
    project_id: 'proj-1',
    user_container_id: 'uc_1',
    name: 'holistix_svc_uc_1',
    imageRef: 'ghcr.io/acme/etl@sha256:' + 'a'.repeat(64),
    settings: 'x',
    capabilities: [],
    devices: [],
    extraHosts: [],
    networks: ['net-a', 'net-b'],
  } as never;

  const engineWithout = () => {
    const calls: string[] = [];
    return {
      calls,
      engine: {
        ...appleEngine,
        ensureNetwork: async () => {
          calls.push('ensureNetwork');
        },
        removeContainer: async () => {
          calls.push('removeContainer');
          return '';
        },
      },
    };
  };

  it('recreates rather than failing the pass', async () => {
    const { calls, engine } = engineWithout();
    const created: string[] = [];

    await applyReconcile(
      engine,
      (async () => '') as never,
      [
        {
          action: 'attach',
          id: 'c1',
          user_container_id: 'uc_1',
          network: 'net-b',
        } as never,
      ],
      [placement],
      async (p) => {
        created.push((p as { user_container_id: string }).user_container_id);
        return 'new-id';
      }
    );

    expect(calls).toContain('removeContainer');
    expect(created).toEqual(['uc_1']);
  });

  it('does the same for a detach', async () => {
    const { calls, engine } = engineWithout();
    const created: string[] = [];

    await applyReconcile(
      engine,
      (async () => '') as never,
      [
        {
          action: 'detach',
          id: 'c1',
          user_container_id: 'uc_1',
          network: 'net-z',
        } as never,
      ],
      [placement],
      async (p) => {
        created.push((p as { user_container_id: string }).user_container_id);
        return 'new-id';
      }
    );

    expect(calls).toContain('removeContainer');
    expect(created).toEqual(['uc_1']);
  });

  it('rebuilds a container once, however many networks changed', async () => {
    // The rebuild puts the container on every network the placement names, so
    // the second action has nothing left to do — and it carries the identifier
    // from before the rebuild, so acting on it would delete a container that no
    // longer exists and abort the pass with every later placement unconverged.
    const { calls, engine } = engineWithout();
    const created: string[] = [];

    await applyReconcile(
      engine,
      (async () => '') as never,
      [
        {
          action: 'attach',
          id: 'c1',
          user_container_id: 'uc_1',
          network: 'net-a',
        } as never,
        {
          action: 'attach',
          id: 'c1',
          user_container_id: 'uc_1',
          network: 'net-b',
        } as never,
      ],
      [placement],
      async (p) => {
        created.push((p as { user_container_id: string }).user_container_id);
        return 'new-id';
      }
    );

    expect(calls.filter((c) => c === 'removeContainer')).toHaveLength(1);
    expect(created).toEqual(['uc_1']);
  });

  it('rebuilds each container that needs it, not only the first', async () => {
    // The guard is per container, not a flag for the pass.
    const { calls, engine } = engineWithout();
    const created: string[] = [];
    const second = { ...(placement as object), user_container_id: 'uc_2' };

    await applyReconcile(
      engine,
      (async () => '') as never,
      [
        {
          action: 'attach',
          id: 'c1',
          user_container_id: 'uc_1',
          network: 'net-a',
        } as never,
        {
          action: 'attach',
          id: 'c2',
          user_container_id: 'uc_2',
          network: 'net-a',
        } as never,
      ],
      [placement, second as never],
      async (p) => {
        created.push((p as { user_container_id: string }).user_container_id);
        return 'new-id';
      }
    );

    expect(calls.filter((c) => c === 'removeContainer')).toHaveLength(2);
    expect(created).toEqual(['uc_1', 'uc_2']);
  });

  it('still lets a real failure through', async () => {
    // Only the "this engine cannot" refusal becomes a recreate. Anything else
    // is a fault, and swallowing it would hide a broken engine behind a
    // service that silently restarts every pass.
    const engine = {
      ...appleEngine,
      ensureNetwork: async () => undefined,
      connectNetwork: async () => {
        throw new Error('daemon is on fire');
      },
    };

    await expect(
      applyReconcile(
        engine,
        (async () => '') as never,
        [
          {
            action: 'attach',
            id: 'c1',
            user_container_id: 'uc_1',
            network: 'net-b',
          } as never,
        ],
        [placement],
        async () => 'new-id'
      )
    ).rejects.toThrow('daemon is on fire');
  });
});
