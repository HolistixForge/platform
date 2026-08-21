import {
  MAX_DNS_LABEL_LENGTH,
  containerLabel,
  isMainService,
  serviceFqdn,
  serviceLabel,
  slugifyLabelPart,
} from './service-fqdn';

const CONTAINER = 'uc_msiod5zqhlj4ws';
const ORG = '5b927daf-4ca8-45a7-adbe-32bce35988f7';
const DOMAIN = 'apollo.test:8443';

describe('slugifyLabelPart', () => {
  it('lowercases, because nginx matches server_name in lowercase', () => {
    expect(slugifyLabelPart('JupyterLab')).toBe('jupyterlab');
  });

  it('turns anything DNS will not take into a dash', () => {
    expect(slugifyLabelPart('My Data Space!')).toBe('my-data-space');
    expect(slugifyLabelPart('a_b.c')).toBe('a-b-c');
  });

  it('does not leave a leading or trailing dash', () => {
    expect(slugifyLabelPart('  spaced  ')).toBe('spaced');
    expect(slugifyLabelPart('--x--')).toBe('x');
  });

  it('reduces a name with nothing usable in it to empty', () => {
    expect(slugifyLabelPart('///')).toBe('');
  });
});

describe('containerLabel', () => {
  // Unchanged on purpose: certificates on disk and nginx server blocks written
  // at runtime already carry this exact string.
  it('is the name containers have always had', () => {
    expect(containerLabel(CONTAINER)).toBe('uc-uc_msiod5zqhlj4ws');
  });
});

describe('serviceLabel', () => {
  it('puts the service after the container, in one label', () => {
    expect(serviceLabel(CONTAINER, ['jupyterlab'])).toBe(
      'uc-uc_msiod5zqhlj4ws--jupyterlab'
    );
  });

  it('keeps qualifiers in the order given', () => {
    expect(serviceLabel(CONTAINER, ['research', 'jupyterlab'])).toBe(
      'uc-uc_msiod5zqhlj4ws--research--jupyterlab'
    );
  });

  it('drops empty and unusable parts rather than leaving a double separator', () => {
    expect(serviceLabel(CONTAINER, ['', 'jupyterlab'])).toBe(
      'uc-uc_msiod5zqhlj4ws--jupyterlab'
    );
    expect(serviceLabel(CONTAINER, ['///', 'jupyterlab'])).toBe(
      'uc-uc_msiod5zqhlj4ws--jupyterlab'
    );
  });

  it('falls back to the container label when nothing qualifies it', () => {
    expect(serviceLabel(CONTAINER, [])).toBe('uc-uc_msiod5zqhlj4ws');
    expect(serviceLabel(CONTAINER, [undefined, null, ''])).toBe(
      'uc-uc_msiod5zqhlj4ws'
    );
  });

  // The reason the container leads. A two-character service name in front
  // would put `--` at positions three and four, which IDNA reserves for
  // A-labels like `xn--`.
  it('never puts the separator where IDNA reserves it', () => {
    const label = serviceLabel(CONTAINER, ['ui']);
    expect(label.slice(2, 4)).not.toBe('--');
    expect(label).toBe('uc-uc_msiod5zqhlj4ws--ui');
  });

  describe('when the name would not fit in a DNS label', () => {
    const long = 'a'.repeat(80);

    it('trims to the limit', () => {
      expect(serviceLabel(CONTAINER, [long]).length).toBe(MAX_DNS_LABEL_LENGTH);
    });

    it('trims the tail, never the container id', () => {
      expect(
        serviceLabel(CONTAINER, [long]).startsWith(containerLabel(CONTAINER))
      ).toBe(true);
    });

    it('does not leave a trailing dash, which DNS rejects', () => {
      // 41 characters of room after the container and separator, so a part of
      // exactly 42 gets cut mid-run and would otherwise end on a dash.
      const label = serviceLabel(CONTAINER, ['b'.repeat(40) + '--']);
      expect(label.endsWith('-')).toBe(false);
    });
  });
});

describe('isMainService', () => {
  it.each(['', 'main', 'default', 'MAIN'])(
    'treats %p as the container itself',
    (name) => {
      expect(isMainService(name)).toBe(true);
    }
  );

  it('treats a real service name as a service', () => {
    expect(isMainService('jupyterlab')).toBe(false);
  });

  it('treats an absent name as the container itself', () => {
    expect(isMainService(undefined)).toBe(true);
  });
});

