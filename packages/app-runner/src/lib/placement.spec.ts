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
