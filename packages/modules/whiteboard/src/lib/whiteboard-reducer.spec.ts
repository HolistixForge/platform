/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * WhiteboardReducer — the view model of the graph.
 *
 * Part of the non-regression harness for the Excalidraw refactor (TAC-213).
 * 1229 lines with no test, holding the concepts a drawing tool has no
 * equivalent for: unfolding a graph by rank from its roots, a node being
 * open or closed, several views over one graph, a collaborative lock.
 *
 * They are locked here, against a real Yjs document, precisely because the
 * refactor cannot make them fail loudly. Excalidraw has no notion of rank,
 * so nothing would throw — the graph would simply stop unfolding, and the
 * board would look like a board.
 */

import { Doc } from 'yjs';
import { YjsSharedTypes } from '@holistix-forge/collab-engine';
import {
  TGraphNode,
  TEdge,
  EEdgeSemanticType,
} from '@holistix-forge/core-graph';

import { WhiteboardReducer } from './whiteboard-reducer';
import { TGraphView, defaultGraphView, TNodeView } from './whiteboard-types';

const PROJECT_ID = 'project-1';
const VIEW = 'view-1';
const requestData = { project_id: PROJECT_ID, user_id: 'system' } as any;

const node = (id: string, over: Partial<TGraphNode> = {}): TGraphNode => ({
  id,
  name: `node ${id}`,
  type: 'shape',
  root: true,
  connectors: [],
  ...over,
});

const edge = (
  from: string,
  to: string,
  semanticType: EEdgeSemanticType = 'referenced_by'
): TEdge => ({
  from: { node: from, connectorName: 'outputs' },
  to: { node: to, connectorName: 'inputs' },
  semanticType,
});

const harness = () => {
  const shared = new YjsSharedTypes(new Doc());
  const sharedData = {
    'whiteboard:graphViews': shared.getSharedMap<TGraphView>(
      'whiteboard:graphViews'
    ),
    'core-graph:nodes': shared.getSharedMap<TGraphNode>('core-graph:nodes'),
    'core-graph:edges': shared.getSharedArray<TEdge>('core-graph:edges'),
  };

  // Forwards back into the reducer, the way the real dispatcher does, so the
  // `core:new-node` → `update-graph-view` chain is actually exercised.
  const processEvent = jest.fn((event: any, rd: any) =>
    reducer.reduce(event, rd)
  );

  const depsExports = {
    collab: {
      registry: {
        getCollabForProject: () => ({ sharedData }),
        registerSharedData: () => undefined,
      },
    },
    reducers: { processEvent, loadReducers: () => undefined },
    gateway: {},
  };

  const reducer: WhiteboardReducer = new WhiteboardReducer(depsExports as any);

  const addView = (id = VIEW, params: Partial<TGraphView['params']> = {}) => {
    const gv = defaultGraphView();
    gv.params = { ...gv.params, ...params };
    sharedData['whiteboard:graphViews'].set(id, gv);
  };

  const addNode = async (n: TGraphNode, edgesWith: TEdge[] = []) => {
    sharedData['core-graph:nodes'].set(n.id, n);
    edgesWith.forEach((e) => sharedData['core-graph:edges'].push([e]));
    await reducer.reduce(
      { type: 'core:new-node', nodeData: n, edges: [] } as any,
      requestData
    );
  };

  const refresh = (viewId = VIEW) =>
    reducer.reduce(
      { type: 'whiteboard:update-graph-view', viewId } as any,
      requestData
    );

  const view = (id = VIEW) => sharedData['whiteboard:graphViews'].get(id);
  const rendered = (id = VIEW) =>
    (view(id)?.graph.nodes ?? []).map((n: TNodeView) => n.id);

  const setStatus = (nid: string, over: Partial<TNodeView['status']>) => {
    const gv = structuredClone(view() as TGraphView);
    const nv = gv.nodeViews.find((n) => n.id === nid);
    if (nv) nv.status = { ...nv.status, ...over };
    sharedData['whiteboard:graphViews'].set(VIEW, gv);
  };

  return {
    reducer,
    sharedData,
    processEvent,
    addView,
    addNode,
    refresh,
    view,
    rendered,
    setStatus,
  };
};

