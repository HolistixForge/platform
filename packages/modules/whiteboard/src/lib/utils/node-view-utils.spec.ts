import { purgeDeletedNodeViews } from './node-view-utils';
import {
  connectorViewDefault,
  defaultGraphView,
  nodeViewDefaultStatus,
  TGraphView,
  TNodeView,
} from '../whiteboard-types';

/**
 * TESTING nodeViews PURGE (issue #2)
 *
 * `nodeViews` is intentionally kept for nodes that are not currently displayed,
 * so the only thing that may remove an entry is the node disappearing from the
 * core graph. These tests pin that boundary: gone from the core graph → purged,
 * merely not displayed → kept.
 */

const nodeView = (id: string, parentId?: string): TNodeView => ({
  id,
  type: 'test',
  position: { x: 0, y: 0 },
  status: nodeViewDefaultStatus(),
  ...(parentId ? { parentId } : {}),
});

const graphView = (nodeViews: TNodeView[]): TGraphView => ({
  ...defaultGraphView(),
  nodeViews,
});

/** Stands in for the core graph's node map. */
const coreGraph = (...ids: string[]) => {
  const present = new Set(ids);
  return (id: string) => present.has(id);
};

describe('purgeDeletedNodeViews', () => {
  it('removes nodeViews whose node is gone from the core graph', () => {
    const gv = graphView([nodeView('a'), nodeView('deleted'), nodeView('b')]);

    purgeDeletedNodeViews(gv, coreGraph('a', 'b'));

    expect(gv.nodeViews.map((n) => n.id)).toEqual(['a', 'b']);
  });

  it('keeps nodeViews for nodes that exist but are not displayed', () => {
    // graph.nodes is the displayed subset; nodeViews holds user choices for
    // nodes outside the current extract and must survive.
    const gv = graphView([nodeView('displayed'), nodeView('offscreen')]);
    gv.graph.nodes = [gv.nodeViews[0]];

    purgeDeletedNodeViews(gv, coreGraph('displayed', 'offscreen'));

    expect(gv.nodeViews.map((n) => n.id)).toEqual(['displayed', 'offscreen']);
  });

  it('removes connectorViews for deleted nodes', () => {
    const gv = graphView([nodeView('a')]);
    gv.connectorViews = {
      a: [connectorViewDefault('inputs')],
      deleted: [connectorViewDefault('inputs')],
    };

    purgeDeletedNodeViews(gv, coreGraph('a'));

    expect(Object.keys(gv.connectorViews)).toEqual(['a']);
  });

  it('clears parentId pointing at a deleted group', () => {
    const gv = graphView([nodeView('group'), nodeView('child', 'group')]);

    purgeDeletedNodeViews(gv, coreGraph('child'));

    expect(gv.nodeViews).toHaveLength(1);
    expect(gv.nodeViews[0].parentId).toBeUndefined();
  });

  it('keeps parentId when the group still exists', () => {
    const gv = graphView([nodeView('group'), nodeView('child', 'group')]);

    purgeDeletedNodeViews(gv, coreGraph('group', 'child'));

    expect(gv.nodeViews[1].parentId).toBe('group');
  });

  it('is a no-op when nothing was deleted', () => {
    const gv = graphView([nodeView('a'), nodeView('b')]);
    const before = gv.nodeViews;

    purgeDeletedNodeViews(gv, coreGraph('a', 'b'));

    // Same array identity: no churn for the common case, which runs on every
    // graph view update.
    expect(gv.nodeViews).toBe(before);
  });

  it('handles an empty graph view', () => {
    const gv = defaultGraphView();

    expect(() => purgeDeletedNodeViews(gv, coreGraph())).not.toThrow();
    expect(gv.nodeViews).toEqual([]);
  });
});
