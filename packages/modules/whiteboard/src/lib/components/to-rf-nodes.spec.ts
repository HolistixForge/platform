import { NODE_Z_INDEX, translateNodes } from './to-rf-nodes';
import { nodeViewDefaultStatus, TNodeView } from '../whiteboard-types';

/**
 * TESTING NODE STACKING ORDER (issue #17)
 *
 * Selection is tracked in awareness, not in React Flow's own `selected` flag,
 * so `elevateNodesOnSelect` never fires and the elevation has to come from the
 * explicit `zIndex` set here.
 */

const nodeView = (id: string, type = 'test'): TNodeView => ({
  id,
  type,
  position: { x: 0, y: 0 },
  status: nodeViewDefaultStatus(),
});

const byId = (nodes: ReturnType<typeof translateNodes>, id: string) =>
  nodes.find((n) => n.id === id);

describe('translateNodes', () => {
  const viewId = 'view-1';

  it('raises selected nodes above unselected ones', () => {
    const nodes = translateNodes(
      [nodeView('a'), nodeView('b')],
      viewId,
      new Set(['b'])
    );

    expect(byId(nodes, 'b')?.zIndex).toBeGreaterThan(
      byId(nodes, 'a')?.zIndex as number
    );
    expect(byId(nodes, 'b')?.zIndex).toBe(NODE_Z_INDEX.selected);
  });

  it('raises every selected node, not just one', () => {
    const nodes = translateNodes(
      [nodeView('a'), nodeView('b'), nodeView('c')],
      viewId,
      new Set(['a', 'c'])
    );

    expect(byId(nodes, 'a')?.zIndex).toBe(NODE_Z_INDEX.selected);
    expect(byId(nodes, 'c')?.zIndex).toBe(NODE_Z_INDEX.selected);
    expect(byId(nodes, 'b')?.zIndex).toBe(NODE_Z_INDEX.node);
  });

  it('keeps groups below their children', () => {
    const nodes = translateNodes(
      [nodeView('g', 'group'), nodeView('child')],
      viewId,
      new Set()
    );

    expect(byId(nodes, 'g')?.zIndex).toBeLessThan(
      byId(nodes, 'child')?.zIndex as number
    );
  });

  it('keeps a group below a selected child', () => {
    const nodes = translateNodes(
      [nodeView('g', 'group'), nodeView('child')],
      viewId,
      new Set(['child'])
    );

    expect(byId(nodes, 'g')?.zIndex).toBeLessThan(
      byId(nodes, 'child')?.zIndex as number
    );
  });

  it('defaults to no selection when the set is omitted', () => {
    const nodes = translateNodes([nodeView('a')], viewId);

    expect(nodes[0].zIndex).toBe(NODE_Z_INDEX.node);
  });
});
