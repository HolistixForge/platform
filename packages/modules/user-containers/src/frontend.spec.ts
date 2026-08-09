/**
 * What the user-containers module contributes to the whiteboard.
 *
 * Part of the non-regression harness for the Excalidraw refactor (TAC-213).
 * One node type, and it is the one that carries every running service on the
 * board — a notebook, a terminal, an editor. It also registers the runners,
 * which decide where a container is allowed to run; those are exports rather
 * than whiteboard registrations, but they disappear the same silent way.
 */
import { moduleFrontend } from './frontend';
import type { TUserContainersFrontendExports } from './frontend';

/** Everything the module hands over when it loads. */
const load = () => {
  const nodes: Record<string, unknown> = {};
  const menus: unknown[] = [];
  const sharedData: string[] = [];
  let exports: TUserContainersFrontendExports | undefined;

  moduleFrontend.load({
    depsExports: {
      collab: {
        registry: {
          registerSharedData: (_kind: string, ns: string, name: string) =>
            sharedData.push(`${ns}:${name}`),
        },
      },
      whiteboard: {
        registerNodes: (n: Record<string, unknown>) => Object.assign(nodes, n),
        registerPanel: () => undefined,
        registerMenuEntries: (m: unknown) => menus.push(m),
        registerLayer: () => undefined,
      },
    } as never,
    moduleExports: (e) => {
      exports = e as TUserContainersFrontendExports;
    },
    config: {},
  });

  return { nodes, menus, sharedData, exports };
};

describe('user-containers — what it registers', () => {
  it('mounts the container node under the name the graph stores', () => {
    expect(Object.keys(load().nodes)).toEqual(['user-container']);
  });

  it('gives a real component for it', () => {
    expect(typeof load().nodes['user-container']).toBe('function');
  });

  it('contributes its context menu entries', () => {
    expect(load().menus).toHaveLength(1);
  });

  it('declares the shared data it reads and writes', () => {
    expect(load().sharedData.sort()).toEqual([
      'user-containers:containers',
      'user-containers:images',
      'user-containers:machines',
      'user-containers:runners',
    ]);
  });

  it('offers both places a container can run', () => {
    // Registered unconditionally; the gateway's published set narrows this
    // down at display time. Losing one here loses it everywhere.
    expect([...(load().exports?.getRunners().keys() ?? [])].sort()).toEqual([
      'local',
      'platform',
    ]);
  });
});

describe('user-containers — the token it hands a service', () => {
  it('is empty, because the container auth guard adds the real one', () => {
    // Returning a token here would hand a notebook's whole API to whoever
    // holds the page. The emptiness is the security property, so it is
    // asserted rather than assumed.
    const container = {
      httpServices: [{ name: 'jupyter' }],
    } as never;

    return expect(load().exports?.getToken(container, 'jupyter')).resolves.toBe(
      ''
    );
  });

  it('fails on a service the container does not expose', () => {
    const container = { httpServices: [] } as never;

    return expect(
      load().exports?.getToken(container, 'jupyter')
    ).rejects.toThrow('Service jupyter not found');
  });
});
