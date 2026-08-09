/**
 * What the notion module contributes to the whiteboard.
 *
 * Part of the non-regression harness for the Excalidraw refactor (TAC-213) —
 * see the airtable spec next door for why registrations are written out in
 * full rather than counted.
 *
 * One name here is worth stating twice: the node type is `notion-page` and the
 * component behind it is called `NodeNotionTask`. The two names disagree, so
 * neither reading the registry nor reading the components tells you what the
 * graph actually stores.
 */
import { moduleFrontend } from './frontend';

/** Everything the module hands over when it loads. */
const load = () => {
  const nodes: Record<string, unknown> = {};
  const panels: Record<string, unknown> = {};
  const menus: unknown[] = [];
  const sharedData: string[] = [];

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
        registerPanel: (p: Record<string, unknown>) => Object.assign(panels, p),
        registerMenuEntries: (m: unknown) => menus.push(m),
        registerLayer: () => undefined,
      },
    } as never,
    moduleExports: () => undefined,
    config: {},
  });

  return { nodes, panels, menus, sharedData };
};

describe('notion — what it registers', () => {
  it('mounts its three node types under the names the graph stores', () => {
    expect(Object.keys(load().nodes).sort()).toEqual([
      'notion-database',
      'notion-kanban-column',
      'notion-page',
    ]);
  });

  it('gives a real component for each of them', () => {
    for (const [name, component] of Object.entries(load().nodes)) {
      expect([name, typeof component]).toEqual([name, 'function']);
    }
  });

  it('registers the side panel for a database', () => {
    expect(Object.keys(load().panels)).toEqual(['notion-database']);
  });

  it('contributes its context menu entries', () => {
    expect(load().menus).toHaveLength(1);
  });

  it('declares the shared data it reads and writes', () => {
    expect(load().sharedData.sort()).toEqual([
      'notion:database-search-results',
      'notion:databases',
      'notion:node-views',
    ]);
  });
});
