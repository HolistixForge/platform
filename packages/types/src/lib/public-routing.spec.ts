import {
  PUBLIC_GANYMEDE_PATH,
  PUBLIC_GATEWAY_PATH,
  PUBLIC_ROUTE_PREFIX,
  isConfiguredHost,
  publicGatewayPath,
} from './public-routing';

describe('public routing paths', () => {
  it('reserves everything under /-/', () => {
    expect(PUBLIC_GANYMEDE_PATH).toBe('/-/ganymede');
    expect(PUBLIC_GATEWAY_PATH).toBe('/-/gw');
  });

  // The two above are written out so the literal survives into a bundle; this
  // is what keeps them from drifting away from the prefix they belong to.
  it('keeps the written-out paths under the prefix', () => {
    expect(PUBLIC_GANYMEDE_PATH.startsWith(`${PUBLIC_ROUTE_PREFIX}/`)).toBe(
      true
    );
    expect(PUBLIC_GATEWAY_PATH.startsWith(`${PUBLIC_ROUTE_PREFIX}/`)).toBe(
      true
    );
    expect(publicGatewayPath('x').startsWith(`${PUBLIC_ROUTE_PREFIX}/`)).toBe(
      true
    );
  });

  it('names a gateway path the way the hostname it replaces reads', () => {
    expect(publicGatewayPath('522b0170-82e4-4358-9ff5-55adc9558811')).toBe(
      '/-/gw/org-522b0170-82e4-4358-9ff5-55adc9558811'
    );
  });

  it('has no trailing slash, so a base URL joins cleanly', () => {
    expect(publicGatewayPath('x').endsWith('/')).toBe(false);
  });
});

describe('isConfiguredHost', () => {
  const domain = 'apollo.test:8443';

  it('matches the domain itself', () => {
    expect(isConfiguredHost('apollo.test:8443', domain)).toBe(true);
  });

  it('matches its subdomains, port and all', () => {
    expect(isConfiguredHost('ganymede.apollo.test:8443', domain)).toBe(true);
    expect(
      isConfiguredHost(
        'org-522b0170-82e4-4358-9ff5-55adc9558811.apollo.test:8443',
        domain
      )
    ).toBe(true);
    expect(isConfiguredHost('uc-1.org-2.apollo.test:8443', domain)).toBe(true);
  });

  it('does not match a tunnel hostname — which is the signal it exists for', () => {
    expect(isConfiguredHost('foo.trycloudflare.com', domain)).toBe(false);
    expect(
      isConfiguredHost('chrysostomes-macbook-pro.taila29aef.ts.net', domain)
    ).toBe(false);
  });

  // The port is part of the authority, so the same name on another port is
  // another origin — and treating it as configured would hand a browser a
  // cookie it refuses and a gateway URL that answers nothing.
  it('does not match the same name on a different port', () => {
    expect(isConfiguredHost('apollo.test:9443', domain)).toBe(false);
  });

  // "notapollo.test" ends with "apollo.test" as a string but is a different
  // domain; the dot is what makes it a subdomain test rather than a suffix one.
  it('does not match a name that merely ends with the domain', () => {
    expect(isConfiguredHost('notapollo.test:8443', domain)).toBe(false);
  });

  it('is case-insensitive, as hostnames are', () => {
    expect(isConfiguredHost('GANYMEDE.Apollo.Test:8443', domain)).toBe(true);
  });

  it('is false when either side is missing', () => {
    expect(isConfiguredHost(null, domain)).toBe(false);
    expect(isConfiguredHost('apollo.test:8443', undefined)).toBe(false);
  });
});