describe('WhiteboardReducer', () => {
  describe('core:new-node', () => {
    /**
     * Several views over one graph. A single Excalidraw scene has no
     * equivalent, so a migration that keeps "the scene" keeps one of them.
     */
    it('adds a node view to every graph view, not just the active one', async () => {
      const h = harness();
      h.addView('view-a');
      h.addView('view-b');

      await h.addNode(node('n1'));

      expect(h.view('view-a')?.nodeViews.map((n) => n.id)).toEqual(['n1']);
      expect(h.view('view-b')?.nodeViews.map((n) => n.id)).toEqual(['n1']);
    });

    it('places the node at the origin position only in the view it came from', async () => {
      const h = harness();
      h.addView('view-a');
      h.addView('view-b');

      // The node has to be in `core-graph:nodes` first. `CoreReducer` writes
      // it there, and the recompute that follows purges any node view whose
      // node is absent — so a view added for a node that does not exist
      // vanishes in the same turn.
      h.sharedData['core-graph:nodes'].set('n1', node('n1'));

      await h.reducer.reduce(
        {
          type: 'core:new-node',
          nodeData: node('n1'),
          edges: [],
          origin: { viewId: 'view-a', position: { x: 42, y: 7 } },
        } as any,
        requestData
      );

      expect(h.view('view-a')?.nodeViews[0].position).toEqual({ x: 42, y: 7 });
      expect(h.view('view-b')?.nodeViews[0].position).toEqual({ x: 0, y: 0 });
    });

    /**
     * The purge, asserted on its own because the case above depends on it and
     * would otherwise fail for a reason that looks like the position logic.
     */
    it('drops a node view whose node was never written to the graph', async () => {
      const h = harness();
      h.addView();

      await h.reducer.reduce(
        { type: 'core:new-node', nodeData: node('ghost'), edges: [] } as any,
        requestData
      );

      expect(h.view()?.nodeViews).toEqual([]);
    });
  });

  describe('unfolding by rank', () => {
    /** n1 → n2 → n3 → n4, only n1 is a root. */
    const chain = async () => {
      const h = harness();
      h.addView(VIEW, { maxRank: 2 });

      await h.addNode(node('n1'));
      await h.addNode(node('n2', { root: false }), [edge('n1', 'n2')]);
      await h.addNode(node('n3', { root: false }), [edge('n2', 'n3')]);
      await h.addNode(node('n4', { root: false }), [edge('n3', 'n4')]);
      await h.refresh();
      return h;
    };

    it('walks out from the roots and stops at maxRank', async () => {
      const h = await chain();

      // depth 0,1,2 reachable; n4 sits at depth 3.
      expect(h.rendered().sort()).toEqual(['n1', 'n2', 'n3']);
    });

    it('reaches further when maxRank is raised', async () => {
      const h = await chain();

      const gv = structuredClone(h.view() as TGraphView);
      gv.params.maxRank = 3;
      h.sharedData['whiteboard:graphViews'].set(VIEW, gv);
      await h.refresh();

      expect(h.rendered().sort()).toEqual(['n1', 'n2', 'n3', 'n4']);
    });

    it('leaves out a node listed in filterOutNodes', async () => {
      const h = await chain();

      const gv = structuredClone(h.view() as TGraphView);
      gv.params.filterOutNodes = ['n2'];
      h.sharedData['whiteboard:graphViews'].set(VIEW, gv);
      await h.refresh();

      expect(h.rendered()).not.toContain('n2');
    });

    /**
     * Closing a node is what stops the graph unfolding through it. It is the
     * whole point of `TNodeViewStatus`, and it has no counterpart in a scene
     * where every element is simply drawn.
     */
    it('stops walking through a node that is closed', async () => {
      const h = await chain();
      expect(h.rendered()).toContain('n3');

      h.setStatus('n2', { forceClosed: true });
      await h.refresh();

      const after = h.rendered();
      expect(after).toContain('n2');
      expect(after).not.toContain('n3');
    });

    it('walks through it again once it is reopened', async () => {
      const h = await chain();
      h.setStatus('n2', { forceClosed: true });
      await h.refresh();

      h.setStatus('n2', { forceClosed: false, forceOpened: true });
      await h.refresh();

      expect(h.rendered()).toContain('n3');
    });

    it('renders nothing reachable when no node is a root', async () => {
      const h = harness();
      h.addView();
      await h.addNode(node('n1', { root: false }));
      await h.refresh();

      expect(h.rendered()).toEqual([]);
    });
  });

  describe('housekeeping', () => {
    it('drops the node view of a node that no longer exists', async () => {
      const h = harness();
      h.addView();
      await h.addNode(node('n1'));
      await h.addNode(node('n2'));
      expect(h.view()?.nodeViews).toHaveLength(2);

      h.sharedData['core-graph:nodes'].delete('n2');
      await h.refresh();

      expect(h.view()?.nodeViews.map((n) => n.id)).toEqual(['n1']);
    });

    /** A lock is per node view and must survive a recompute of the graph. */
    it('keeps lockedBy across a refresh', async () => {
      const h = harness();
      h.addView();
      await h.addNode(node('n1'));

      const gv = structuredClone(h.view() as TGraphView);
      gv.nodeViews[0].lockedBy = 'someone-else';
      h.sharedData['whiteboard:graphViews'].set(VIEW, gv);

      await h.refresh();

      expect(h.view()?.nodeViews[0].lockedBy).toBe('someone-else');
    });

    it('does nothing, and does not throw, for a view that is not there', async () => {
      const h = harness();
      await expect(h.refresh('nope')).resolves.toBeUndefined();
    });
  });

  describe('whiteboard:new-shape', () => {
    it('creates the node through core:new-node, with both connectors', async () => {
      const h = harness();
      h.addView();

      await h.reducer.reduce(
        {
          type: 'whiteboard:new-shape',
          viewId: VIEW,
          shapeId: 's1',
          shapeType: 'circle',
        } as any,
        requestData
      );

      const dispatched = h.processEvent.mock.calls
        .map(([e]) => e)
        .find((e: any) => e.type === 'core:new-node');

      expect(dispatched.nodeData).toMatchObject({
        id: 's1',
        type: 'shape',
        data: { shapeType: 'circle' },
      });
      expect(
        dispatched.nodeData.connectors.map((c: any) => c.connectorName)
      ).toEqual(['inputs', 'outputs']);
    });
  });
});
