/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * CoreReducer — the graph model's write path.
 *
 * Part of the non-regression harness for the Excalidraw refactor (TAC-213).
 * These 107 lines carry every node and edge in the platform and had no test
 * at all. The reason to lock them *now* is that the concepts they hold —
 * named connectors, semantic edge types, cascade on delete — have no
 * equivalent in a drawing tool, so if the refactor drops one it will not
 * throw. It will just quietly stop being true.
 *
 * Written against a real Yjs document rather than a stand-in map: this is
 * the thing that actually stores the graph, and it is what the reducer will
 * still be writing to after the surface above it changes.
 */

import { Doc } from 'yjs';
import { YjsSharedTypes } from '@holistix-forge/collab-engine';

import { CoreReducer } from './core-reducer';
import {
  TGraphNode,
  TEdge,
  EEdgeSemanticType,
  TCoreSharedData,
} from './core-types';

const PROJECT_ID = 'project-1';
const requestData = { project_id: PROJECT_ID, user_id: 'system' } as any;

/** Every semantic type the model declares, used and unused alike. */
const ALL_SEMANTIC_TYPES: EEdgeSemanticType[] = [
  '_unknown_',
  'grouped_edges',
  'referenced_by',
  'next_in_sequence',
  'owned_by',
  'composed_of',
  'satisfied_by',
  'tested_by',
  'wired_to',
  'depends_on',
  'easy-connect',
];

