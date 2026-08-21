import {
  assertPlacementIsForUs,
  PlacementRefused,
  TPlacement,
} from './placement';

const DIGEST =
  '@sha256:0000000000000000000000000000000000000000000000000000000000000000';

const placement = (overrides: Partial<TPlacement> = {}): TPlacement => ({
  machine_id: 'machine-1',
  project_id: 'project-1',
  user_container_id: 'container-1',
  name: 'holistix_thing_abc',
  imageRef: `ghcr.io/acme/thing:v1${DIGEST}`,
  settings: 'eyJ9',
  capabilities: ['NET_ADMIN'],
  devices: ['/dev/net/tun'],
  extraHosts: [],
  networks: ['proj-1-default'],
  ...overrides,
});

const projects = new Set(['project-1']);

describe('assertPlacementIsForUs', () => {
  it('should accept a placement for this machine in a project it joined', () => {
    // Act / Assert
    expect(() =>
      assertPlacementIsForUs(placement(), 'machine-1', projects)
    ).not.toThrow();
  });

  it('should refuse a placement addressed to another machine', () => {
    // Act / Assert - the identity comes from this runner's own credentials, so
    // the message cannot vouch for itself
    expect(() =>
      assertPlacementIsForUs(
        placement({ machine_id: 'machine-2' }),
        'machine-1',
        projects
      )
    ).toThrow(PlacementRefused);
  });

  it('should refuse a placement that names no machine at all', () => {
    // Act / Assert - an empty machine_id must not read as "any machine"
    expect(() =>
      assertPlacementIsForUs(
        placement({ machine_id: '' }),
        'machine-1',
        projects
      )
    ).toThrow(/names no machine/i);
  });

  it('should refuse a project this machine was never opted into', () => {
    // Act / Assert - enrolment is per machine, consent is per project; without
    // this, any project on the platform could run a playbook on someone's laptop
    expect(() =>
      assertPlacementIsForUs(
        placement({ project_id: 'project-2' }),
        'machine-1',
        projects
      )
    ).toThrow(/not opted into project project-2/);
  });

  it('should refuse an image reference that is not digest-pinned', () => {
    // Act / Assert - a bare tag means the platform-side resolution did not
    // happen, and starting it pulls whatever that tag points at today
    expect(() =>
      assertPlacementIsForUs(
        placement({ imageRef: 'ghcr.io/acme/thing:v1' }),
        'machine-1',
        projects
      )
    ).toThrow(/not digest-pinned/);
  });

  it('should accept a built-in image that carries no digest', () => {
    // The platform's own catalogue. Those images change when the platform is
    // redeployed rather than when a tenant pushes, and none of them has a
    // digest recorded — the default terminal image least of all, which is the
    // first thing anybody places on their own machine. Refusing it here made
    // the local runner unable to start the one image everybody has.
    //
    // Same line the broker draws: `!resolved.builtin && !DIGEST_PINNED`.
    expect(() =>
      assertPlacementIsForUs(
        placement({
          imageRef: 'holistixforge/ubuntu-terminal:24.04',
          builtin: true,
        }),
        'machine-1',
        projects
      )
    ).not.toThrow();
  });

  it('should still refuse an unpinned tenant image', () => {
    // A tenant image reaching here unpinned is a resolution that did not
    // happen.
    expect(() =>
      assertPlacementIsForUs(
        placement({ imageRef: 'ghcr.io/acme/thing:v1', builtin: false }),
        'machine-1',
        projects
      )
    ).toThrow(/not digest-pinned/);
  });

  it('should treat a placement with no builtin field as a tenant image', () => {
    // A gateway that predates the field sends nothing, and the safe reading of
    // nothing is the stricter rule.
    const { builtin: _omitted, ...withoutFlag } = placement({
      imageRef: 'ghcr.io/acme/thing:v1',
    }) as Record<string, unknown>;

    expect(() =>
      assertPlacementIsForUs(withoutFlag as never, 'machine-1', projects)
    ).toThrow(/not digest-pinned/);
  });

  it('should refuse an unpinned image the message merely calls built-in', () => {
    // The whole point. `builtin` arrives in the message, and this function is
    // built on the opposite principle: `machine_id` comes from the runner's own
    // credentials so the message cannot vouch for itself. Trusted, the flag let
    // anything able to produce a placement for this runner start a mutable tag
    // on a user's own machine.
    expect(() =>
      assertPlacementIsForUs(
        placement({ imageRef: 'ghcr.io/attacker/thing:latest', builtin: true }),
        'machine-1',
        projects
      )
    ).toThrow(/not digest-pinned/);
  });

  it('should accept a platform image even when the message claims nothing', () => {
    // The namespace decides, so the flag is a hint about intent and never the
    // authority. A gateway that sends no flag at all still places the default
    // terminal image.
    expect(() =>
      assertPlacementIsForUs(
        placement({ imageRef: 'holistixforge/ubuntu-terminal:24.04' }),
        'machine-1',
        projects
      )
    ).not.toThrow();
  });

  it('should accept a platform image written with its registry host', () => {
    // `holistixforge/x` and `docker.io/holistixforge/x` are the same image, and
    // only the second form survives some resolvers.
    expect(() =>
      assertPlacementIsForUs(
        placement({ imageRef: 'docker.io/holistixforge/n8n:1.97.1' }),
        'machine-1',
        projects
      )
    ).not.toThrow();
  });

  it('should refuse a namespace that merely ends with the platform one', () => {
    // `evil.com/notholistixforge/x` contains the namespace without being under
    // it — the check has to land on the boundary, not anywhere in the string.
    for (const imageRef of [
      'evil.com/notholistixforge/thing:latest',
      'ghcr.io/holistixforge-evil/thing:latest',
      'evil.com/x/holistixforge/thing:latest',
    ]) {
      expect(() =>
        assertPlacementIsForUs(
          placement({ imageRef, builtin: true }),
          'machine-1',
          projects
        )
      ).toThrow(/not digest-pinned/);
    }
  });

  it('should let a deployment name its own namespace', () => {
    // Said once, in the runner's own environment — the deployment speaking,
    // not the placement.
    const previous = process.env.PLATFORM_IMAGE_NAMESPACE;
    process.env.PLATFORM_IMAGE_NAMESPACE = 'acme';
    try {
      expect(() =>
        assertPlacementIsForUs(
          placement({ imageRef: 'acme/thing:v1' }),
          'machine-1',
          projects
        )
      ).not.toThrow();
      expect(() =>
        assertPlacementIsForUs(
          placement({ imageRef: 'holistixforge/thing:v1' }),
          'machine-1',
          projects
        )
      ).toThrow(/not digest-pinned/);
    } finally {
      if (previous === undefined) delete process.env.PLATFORM_IMAGE_NAMESPACE;
      else process.env.PLATFORM_IMAGE_NAMESPACE = previous;
    }
  });

  it('should refuse a digest that is not a full sha256', () => {
    // Act / Assert - a truncated digest is not a weaker pin, it is no pin
    expect(() =>
      assertPlacementIsForUs(
        placement({ imageRef: 'ghcr.io/acme/thing:v1@sha256:abc' }),
        'machine-1',
        projects
      )
    ).toThrow(/not digest-pinned/);
  });

  it('should refuse a placement with no image', () => {
    // Act / Assert
    expect(() =>
      assertPlacementIsForUs(placement({ imageRef: '' }), 'machine-1', projects)
    ).toThrow(/names no image/i);
  });

  it('should refuse everything when this machine is in no project', () => {
    // Act / Assert - a freshly enrolled runner nobody has placed anything on
    expect(() =>
      assertPlacementIsForUs(placement(), 'machine-1', new Set())
    ).toThrow(/not opted into/);
  });
});