describe('serviceFqdn', () => {
  it('gives the main service the bare container name', () => {
    expect(
      serviceFqdn({
        containerId: CONTAINER,
        organizationId: ORG,
        domain: DOMAIN,
        serviceName: 'main',
      })
    ).toBe(`uc-uc_msiod5zqhlj4ws.org-${ORG}.apollo.test:8443`);
  });

  it('publishes a named service two labels deep, not three', () => {
    const fqdn = serviceFqdn({
      containerId: CONTAINER,
      organizationId: ORG,
      domain: DOMAIN,
      serviceName: 'jupyterlab',
    });

    expect(fqdn).toBe(
      `uc-uc_msiod5zqhlj4ws--jupyterlab.org-${ORG}.apollo.test:8443`
    );
  });

  // The point of the whole change: one wildcard per organization has to cover
  // every service of every container it will ever hold.
  it('is covered by a single *.org-<uuid>.<domain> wildcard', () => {
    const fqdn = serviceFqdn({
      containerId: CONTAINER,
      organizationId: ORG,
      domain: 'example.com',
      serviceName: 'jupyterlab',
      qualifiers: ['research space'],
    });

    const host = fqdn.split(':')[0];
    const labelsBelowOrg = host
      .slice(0, host.indexOf(`.org-${ORG}.`))
      .split('.');
    expect(labelsBelowOrg).toHaveLength(1);
    expect(host.endsWith(`.org-${ORG}.example.com`)).toBe(true);
  });

  it('carries the qualifiers into the label', () => {
    expect(
      serviceFqdn({
        containerId: CONTAINER,
        organizationId: ORG,
        domain: 'example.com',
        serviceName: 'jupyterlab',
        qualifiers: ['Research Space'],
      })
    ).toBe(
      `uc-uc_msiod5zqhlj4ws--research-space--jupyterlab.org-${ORG}.example.com`
    );
  });

  it('ignores qualifiers for the main service, which keeps its bare name', () => {
    expect(
      serviceFqdn({
        containerId: CONTAINER,
        organizationId: ORG,
        domain: 'example.com',
        qualifiers: ['research'],
      })
    ).toBe(`uc-uc_msiod5zqhlj4ws.org-${ORG}.example.com`);
  });

  // The space is the whiteboard project a container belongs to. It is in the
  // name because a hostname is what people read and paste, and
  // `uc-uc_msiod5zqhlj4ws` says nothing about which project it is.
  describe('the space a service belongs to', () => {
    it('sits between the container and the service', () => {
      expect(
        serviceFqdn({
          containerId: CONTAINER,
          organizationId: ORG,
          domain: 'example.com',
          serviceName: 'jupyterlab',
          qualifiers: ['sync-test'],
        })
      ).toBe(
        `uc-uc_msiod5zqhlj4ws--sync-test--jupyterlab.org-${ORG}.example.com`
      );
    });

    // What a gateway older than the change gets, and what one gets before
    // Ganymede has told it the names. It has to be the name the service had
    // before, not a placeholder nobody can route.
    it('is left out entirely when the space is unknown', () => {
      expect(
        serviceFqdn({
          containerId: CONTAINER,
          organizationId: ORG,
          domain: 'example.com',
          serviceName: 'jupyterlab',
          qualifiers: [undefined],
        })
      ).toBe(`uc-uc_msiod5zqhlj4ws--jupyterlab.org-${ORG}.example.com`);
    });

    it('survives a name a user typed', () => {
      expect(
        serviceFqdn({
          containerId: CONTAINER,
          organizationId: ORG,
          domain: 'example.com',
          serviceName: 'jupyterlab',
          qualifiers: ['Mon Espace de Travail !'],
        })
      ).toBe(
        `uc-uc_msiod5zqhlj4ws--mon-espace-de-travail--jupyterlab.org-${ORG}.example.com`
      );
    });

    // The prefix handed to a container so it can name its own services the
    // same way — `serviceLabel` with the space and no service name.
    it('gives a container the same prefix the gateway will publish', () => {
      const prefix = serviceLabel(CONTAINER, ['sync-test']);
      const published = serviceFqdn({
        containerId: CONTAINER,
        organizationId: ORG,
        domain: 'example.com',
        serviceName: 'jupyterlab',
        qualifiers: ['sync-test'],
      });

      expect(`${prefix}--jupyterlab.org-${ORG}.example.com`).toBe(published);
    });
  });

  it('never produces a label over the DNS limit, whatever it is given', () => {
    const fqdn = serviceFqdn({
      containerId: CONTAINER,
      organizationId: ORG,
      domain: 'example.com',
      serviceName: 'a'.repeat(60),
      qualifiers: ['b'.repeat(60)],
    });

    expect(fqdn.split('.')[0].length).toBeLessThanOrEqual(MAX_DNS_LABEL_LENGTH);
  });
});