const node = (id: string, over: Partial<TGraphNode> = {}): TGraphNode => ({
  id,
  name: `node ${id}`,
  type: 'shape',
  root: true,
  connectors: [
    { connectorName: 'inputs', pins: [] },
    { connectorName: 'outputs', pins: [] },
  ],
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

const reducerOn = (doc: Doc) => {
  const shared = new YjsSharedTypes(doc);
  const sharedData: TCoreSharedData = {
    'core-graph:nodes': shared.getSharedMap<TGraphNode>('core-graph:nodes'),
    'core-graph:edges': shared.getSharedArray<TEdge>('core-graph:edges'),
  };

  const depsExports = {
    collab: {
      registry: {
        getCollabForProject: () => ({ sharedData }),
        registerSharedData: () => undefined,
      },
    },
  };

  return { reducer: new CoreReducer(depsExports as any), sharedData };
};

describe('CoreReducer', () => {
  let reducer: CoreReducer;
  let sharedData: TCoreSharedData;

  beforeEach(() => {
    ({ reducer, sharedData } = reducerOn(new Doc()));
  });

  const nodes = () => sharedData['core-graph:nodes'];
  const edges = () => sharedData['core-graph:edges'];

  describe('core:new-node', () => {
    it('writes the node under its own id', async () => {
      await reducer.reduce(
        { type: 'core:new-node', nodeData: node('n1'), edges: [] },
        requestData
      );

      expect(nodes().get('n1')).toMatchObject({ id: 'n1', type: 'shape' });
    });

    /**
     * Connectors are the graph's attachment points. Excalidraw binds to an
     * element as a whole and has nothing equivalent, so this is one of the
     * concepts most likely to be dropped without anyone noticing.
     */
    it('keeps the named connectors', async () => {
      await reducer.reduce(
        { type: 'core:new-node', nodeData: node('n1'), edges: [] },
        requestData
      );

      expect(
        nodes()
          .get('n1')
          ?.connectors.map((c) => c.connectorName)
      ).toEqual(['inputs', 'outputs']);
    });

    it('keeps named pins inside a connector', async () => {
      const withPins = node('n1', {
        connectors: [
          {
            connectorName: 'outputs',
            pins: [
              { id: 'p1', pinName: 'result', type: 'out' },
              { id: 'p2', pinName: 'error', type: 'out' },
            ],
          },
        ],
      });

      await reducer.reduce(
        { type: 'core:new-node', nodeData: withPins, edges: [] },
        requestData
      );

      const pins = nodes().get('n1')?.connectors[0].pins;
      expect(pins?.map((p) => p.pinName)).toEqual(['result', 'error']);
      expect(pins?.[0].type).toBe('out');
    });

    it('pushes the edges that come with the node', async () => {
      await reducer.reduce(
        {
          type: 'core:new-node',
          nodeData: node('n2'),
          edges: [edge('n1', 'n2')],
        },
        requestData
      );

      expect(edges().toArray()).toHaveLength(1);
      expect(edges().get(0).semanticType).toBe('referenced_by');
    });

    it('accepts a node with no edges at all', async () => {
      await reducer.reduce(
        { type: 'core:new-node', nodeData: node('n1') } as any,
        requestData
      );

      expect(nodes().get('n1')).toBeDefined();
      expect(edges().toArray()).toHaveLength(0);
    });
  });

  describe('core:delete-node', () => {
    beforeEach(async () => {
      for (const id of ['n1', 'n2', 'n3']) {
        await reducer.reduce(
          { type: 'core:new-node', nodeData: node(id), edges: [] },
          requestData
        );
      }
    });

    it('removes the node', async () => {
      await reducer.reduce({ type: 'core:delete-node', id: 'n1' }, requestData);
      expect(nodes().get('n1')).toBeUndefined();
      expect(nodes().get('n2')).toBeDefined();
    });

    /**
     * The cascade. Without it a deleted node leaves edges pointing at nothing,
     * which is the shape of "the drawing says a terminal is open and it is
     * not" — an edge that outlives what it describes.
     */
    it('removes every edge touching it, in both directions', async () => {
      await reducer.reduce(
        { type: 'core:new-edge', edge: edge('n1', 'n2') },
        requestData
      );
      await reducer.reduce(
        { type: 'core:new-edge', edge: edge('n3', 'n1') },
        requestData
      );
      await reducer.reduce(
        { type: 'core:new-edge', edge: edge('n2', 'n3') },
        requestData
      );

      await reducer.reduce({ type: 'core:delete-node', id: 'n1' }, requestData);

      const left = edges().toArray();
      expect(left).toHaveLength(1);
      expect(left[0].from.node).toBe('n2');
      expect(left[0].to.node).toBe('n3');
    });

    it('is a no-op on a node that is not there', async () => {
      await reducer.reduce(
        { type: 'core:delete-node', id: 'ghost' },
        requestData
      );
      expect(nodes().get('n1')).toBeDefined();
    });
  });

  describe('edges', () => {
    it('appends on core:new-edge', async () => {
      await reducer.reduce(
        { type: 'core:new-edge', edge: edge('n1', 'n2') },
        requestData
      );
      await reducer.reduce(
        { type: 'core:new-edge', edge: edge('n2', 'n3') },
        requestData
      );

      expect(edges().toArray()).toHaveLength(2);
    });

    it('deletes only the edge it was given', async () => {
      const a = edge('n1', 'n2');
      const b = edge('n2', 'n3');
      await reducer.reduce({ type: 'core:new-edge', edge: a }, requestData);
      await reducer.reduce({ type: 'core:new-edge', edge: b }, requestData);

      await reducer.reduce({ type: 'core:delete-edge', edge: a }, requestData);

      const left = edges().toArray();
      expect(left).toHaveLength(1);
      expect(left[0].from.node).toBe('n2');
    });

    /**
     * Five of these eleven are produced in the platform today and six are not.
     * The unused ones are the cheapest to lose in a migration and the hardest
     * to notice missing, so the whole set is asserted rather than the subset
     * that happens to be in use.
     */
    it.each(ALL_SEMANTIC_TYPES)(
      'round-trips the %s semantic type',
      async (t) => {
        await reducer.reduce(
          { type: 'core:new-edge', edge: edge('n1', 'n2', t) },
          requestData
        );

        expect(edges().get(0).semanticType).toBe(t);
      }
    );

    it('keeps the pin an edge is attached to', async () => {
      const pinned: TEdge = {
        from: { node: 'n1', connectorName: 'outputs', pinName: 'result' },
        to: { node: 'n2', connectorName: 'inputs', pinName: 'left' },
        semanticType: 'wired_to',
      };

      await reducer.reduce(
        { type: 'core:new-edge', edge: pinned },
        requestData
      );

      expect(edges().get(0).from.pinName).toBe('result');
      expect(edges().get(0).to.pinName).toBe('left');
    });
  });

  it('ignores an event it does not handle', async () => {
    await reducer.reduce({ type: 'whiteboard:move-node' } as any, requestData);
    expect(nodes().copy().size).toBe(0);
  });
});
