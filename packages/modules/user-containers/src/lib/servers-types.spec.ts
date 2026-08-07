import { openableServices } from './servers-types';

describe('openableServices', () => {
  const svc = (name: string) => ({ host: `${name}.x`, port: 1, name });

  it('hides the auth guard internals', () => {
    // Both must reach the gateway — that is what writes their nginx blocks —
    // and neither is a page to send anybody to.
    const services = [
      svc('__guard_hub'),
      svc('jupyterlab'),
      svc('__guard_base'),
    ];
    expect(
      openableServices({ httpServices: services }).map((s) => s.name)
    ).toEqual(['jupyterlab']);
  });

  it('does not depend on registration order', () => {
    // The hub shim won the race and became httpServices[0], which is how
    // clicking the notebook came to answer {"error": "not found"}.
    expect(
      openableServices({ httpServices: [svc('__guard_hub'), svc('n8n')] })[0]
        .name
    ).toBe('n8n');
  });

  it('leaves an ordinary catalogue alone', () => {
    const services = [svc('terminal'), svc('n8n')];
    expect(openableServices({ httpServices: services })).toEqual(services);
  });
});
