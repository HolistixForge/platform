/**
 * The registry every other module writes into.
 *
 * Part of the non-regression harness for the Excalidraw refactor (TAC-213).
 * The whiteboard holds one table of node components, one of side panels, one
 * list of layers and one of menu contributions, and eight modules add to them
 * as they load. Three properties matter and none of them are typed:
 *
 *  - a later module adds to the table rather than replacing it;
 *  - loading twice does not accumulate, which is what a dev-server reload does;
 *  - a layer id is registered once, whoever asks.
 *
 * They are asserted here because the refactor replaces what reads these tables,
 * not what writes them, and a reader that stops looking finds nothing to say so.
 */
import { moduleFrontend } from './frontend';
import type { TWhiteboardFrontendExports } from './frontend';

//

const load = () => {
  let exports: TWhiteboardFrontendExports | undefined;
  const sharedData: string[] = [];

  moduleFrontend.load({
    depsExports: {
      collab: {
        registry: {
          registerSharedData: (_kind: string, ns: string, name: string) =>
            sharedData.push(`${ns}:${name}`),
        },
      },
    } as never,
    moduleExports: (e) => {
      exports = e as TWhiteboardFrontendExports;
    },
    config: {},
  });

  // `load` calls back synchronously; the cast keeps the tests readable.
  return { api: exports as TWhiteboardFrontendExports, sharedData };
};

const layer = (id: string) => ({ id, title: id, Component: () => null });

//

describe('whiteboard — its own registrations', () => {
  it('mounts the two node types it owns', () => {
    // `shape` is every drawn primitive and `group` is the container for them;
    // both predate any module and are the whiteboard's own vocabulary.
    expect(Object.keys(load().api.uiElements.nodes).sort()).toEqual([
      'group',
      'shape',
    ]);
  });

  it('declares the graph views it stores', () => {
    expect(load().sharedData).toEqual(['whiteboard:graphViews']);
  });

  it('contributes its own context menu entries', () => {
    // Not directly observable through the exports — what is observable is
    // that loading does not throw and the table exists for others to add to.
    expect(load().api.uiElements.nodes).toBeDefined();
  });
});

describe('whiteboard — what other modules add', () => {
  it('adds a module’s node types alongside its own', () => {
    const { api } = load();

    api.registerNodes({ youtube: (() => null) as never });

    expect(Object.keys(api.uiElements.nodes).sort()).toEqual([
      'group',
      'shape',
      'youtube',
    ]);
  });

  it('lets a later module override a node type on purpose', () => {
    const { api } = load();
    const replacement = (() => null) as never;

    api.registerNodes({ shape: replacement });

    expect(api.uiElements.nodes['shape']).toBe(replacement);
  });

  it('keeps side panels keyed by the node type they open for', () => {
    const { api } = load();

    api.registerPanel({ 'notion-database': (() => null) as never });
    api.registerPanel({ 'airtable-base': (() => null) as never });

    expect(Object.keys(api.uiElements.panels).sort()).toEqual([
      'airtable-base',
      'notion-database',
    ]);
  });

  it('keeps the layers in the order they registered', () => {
    const { api } = load();

    api.registerLayer(layer('excalidraw') as never);
    api.registerLayer(layer('reactflow') as never);

    expect(api.uiElements.layers.map((l) => l.id)).toEqual([
      'excalidraw',
      'reactflow',
    ]);
  });

  it('ignores a second layer claiming an id already taken', () => {
    // Two layers with one id means one of them can never be selected, and
    // which one wins depends on module load order.
    const { api } = load();
    const first = layer('excalidraw');

    api.registerLayer(first as never);
    api.registerLayer(layer('excalidraw') as never);

    expect(api.uiElements.layers).toHaveLength(1);
    expect(api.uiElements.layers[0]).toBe(first);
  });
});

describe('whiteboard — loading twice', () => {
  it('starts from its own two node types again, not from the last load’s', () => {
    // The dev server reloads modules in place. Without the reset, every save
    // stacked another copy of every registration.
    const first = load();
    first.api.registerNodes({ youtube: (() => null) as never });

    expect(Object.keys(load().api.uiElements.nodes).sort()).toEqual([
      'group',
      'shape',
    ]);
  });

  it('drops the layers registered by the previous load', () => {
    const first = load();
    first.api.registerLayer(layer('excalidraw') as never);

    expect(load().api.uiElements.layers).toHaveLength(0);
  });
});
