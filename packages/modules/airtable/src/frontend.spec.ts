/**
 * What the airtable module contributes to the whiteboard.
 *
 * Part of the non-regression harness for the Excalidraw refactor (TAC-213):
 * node types are mounted by name, side panels are chosen by node type, and
 * each module gets its own entries into the context menu. None of the three is
 * enforced by a type — a registration that stops happening compiles, loads and
 * says nothing.
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

describe('airtable — what it registers', () => {
  it('mounts its three node types under the names the graph stores', () => {
    expect(Object.keys(load().nodes).sort()).toEqual([
      'airtable-kanban-column',
      'airtable-record',
      'airtable-table',
    ]);
  });

  it('gives a real component for each of them', () => {
    for (const [name, component] of Object.entries(load().nodes)) {
      expect([name, typeof component]).toEqual([name, 'function']);
    }
  });

  it('registers the side panel for a base', () => {
    // Panels are looked up by node type; a missing one leaves the panel empty
    // with nothing in the console to say why.
    expect(Object.keys(load().panels)).toEqual(['airtable-base']);
  });

  it('contributes its context menu entries', () => {
    expect(load().menus).toHaveLength(1);
  });

  it('declares the shared data it reads and writes', () => {
    expect(load().sharedData.sort()).toEqual([
      'airtable:base-search-results',
      'airtable:bases',
      'airtable:node-views',
    ]);
  });
});
